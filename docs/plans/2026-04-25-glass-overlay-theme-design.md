# Glass Overlay Theme Design

**Context**

The frontend now has multiple interactive overlays, including delete confirmation dialogs and overflow (`...`) menus. These currently work functionally but do not fully match the workshop’s core visual language. The user wants these overlays to inherit the same translucent, glass-like material feel as the workshop’s main input area rather than looking like default opaque menus and modal dialogs.

This requirement now applies to both:

- frontend workshop / console / gallery overlays
- admin generation-related overlays

**Goals**

- Give delete confirmation dialogs a half-transparent, blurred glass style.
- Give overflow dropdown menus the same glass material language.
- Keep interaction structure unchanged while updating the material system.
- Apply the same visual treatment to the admin generation page as well.

**Chosen Approach**

Create a shared overlay material treatment at the UI-primitive level where possible, then let pages inherit that styling automatically. This avoids page-by-page restyling drift and keeps future dialogs and menus aligned with the workshop surface language.

The glass material direction should inherit from the workshop input / `liquid-glass` aesthetic:

- translucent dark background
- backdrop blur
- thin, low-contrast border
- soft shadow
- subtle inner highlight
- bright but restrained hover feedback

Use this theme for:

- `AlertDialog` delete confirmations
- `DropdownMenu` overflow menus

If admin pages use the same menu/dialog primitives, they should automatically inherit the new style. If admin uses local containers around these primitives, only minimal local adjustments should be added, not a separate material system.

**Interaction Rules**

- Menus remain compact and readable.
- Delete confirmation stays small and focused, not a large modal sheet.
- Danger semantics remain clear, but the danger action should still feel part of the glass system instead of default solid-button styling.
- The menu surface should feel layered over the card, not like a detached opaque box.

**Visual Rules**

- Overlay backgrounds:
  - dark translucent base
  - `backdrop-blur`
  - light border with low opacity
- Hover states:
  - glow/brighten slightly
  - avoid heavy movement or cartoonish transforms
- Delete dialog:
  - tighter max width
  - smaller spacing
  - softer button styling
- Dropdown menu:
  - glass panel
  - glass hover items
  - subdued separators

**Application Scope**

- Workshop main-card `...` menu
- Console generation `...` menu
- Gallery `...` menu
- All delete-confirmation dialogs on those pages
- Admin generation-page `...` menu
- Admin generation-page delete confirmation

**Testing**

- Verify web build still passes after styling primitive changes.
- Verify admin build still passes after the same styling is applied there.
- Manual verification should confirm that:
  - delete dialogs feel like the workshop input family
  - dropdown menus feel like glass overlays instead of default panels
  - admin and frontend remain visually aligned

**Files Expected**

- `web/src/components/ui/alert-dialog.tsx`
- `web/src/components/ui/dropdown-menu.tsx`
- corresponding `admin` overlay/menu usage if local adjustment is required
- generation-related frontend and admin pages only if needed for small integration tweaks
