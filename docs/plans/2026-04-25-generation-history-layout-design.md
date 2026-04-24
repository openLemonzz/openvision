# Generation History Layout Unification Design

**Context**

The frontend currently has two visually different generation-history surfaces:

- the homepage `HistoryStream`
- the console `ConsoleGenerations`

Recent progress-track work temporarily placed the five-stage progress UI below the generate button, but the intended presentation is inside each generation card, replacing the existing metadata-side lifecycle bar. The user also wants the image actions to move into the top-right corner of the image panel, matching the interaction language already used by `Gallery`.

**Goals**

- Unify the layout of homepage and console generation cards.
- Move the five-stage progress track into the left metadata panel for all generation records.
- Remove the button-level progress-track presentation.
- Place image actions in the top-right corner of the image panel.
- Keep the two pages structurally identical while preserving page-specific actions.

**Chosen Approach**

Keep both pages on the same two-column card structure:

- left column: metadata and progress track
- right column: image or generation placeholder

Replace the old `LifecycleBar`/expiration-style bar in the left column with the new fixed five-stage generation progress track:

1. `资格通过`
2. `任务创建`
3. `进入队列`
4. `模型生成`
5. `结果返回`

The progress track will be rendered per record, not at the button level. Existing records map naturally:

- local optimistic placeholder before backend confirmation => `requesting`
- `pending` => through `进入队列`
- `generating` => through `模型生成`
- `completed` => fully complete
- `failed` => last stage marked failed

For completed images, move the actions to a compact top-right overlay that appears on hover, consistent with `Gallery`. This keeps the image surface visually clean while making actions discoverable. The actions differ slightly per page but occupy the same location:

- Homepage: `放大 / 重混 / 删除`
- Console generations: `放大 / 收藏 / 删除`

For `pending`, `generating`, and `failed` cards, keep the same panel structure and reserve the top-right action area with only the actions that still make sense, so the layout does not jump between states.

**Layout Rules**

- Homepage and console use the same card skeleton and spacing.
- Progress track belongs in the left metadata panel for every record.
- The generate button returns to being just a button plus a small auxiliary availability hint.
- The image panel owns all image-specific actions.
- The old lifecycle/expiry bar is removed from these two views.

**Interaction Rules**

- Clicking the image still opens the lightbox where supported.
- Top-right action buttons stop propagation so they do not trigger the underlying image click.
- Hover opacity and placement should match the `Gallery` interaction language as closely as possible without introducing a shared abstraction in this step.

**Testing**

- Reuse the pure progress-track logic tests already added for stage mapping.
- Verify the web build succeeds after both `HistoryStream` and `ConsoleGenerations` adopt the unified card layout.
- Rebuild the `web` container after implementation so the running site reflects the new layout.

**Files Expected**

- `web/src/components/GenerateConsole.tsx`
- `web/src/components/HistoryStream.tsx`
- `web/src/pages/console/ConsoleGenerations.tsx`
- `web/src/hooks/useGeneration.ts`
- `web/src/lib/utils.ts`
