# Frontend Action Unification Design

**Context**

The frontend now has multiple generation-related surfaces with overlapping but inconsistent interaction models:

- the workshop homepage main generation card
- the console generation history
- the gallery / archive view

The user wants these areas to feel more intuitive and more unified. Specific pain points include:

- the console page header does not prioritize the expected "back to workshop" action
- the left-side metadata layout in generation cards feels cramped
- the workshop main image actions do not fully match the generation-history action model
- there is no expandable overflow action menu for download / copy-link / image-edit actions
- delete is still one-click instead of confirm-first

**Goals**

- Make the console header immediately read as "return to workshop".
- Improve left-column readability for generation cards.
- Align workshop main image actions with generation history actions.
- Add a consistent overflow (`...`) menu with:
  - download
  - copy image link
  - image edit
- Route `image edit` back into the workshop with the current image as the edit reference.
- Add delete confirmation across frontend generation surfaces.

**Chosen Approach**

Use the current generation-card structure as the base interaction model and standardize action placement instead of performing a larger component abstraction. This keeps the scope tight while still making the workshop main card, console generation cards, and gallery cards feel related.

For console navigation, replace the current top-left `控制台` brand treatment with a clear `返回工坊` affordance. The existing sidebar bottom link becomes redundant and should be removed to avoid duplicate exits.

For card interactions, use a two-layer model:

- persistent quick actions in the image panel’s top-right corner
- a `...` overflow trigger that opens a menu

The overflow menu contains:

- `下载`
- `复制图片链接`
- `改图`

`改图` means: navigate back to the workshop and enter an edit mode with the current image as the reference image, while also carrying over the current prompt where available.

Delete becomes confirm-first everywhere on the frontend:

- workshop main record
- console generation records
- gallery records

Use a single visual confirmation pattern, preferably the existing alert dialog primitives already available in the codebase.

**Layout Rules**

- Workshop main card and console generation cards stay visually aligned.
- Left-column metadata is reordered for clearer reading:
  - ratio / time
  - engine / strength
  - copyable `gen:` / `pic:`
  - five-stage progress track
  - prompt text
- Image quick actions remain in the top-right.
- Overflow menu appears in the same top-right action area.

**Interaction Rules**

- `...` menu is shown for completed images only.
- `改图` is shown only when the card has a usable image.
- `复制图片链接` copies the public image URL, not the generation code.
- `下载` uses the current image URL directly.
- Delete always requires explicit confirmation before the destructive action runs.

**Workshop Edit Hand-Off**

- Trigger source: workshop main image / console generation / gallery item
- Navigation target: workshop homepage
- Payload:
  - reference image URL
  - original prompt when available
- Result:
  - workshop opens directly in image-edit mode
  - user does not need to upload the image manually again

**Testing**

- Web build must pass after layout and menu changes.
- Existing pure generation logic tests should remain green.
- Manual verification should cover:
  - header now reads/acts as `返回工坊`
  - delete requires confirmation
  - `...` menu appears and performs the three actions
  - `改图` actually returns to the workshop with the image reference loaded

**Files Expected**

- `web/src/pages/console/ConsoleLayout.tsx`
- `web/src/components/HistoryStream.tsx`
- `web/src/pages/console/ConsoleGenerations.tsx`
- `web/src/pages/Gallery.tsx`
- `web/src/pages/Home.tsx`
- `web/src/components/GenerateConsole.tsx`
- `web/src/App.tsx`
- `web/src/hooks/useGeneration.ts`
- `web/src/components/ui/alert-dialog.tsx`
- existing dropdown/menubar primitives where helpful
