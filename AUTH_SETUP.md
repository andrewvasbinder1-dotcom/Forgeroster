# ForgeRoster accounts and cloud rosters

ForgeRoster works with a device roster while signed out. Sign in to create an account library, save armies to Supabase, and open them on other devices. Use **Import device roster** to copy an existing device roster into the library.

## Configure Supabase

1. In Supabase Authentication → Providers, enable Email and choose your email confirmation settings.
2. In Authentication → URL Configuration, set the Site URL and an allowed redirect URL to `https://andrewvasbinder1-dotcom.github.io/Forgeroster/`. Add the exact localhost URL for development if you test confirmation or password recovery locally. Check custom email templates use the redirect URL.
3. Set the project URL and publishable key in [auth-config.js](auth-config.js). Keep the service-role and secret keys out of frontend code.
4. Apply [supabase/rosters.sql](supabase/rosters.sql) in SQL Editor. It can be reapplied to an existing ForgeRoster project. It enables owner-only RLS for reads, inserts, updates and deletes, restricts the anonymous role, and installs the database-managed revision trigger.
5. In Database → Policies, review the `public.rosters` policies. Remove any pre-existing broad policy that gives another role or account roster access.

## Verify a configured project

1. Create a test account and follow the email confirmation link. Sign in and create Army A. Add a unit and wait for **Saved to cloud**.
2. Open the site on an independent browser/device, sign in with the same test account, and open Army A. Edit it, then refresh the library on the first device and confirm the edit appears.
3. Edit the same roster with both devices before the first save reaches the second. Check that the second save preserves its local draft and offers **Discard local changes** to load the cloud revision.
4. Sign in as a second account in an independent browser profile. Check that Army A is absent from its library. With each test account's own token, use the REST API to verify select, update, and delete filters scoped to the other account's row return no rows and that inserting under another account's ID is rejected.
5. Request a password reset from the sign-in dialog, follow the emailed link, and save a new password. Verify sign-in with the new password. Delete test armies when finished.

## Sync behavior and limits

Edits save after a brief delay. ForgeRoster refreshes the library when the tab regains focus or network connectivity and periodically while visible. If a roster has changed remotely, export a conflicted local draft before discarding it. The app supports independent army lists and version checks for overlapping edits. It does not merge edits.

Account drafts are scoped to their owner and browser tab and kept across refreshes within that tab. A signed-out user sees the device roster only. Closing a tab can lose edits that have not synced, so wait for the sync acknowledgement or export the draft before closing it. Device rosters, account drafts and Supabase session tokens remain in browser-managed storage. Signing out hides account drafts and revokes the local Supabase session.

Earlier builds stored the active roster in a device-wide key with an owner marker. Only that account can recover the draft, and only a matching tab may open it. Export that draft or choose the newer cloud copy because earlier drafts have no comparable revision.
