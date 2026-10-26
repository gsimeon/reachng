-- ReachNG initial schema. Run in Supabase SQL Editor or via Supabase CLI.
-- This migration deliberately starts with a single organization membership per
-- user for MVP simplicity; extend membership/role workflows before enterprise use.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  postcode text not null check (postcode ~ '^[A-Za-z0-9]{11}$'),
  address text not null default '' check (char_length(address) <= 300),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locations_org_created_idx
  on public.locations (organization_id, created_at desc);
create index if not exists locations_postcode_idx
  on public.locations (postcode);

create table if not exists public.validation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  postcode text not null check (char_length(postcode) <= 80),
  outcome text not null check (outcome in ('format_invalid', 'provider_success', 'provider_failure', 'demo_only')),
  provider_status integer,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  resource_type text not null check (char_length(resource_type) between 1 and 80),
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.api_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  endpoint text not null,
  status_code integer,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now()
);

-- Create profile row for new auth users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper: return current user's organization IDs.
create or replace function public.my_organization_ids()
returns setof uuid language sql stable security invoker
set search_path = ''
as $$
  select organization_id from public.organization_members where user_id = (select auth.uid());
$$;

-- A newly registered user needs an organization. This RPC creates the workspace
-- and membership atomically. Call after sign-in/sign-up from a future onboarding screen.
create or replace function public.create_workspace(workspace_name text)
returns uuid language plpgsql security invoker
set search_path = ''
as $$
declare new_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(workspace_name)) < 1 or char_length(trim(workspace_name)) > 120 then
    raise exception 'Workspace name must be 1–120 characters';
  end if;
  insert into public.organizations (name, created_by)
  values (trim(workspace_name), auth.uid()) returning id into new_org_id;
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, auth.uid(), 'owner');
  return new_org_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.locations enable row level security;
alter table public.validation_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.api_usage_events enable row level security;

create policy "profiles_select_self" on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_self" on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "organizations_select_member" on public.organizations
for select to authenticated using (id in (select public.my_organization_ids()));
create policy "organizations_insert_self" on public.organizations
for insert to authenticated with check (created_by = (select auth.uid()));
create policy "members_select_same_org" on public.organization_members
for select to authenticated using (organization_id in (select public.my_organization_ids()));
-- Membership creation is only through create_workspace RPC for normal clients.

create policy "locations_select_org" on public.locations
for select to authenticated using (organization_id in (select public.my_organization_ids()));
create policy "locations_insert_org" on public.locations
for insert to authenticated with check (
  created_by = (select auth.uid())
  and organization_id in (select public.my_organization_ids())
);
create policy "locations_update_org" on public.locations
for update to authenticated using (organization_id in (select public.my_organization_ids()))
with check (organization_id in (select public.my_organization_ids()));
create policy "locations_delete_org" on public.locations
for delete to authenticated using (organization_id in (select public.my_organization_ids()));

create policy "validation_events_select_org" on public.validation_events
for select to authenticated using (organization_id in (select public.my_organization_ids()));
create policy "validation_events_insert_org" on public.validation_events
for insert to authenticated with check (
  user_id = (select auth.uid()) and organization_id in (select public.my_organization_ids())
);

create policy "audit_events_select_org" on public.audit_events
for select to authenticated using (organization_id in (select public.my_organization_ids()));
create policy "api_usage_select_org" on public.api_usage_events
for select to authenticated using (organization_id in (select public.my_organization_ids()));

-- Enforce tenant assignment in DB: clients cannot pick another tenant's organization.
create or replace function public.assign_location_organization()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare org_id uuid;
begin
  if new.created_by is distinct from auth.uid() then raise exception 'Invalid creator'; end if;
  select organization_id into org_id
  from public.organization_members
  where user_id = auth.uid()
  order by created_at asc limit 1;
  if org_id is null then raise exception 'Create a workspace before saving locations'; end if;
  new.organization_id := org_id;
  return new;
end;
$$;

drop trigger if exists locations_assign_organization on public.locations;
create trigger locations_assign_organization
before insert on public.locations
for each row execute procedure public.assign_location_organization();

-- No policies grant client-side writes to audit_events/api_usage_events.
