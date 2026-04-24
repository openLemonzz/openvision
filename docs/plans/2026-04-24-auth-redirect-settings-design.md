# Auth Redirect Settings Design

**Problem**

Supabase registration emails are using a fallback redirect target that can drift from the actual public web address. The current frontend only derives the redirect URL from `window.location.origin`, which is not enough when the public address must be controlled centrally from the admin side and updated without redeploying the web app.

**Goal**

Allow admins to manage the public web URL from the admin backend, and make web registration / password-reset flows use the latest saved value immediately on the next action.

**Chosen Approach**

Add a dedicated settings record in the backend and expose it through:

- an admin-only read/write API for the management UI
- a public read-only API for safe frontend consumption

The web app will fetch this public setting at the moment the user triggers signup or password reset. If the setting is unavailable or invalid, the web app will fall back to `window.location.origin`.

**Why This Approach**

- No redeploy or container restart is required after changing the public web URL.
- Already-open frontend tabs pick up the new value on the next auth action.
- The admin app remains the single source of truth for operational settings.
- The public API only exposes a safe field, so there is no config leakage.

**Alternatives Considered**

1. Environment variable injected into the web container
   - Rejected because it requires redeploy/restart and does not satisfy immediate effect.

2. Fetch settings once on frontend boot
   - Rejected because open tabs would still need a refresh after admin changes.

3. Real-time push / polling invalidation
   - Rejected as unnecessary complexity for a setting only used during auth flows.

**Data Model**

Add `public.app_settings` with a single-row shape:

- `id` fixed to `default`
- `public_web_url` text nullable
- `created_at` timestamptz
- `updated_at` timestamptz

The backend will normalize and persist only the URL origin. For example:

- input: `https://vision.app/welcome?from=email`
- stored value: `https://vision.app`

Only absolute `http` and `https` URLs are accepted.

**Backend API**

Admin-only:

- `GET /api/settings`
- `PUT /api/settings`

Public:

- `GET /api/settings/public`

Response shape:

```json
{
  "publicWebUrl": "https://vision.app"
}
```

`PUT /api/settings` will validate and normalize input before saving. Invalid URLs return `400`.

**Admin UI**

Add a dedicated “站点配置” page in the admin app navigation.

Initial scope:

- one text field: “前台公开地址”
- inline help reminding operators to also add the same address to Supabase Authentication redirect allowlist
- success / error feedback on save

**Frontend Behavior**

On signup and password reset:

1. call `GET /api/settings/public`
2. if `publicWebUrl` is valid, use it
3. otherwise, fall back to `window.location.origin`
4. pass the resolved value to Supabase as `emailRedirectTo` / `redirectTo`

No long-lived caching will be added.

**Validation Rules**

Backend:

- accept empty value only if we want to allow fallback mode
- accept only absolute `http` / `https` URLs
- persist `new URL(value).origin`

Frontend:

- treat missing / malformed public config as non-fatal
- continue auth flow with browser origin fallback

**Operational Constraint**

Supabase Authentication redirect allowlist must include the configured public web URL. Otherwise Supabase may ignore the supplied redirect target and fall back to its own dashboard-configured default URL.

**Files Expected To Change**

- `supabase/schema.sql`
- `admin/server/app.ts`
- `admin/src/App.tsx`
- `admin/src/pages/admin/AdminLayout.tsx`
- `admin/src/pages/admin/AdminSettings.tsx`
- `admin/src/hooks/useAdminApp.ts`
- `admin/src/lib/types.ts`
- `admin/tests/server-api.test.ts`
- `web/src/hooks/useAuth.ts`
- `web/src/lib/auth-registration.ts`
- `web/src/lib/auth-registration.test.ts`

**Non-Goals**

- general-purpose dynamic config framework
- real-time settings push to connected browsers
- moving other runtime env values into admin-managed settings
