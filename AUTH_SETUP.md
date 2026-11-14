# ForgeRoster authentication setup

ForgeRoster is a static GitHub Pages site. Real account registration requires an external authentication provider. The frontend uses **Supabase Auth** email/password; it is not enabled until configured.

1. Create a Supabase project at https://supabase.com/dashboard.
2. Under Authentication → Providers, enable Email; decide whether to require email confirmation.
3. Under Authentication → URL Configuration, set Site URL to `https://andrewvasbinder1-dotcom.github.io/Forgeroster/` and add this address to redirect URLs.
4. Under Project Settings → API (or Connect), copy the **Project URL** and **publishable/anon key**. Do not use a service_role or secret key.
5. Edit `auth-config.js` in GitHub and fill `url` and `anonKey`.
6. Wait for GitHub Pages deployment and test sign-up, email confirmation, sign-in, sign-out, and password reset.

**Important security and data limitations**

- Until configured, the site remains usable in local-only mode and shows a warning.
- Signing in does **not yet sync rosters to Supabase**. The roster editor currently stores its data in localStorage, which is shared by all people using the same browser profile on that device. Do not treat localStorage as private user data.
- Before offering this as a multi-user product, implement a `rosters` table with a `user_id` column, Row Level Security policies restricting CRUD to `auth.uid() = user_id`, and user-scoped CRUD in the client. Verify RLS from two independent accounts.
- Passwords are handled by Supabase Auth, never stored in the ForgeRoster repository or browser localStorage by ForgeRoster.
- Wahapedia rules imports and full official validation are separate unfinished work.
