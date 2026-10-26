# ReachNG MVP

**Every destination. Within reach.**

A light-theme Next.js starter for a Nigerian postcode and business-location intelligence product. It includes a postcode explorer UI, a server-side provider adapter, a Supabase schema with organization-scoped location records, and initial smoke tests.

> Important: this is a production-oriented starter, not a claim that NDAPS credentials, a provider lookup, deployment, or production security review have been completed. Without provider configuration, lookup responses are clearly marked **Demo · not verified**.

## MVP features

- Responsive light UI (warm white, forest green, orange accents).
- Postcode format check (11 alphanumeric characters) and clear invalid/provider-failure states.
- Server-side provider adapter. API keys are never read by browser code.
- Supabase server client and protected location list/create endpoints.
- Organization, membership, location, validation, audit and API usage tables.
- Row Level Security policies and a workspace-creation RPC.
- Safe generic provider errors and an 8-second upstream timeout.

## 1. Requirements

- Node.js 20.9+ (recommended: current Node.js LTS)
- npm
- A Supabase project
- Official NDAPS developer account and API docs/credentials for real provider lookup

## 2. Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without Supabase and NDAPS credentials, the explorer can still demonstrate the UI and format guard, but saving locations and authoritative provider lookup will not work.

## 3. Configure Supabase

1. Create a Supabase project.
2. Copy Project URL and anon/publishable key into `.env.local`.
3. In Supabase SQL Editor, run `supabase/migrations/202610250001_initial_schema.sql`.
4. Enable the auth provider(s) you intend to use in Supabase Authentication.
5. Add an authentication UI before exposing this to real users. The starter API correctly requires an authenticated session for location operations.
6. After a user signs in, call `supabase.rpc('create_workspace', { workspace_name: 'Your business name' })` once during onboarding. The UI in this starter does not yet implement sign-in/workspace onboarding.

Do not add a Supabase service-role key to a `NEXT_PUBLIC_` variable or browser code. This starter intentionally uses the user session and RLS for location access.

## 4. Configure official NDAPS API

Start at the official platform and use the currently authorized developer documentation:
- https://postcode.gov.ng/
- https://postcode.gov.ng/blog/how-to-integrate-nigeria-digital-postcode-api
- https://www.postcode.gov.ng/acceptable-use

Set these server-only variables in `.env.local` only after confirming the exact provider contract:

```dotenv
NDAPS_API_BASE_URL=
NDAPS_API_KEY=
NDAPS_LOOKUP_PATH=
NDAPS_AUTH_HEADER=Authorization
NDAPS_AUTH_SCHEME=Bearer
```

`NDAPS_LOOKUP_PATH` is intentionally blank in the example. Do not guess endpoints, authentication headers, or response fields. The adapter currently sends `GET {base}/{path}?postcode=...`; if official docs specify a different method or payload, update `src/lib/postcode.ts` accordingly and add a contract test. Provider success means the provider responded successfully; the returned schema must be mapped and reviewed before product code presents individual fields as verified facts.

Never commit `.env.local`. Never expose keys in client components, logs, screenshots, or public issue reports. Follow provider terms for caching, retention, rate limits and commercial use.

## 5. Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
node --test tests/postcode.test.mjs
```

The smoke test can be run without installing project dependencies. The project build/typecheck/lint commands require `npm install`.

## 6. Before production

This is a starting point, not a completed production certification. Close these gates before handling customer data:

- [ ] Add sign-in, sign-out, password recovery, and workspace onboarding UI.
- [ ] Confirm current official NDAPS endpoint, authentication, request/response contract, permitted usage, quotas, caching and retention.
- [ ] Add provider contract tests using authorized test credentials; never fabricate a successful provider response.
- [ ] Add shared rate limiting (e.g. Upstash/Redis or a trusted gateway), abuse controls, request IDs and monitoring.
- [ ] Add server-side schema mapping and separate “format valid” from “provider verified” and “deliverability confirmed”.
- [ ] Add audit writes and validation event writes with a reviewed retention policy.
- [ ] Add end-to-end tests for auth, RLS tenant isolation, create/read locations, provider failure, timeouts, and malformed responses.
- [ ] Add GitHub Actions CI, dependency scanning, secret scanning and protected deployment environments.
- [ ] Test RLS with two users in different organizations, including attempts to spoof organization IDs.
- [ ] Add data export/deletion workflow and test its transactional behavior.
- [ ] Configure CSP/security headers, monitoring, backup/restore, incident contacts and rollback.
- [ ] Run a real production build and review accessibility on mobile and desktop.
- [ ] Verify legal/business approval for all provider data use before charging customers.

## Project layout

```text
src/
  app/
    api/postcode/route.ts     # server-only provider lookup
    api/locations/route.ts    # authenticated location book API
    globals.css
    layout.tsx
    page.tsx                  # light-theme MVP explorer
  lib/
    postcode.ts               # provider adapter + format guard
    supabase/server.ts
supabase/migrations/
  202610250001_initial_schema.sql
tests/
  postcode.test.mjs
```

## Product positioning

ReachNG helps businesses organise and integrate Nigerian location data. A postcode lookup alone does **not** prove identity, ownership, occupancy, exact doorstep coordinates or delivery access. Do not market it as doing so unless an authorized provider explicitly supports and confirms those capabilities.
