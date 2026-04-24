# Generation Business Code Design

**Context**

Generation records currently use only the database primary key `id` internally and expose `pictureId` for the uploaded image asset. There is no stable business-facing generation code such as `gen_...`, which makes records harder to identify in the UI and in communication with users.

The user wants:

- a dedicated business generation code with a `gen_` prefix
- old generation records backfilled so the field is present everywhere
- both the generation code and image code to support click-to-copy in the UI

**Goals**

- Add a stable business-facing generation code without replacing the existing UUID primary key.
- Generate new codes in the same style family as `pictureId`.
- Backfill existing records so every generation has a `gen_...` code.
- Expose the generation code through admin and user generation APIs.
- Make both `generationCode` and `pictureId` clickable/copyable in the UI.

**Chosen Approach**

Keep the existing `public.generations.id uuid` as the database primary key and API routing identifier. Add a separate `generation_code text unique` field for business-facing display and copying.

For new generations, create the business code at generation creation time, using a format parallel to the current image code:

- `gen_<timestamp>_<suffix>`

For old generations, backfill `generation_code` in `supabase/schema.sql` so the field is populated for all existing rows during `npm run db:apply`. The backfill should only affect rows where `generation_code is null`, and must preserve uniqueness.

Return the new field from:

- `GET /api/my/generations`
- `GET /api/generations`

Keep all write routes, deletes, favorites, and internal references on the existing UUID `id`. This minimizes migration risk while giving the UI a stable, readable business identifier.

**Data Flow**

- Database stores:
  - `id` as internal UUID
  - `generation_code` as business-facing text
  - `picture_id` as image-facing text
- Backend maps `generation_code` to `generationCode` in API payloads
- Frontend renders both:
  - `gen: {generationCode}`
  - `pic: {pictureId}`
- Clicking either value copies the exact identifier to the clipboard

**Copy Interaction**

- `generationCode` and `pictureId` are both individually clickable
- Hover makes each code look interactive
- Click copies only the clicked code, not the entire row
- Visual feedback should be lightweight:
  - preferred: short inline `copied`
  - acceptable: existing toast feedback if inline state is awkward

**Backfill Rules**

- Add `generation_code text`
- Add uniqueness constraint or unique index
- Backfill only null rows
- Use a deterministic-enough timestamp/random composition to avoid collisions

**Testing**

- Backend tests for:
  - new generation payloads include `generationCode`
  - admin and user generation APIs both expose it
- UI verification for:
  - homepage history records show both `gen:` and `pic:`
  - console generation records show both `gen:` and `pic:`
  - admin generation records show both `gen:` and `pic:`
  - clicking either code copies the expected value

**Files Expected**

- `supabase/schema.sql`
- `admin/server/app.ts`
- `admin/tests/server-api.test.ts`
- `admin/src/lib/types.ts`
- `admin/src/pages/admin/AdminGenerations.tsx`
- `web/src/hooks/useGeneration.ts`
- `web/src/components/HistoryStream.tsx`
- `web/src/pages/console/ConsoleGenerations.tsx`
- `web/src/pages/Gallery.tsx`
