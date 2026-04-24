# Generation Failure Diagnostics And Capacity Polling Design

**Context**

Failed generations are currently recorded only as `status = failed`. The admin generation list therefore cannot tell whether the failure came from an upstream HTTP error, an invalid provider payload, image download failure, storage upload failure, or a local parsing/runtime error. This makes operational debugging slow, especially when users report repeated failures.

The admin generation list also only shows image thumbnails. It does not allow the operator to enlarge an existing generated image for inspection.

The frontend generate button has a race on refresh. After a page reload, the client can temporarily allow another generate click before it has rebuilt the true active-job state, which means concurrency enforcement depends too much on timing of history loading. The user wants that flow inverted: the button should stay disabled until the backend explicitly says generation is available, and the client should refresh that availability every 5 seconds.

**Goals**

- Persist detailed generation failure diagnostics in the database.
- Expose detailed failure diagnostics only in the admin generation records view.
- Let admins enlarge generated images from the admin generation list.
- Fix the refresh race by making generation availability backend-authoritative.
- Keep the generate button disabled until the current user's generation capacity is confirmed.
- Re-check generation availability every 5 seconds.

**Chosen Approach**

Extend `public.generations` with two nullable fields:

- `error_message text` for a short human-readable summary
- `error_details text` for detailed diagnostics, including upstream status codes and truncated response bodies when available

Update the backend generation pipeline so every failure path records both a summary and detailed context before marking the row failed. Upstream non-2xx responses will include the HTTP status plus a truncated response body. Internal failures such as JSON parsing issues, missing image payloads, download failures, storage upload failures, or thrown runtime errors will also write consistent diagnostic text.

Keep these diagnostic fields admin-only. The admin list endpoint `/api/generations` will include them. The user-facing endpoint `/api/my/generations` will continue to omit them so ordinary users only see `failed`, not backend internals.

Add a backend-authoritative availability endpoint, `GET /api/my/generation-capacity`, that returns:

- `concurrencyLimit`
- `activeGenerationCount`
- `canGenerate`
- `reason`

The frontend will no longer infer generate availability from history load timing. Instead, the generate button starts disabled, remains disabled until the first successful capacity check, and polls the capacity endpoint every 5 seconds. After a generate request is submitted, the button immediately returns to a locked state and waits for subsequent capacity polling to reopen it. This removes the refresh-time race window entirely.

For the admin generation list, reuse the existing lightbox interaction pattern already used elsewhere in the web app. Thumbnail images become clickable, and successful records can open a fullscreen image preview. Failed records show the short error summary inline and allow expanding the detailed diagnostics without leaving the page.

**Data Flow**

- Backend failure capture writes `error_message` and `error_details` onto the same `generations` row.
- `/api/generations` returns these fields for admin use.
- `/api/my/generations` does not return them.
- `/api/my/generation-capacity` computes availability from the current user's `concurrency_limit` and the count of `pending/generating` jobs.
- `useGeneration` owns the frontend capacity polling state because it already owns generation actions and generation history.
- `GenerateConsole` renders from backend-reported availability instead of opportunistic local inference.

**Failure Detail Rules**

- Upstream HTTP failure:
  - `error_message`: concise summary such as `Upstream failed: 502`
  - `error_details`: status line plus truncated response body
- Upstream payload is structurally invalid:
  - `error_message`: concise summary such as `No image returned from provider`
  - `error_details`: payload shape or parse failure details when safe to record
- Image download or storage upload failure:
  - `error_message`: concise operational summary
  - `error_details`: downstream status/message or thrown error text
- Unexpected thrown errors:
  - `error_message`: short fallback summary
  - `error_details`: normalized exception text

To avoid unbounded row growth, `error_details` should be truncated to a fixed maximum length before storage.

**Frontend Availability Rules**

- Initial page load: generate button disabled
- Capacity request pending: generate button disabled
- Capacity response says `canGenerate = false`: generate button disabled
- User clicks generate: generate button disabled immediately, before history refresh
- Background polling interval: 5 seconds
- Backend remains the final authority because `POST /api/generate` still enforces the limit server-side

**Testing**

- Server tests for:
  - admin generation payload includes `errorMessage` and `errorDetails`
  - user generation payload still omits detailed diagnostics
  - failure paths persist diagnostic text
  - `GET /api/my/generation-capacity` returns correct availability
- Frontend behavior tests for:
  - generate button starts locked before capacity is known
  - capacity polling result controls whether the button can be used
  - submit action immediately relocks the button
- Admin UI verification for:
  - failed rows display summary and expandable details
  - image thumbnails open fullscreen preview

**Files Expected**

- `supabase/schema.sql`
- `admin/server/app.ts`
- `admin/tests/server-api.test.ts`
- `admin/src/lib/types.ts`
- `admin/src/pages/admin/AdminGenerations.tsx`
- `web/src/hooks/useGeneration.ts`
- `web/src/components/GenerateConsole.tsx`
- `web/src/lib/generation-ui.test.ts`
