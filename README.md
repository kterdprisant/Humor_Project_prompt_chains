# Open Mic AI · Prompt Chains

A tool for building and testing the prompt chains behind
[Open Mic AI](https://github.com/kterdprisant/kt3073-humorproject)'s captions. It's a separate
Next.js app and Vercel project that uses the **same Supabase project** as the original app and the
[admin area](https://github.com/kterdprisant/Humor_Project_admin).

Prompt chains live in `humor_flavors`, their ordered steps in `humor_flavor_steps`, and every run
is logged to `caption_requests` → `llm_prompt_chains` → `llm_model_responses`. See the admin
repo's `supabase/migrations/20261027000000_prompt_chain_and_signup_tables.sql`.

Every route is behind Google sign-in **and** `profiles.is_superadmin = TRUE`, using the same gate as
the admin app (`src/proxy.ts` → `src/lib/dal.ts`).

## Setup

1. `cp .env.example .env.local` and fill in the same Supabase values as the admin app.
2. Add each origin's callback to **Supabase → Authentication → URL Configuration → Redirect
   URLs**: `http://localhost:3003/auth/callback` plus the Vercel domain(s).
3. `npm install && npm run dev -- -p 3003`

## Theme

System / Light / Dark toggle in the header. The choice is stored in `localStorage` and applied as
`<html data-theme>` before first paint (`src/lib/theme.ts`). "System" follows the OS setting.
