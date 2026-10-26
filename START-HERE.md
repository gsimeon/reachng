# Start here

1. Extract the ZIP.
2. Install Node.js LTS (20.9+).
3. Open this folder in VS Code.
4. Copy `.env.example` to `.env.local`.
5. Run `npm install`, then `npm run dev`.
6. Open `http://localhost:3000`.
7. To enable saved locations, create a Supabase project, run the SQL migration, add Supabase URL/anon key, then implement sign-in/workspace onboarding as described in README.
8. To enable real postcode lookup, obtain authorized NDAPS API docs and credentials and configure the exact documented contract. Do not guess endpoint/auth details.

**This is an MVP starter, not yet production-certified.** The app explicitly labels unconfigured lookup responses as demo-only.
