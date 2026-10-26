-- ReachNG Canonical Initial Schema & Multi-Tenant Isolation
-- Migration: 202610260001_initial_schema.sql
-- Enforces:
-- 1. Automatic user profile & default organization provisioning on signup
-- 2. Strict Row Level Security (RLS) on all tenant resources
-- 3. Server-side organization membership derivation on location inserts
-- 4. Parity with Location Book schema (label, postcode, address, category, created_by)

create extension if not exists pgcrypto;

-- 1. User Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Organizations (Tenant Boundaries)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- 3. Organization Memberships (User <-> Tenant Mapping)
create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- 4. Enterprise Locations (Tenant-Scoped Location Book)
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  postcode text not null check (postcode ~ '^[A-Za-z0-9]{11}$'),
  address text not null default '' check (char_length(address) <= 300),
  category text not null default 'Fulfilment Hub' check (category in ('Fulfilment Hub', 'Retail Store', 'Pickup Station', 'Dispatch Office')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locations_org_created_idx
  on public.locations (organization_id, created_at desc);
create index if not exists locations_postcode_idx
  on public.locations (postcode);

-- 5. Validation & Audit Events
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

-- 6. Trigger: Automatic Profile and Default Workspace Onboarding on Signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare new_org_id uuid;
declare default_org_name text;
begin
  -- Provision profile
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  -- Derive workspace name from user metadata or fallback to default
  default_org_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'company_name'), ''), 'My Workspace');

  -- Provision default tenant organization
  insert into public.organizations (name, created_by)
  values (default_org_name, new.id)
  returning id into new_org_id;

  -- Add user as workspace owner
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 7. Helper: Return list of organization IDs the current user belongs to
create or replace function public.my_organization_ids()
returns setof uuid language sql stable security invoker
set search_path = ''
as $$
  select organization_id from public.organization_members where user_id = (select auth.uid());
$$;

-- 8. RPC: Explicit Workspace Creation
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

-- 9. Trigger: Server-side Organization Assignment on Location Insert
create or replace function public.assign_location_organization()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare org_id uuid;
begin
  if new.created_by is distinct from auth.uid() then
    raise exception 'Invalid creator ID: must match authenticated user';
  end if;

  -- Determine user's active organization membership
  select organization_id into org_id
  from public.organization_members
  where user_id = auth.uid()
  order by created_at asc limit 1;

  if org_id is null then
    raise exception 'No active workspace found for user. Complete workspace onboarding first.';
  end if;

  new.organization_id := org_id;
  return new;
end;
$$;

drop trigger if exists locations_assign_organization on public.locations;
create trigger locations_assign_organization
before insert on public.locations
for each row execute procedure public.assign_location_organization();

-- 10. Row Level Security Policies
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.locations enable row level security;
alter table public.validation_events enable row level security;
alter table public.audit_events enable row level security;

-- Profiles: Users can view and update their own profile
create policy "profiles_select_self" on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_self" on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Organizations: Only members can view their organization
create policy "organizations_select_member" on public.organizations
for select to authenticated using (id in (select public.my_organization_ids()));
create policy "organizations_insert_self" on public.organizations
for insert to authenticated with check (created_by = (select auth.uid()));

-- Organization Members: Members can view fellow members in same org
create policy "members_select_same_org" on public.organization_members
for select to authenticated using (organization_id in (select public.my_organization_ids()));

-- Locations: Strict tenant isolation for CRUD
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

-- Validation Events
create policy "validation_events_select_org" on public.validation_events
for select to authenticated using (organization_id in (select public.my_organization_ids()));

create policy "validation_events_insert_org" on public.validation_events
for insert to authenticated with check (
  user_id = (select auth.uid()) and organization_id in (select public.my_organization_ids())
);

-- Audit Events: Read-only for tenant members
create policy "audit_events_select_org" on public.audit_events
for select to authenticated using (organization_id in (select public.my_organization_ids()));
