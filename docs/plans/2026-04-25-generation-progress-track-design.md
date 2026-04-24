# Generation Progress Track Design

**Context**

The current generate button now depends on backend-authoritative capacity checks, but the user does not want the 5-second polling cycle to be visible as a repeated "syncing" experience. The user also wants the progress indicator to stop behaving like a vague loading state and instead communicate discrete generation milestones that fill one by one.

At the moment, the UI still surfaces capacity polling too directly, and the progress model is split across multiple pieces of state that do not present a single, stable lifecycle to the user.

**Goals**

- Make the 5-second capacity polling effectively invisible after the first successful capacity check.
- Keep the generate button disabled only when generation is actually unavailable.
- Replace vague loading feedback with a fixed, step-based progress track.
- Fill exactly one progress segment per completed stage.
- Preserve explicit blocking when concurrency is full.

**Chosen Approach**

Use a fixed five-stage progress track for the generation lifecycle:

1. `资格通过`
2. `任务创建`
3. `进入队列`
4. `模型生成`
5. `结果返回`

The first stage represents backend authorization to start generation. It is only unresolved before the first capacity check completes. Once the first backend capacity check succeeds, later 5-second polling becomes silent background synchronization. The UI should not revert the first stage back to a visible "checking" state during those later refreshes.

After the user clicks generate, the button immediately locks again, but the UI should present that lock as forward progress, not as a return to a generic sync state. The progress track should move from `资格通过` to `任务创建`, then derive subsequent stages from the latest generation record state:

- `pending` => `进入队列`
- `generating` => `模型生成`
- `completed` => `结果返回`
- `failed` => `结果返回` in a failure style

If backend polling later reports `canGenerate = false` because concurrency is full, the button becomes disabled, but the progress track does not reset or flash. Instead, a small adjacent hint communicates the block reason, such as `当前并发已满`.

**Interaction Rules**

- Initial page entry:
  - Button disabled until the first `generation-capacity` response arrives.
  - Progress track remains unresolved at stage 1 without flashing status text.
- First successful `canGenerate = true`:
  - Stage 1 fills.
  - Button becomes clickable.
- Later 5-second polling:
  - Updates internal availability silently.
  - Does not regress the visible progress track.
  - Does not replace the button label with a polling-specific message.
- User clicks generate:
  - Button locks immediately.
  - Stage 2 fills once the request is accepted.
  - Later stages fill from the persisted generation status.
- Concurrency full:
  - Button disabled.
  - Progress track remains stable.
  - Auxiliary hint explains the block.

**State Mapping**

- `资格通过`
  - Source: first successful backend capacity confirmation
- `任务创建`
  - Source: generate request accepted / generation id returned
- `进入队列`
  - Source: newest generation record `status = pending`
- `模型生成`
  - Source: newest generation record `status = generating`
- `结果返回`
  - Source: newest generation record `status = completed | failed`

For failures:
- stages 1 through 4 remain completed if already passed
- stage 5 becomes failed rather than successful
- helper text becomes `生成失败`

For successful completion:
- stage 5 fills normally
- helper text becomes `结果返回`

**Testing**

- Extend the frontend pure-logic tests so they verify:
  - initial capacity state keeps stage 1 unresolved and button disabled
  - later silent polling does not regress already completed visible progress
  - `pending`, `generating`, `completed`, and `failed` map correctly onto the five-stage track
- Keep build verification on the web app after the logic and UI changes.

**Files Expected**

- `web/src/lib/utils.ts`
- `web/src/lib/generation-ui.test.ts`
- `web/src/hooks/useGeneration.ts`
- `web/src/components/GenerateConsole.tsx`
- `web/src/pages/Home.tsx`
