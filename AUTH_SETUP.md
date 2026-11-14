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
- Cloud syncing requires the SQL migration above. The active roster also has a local browser cache, which is not encrypted; avoid shared devices.
- Before offering this as a multi-user product, implement a `rosters` table with a `user_id` column, Row Level Security policies restricting CRUD to `auth.uid() = user_id`, and user-scoped CRUD in the client. Verify RLS from two independent accounts.
- Passwords are handled by Supabase Auth, never stored in the ForgeRoster repository or browser localStorage by ForgeRoster.
- Wahapedia rules imports and full official validation are separate unfinished work.

## Cloud roster storage (required)

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/qzkyhdxauwzqrtqcsfmu/sql/new).
2. Copy the complete SQL in [`supabase/rosters.sql`](supabase/rosters.sql) and execute it once.
3. Verify the `public.rosters` table exists and Row Level Security is enabled.
4. Sign in on ForgeRoster, create an army, add a unit, wait for **Saved to cloud**, then sign in on another device and open the same army.
5. Test with a second account to confirm the first account's rosters are not visible.

The client supports a cloud library, account-specific create/open/delete, and debounced saves. Changes on another device are loaded when the roster is reopened or the site is reloaded; simultaneous collaborative editing and conflict resolution are not yet implemented. The browser's previous local roster can be imported into a new account from **Import device roster** if shown. Avoid editing the same roster on two devices at once.
