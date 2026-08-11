# 174. Browse-First Object Catalog

## Problem

The object browser is Patchies' discovery surface. The Enter menu already covers recall-driven,
type-to-insert workflows on desktop, while touch devices depend on the browser as their primary way
to add objects.

The current browser expands every enabled object and preset category into one scroll container. As
more packs are enabled, presets move far below the first viewport and discovery becomes a long scan.
Pack administration also shares the same hierarchy as insertion, and enabled packs repeat the Ember
accent until it stops communicating priority.

## Product Model

The two insertion surfaces have separate jobs:

- **Enter menu:** recall-driven insertion for an object the user already knows.
- **Object browser:** recognition-driven exploration of objects and presets.

The browser remains searchable, but search filters the catalog rather than turning the browser into
another command palette.

## Catalog Information Architecture

### Primary Workspaces

Expose **Objects** and **Presets** as equal, persistent workspaces above the fold. Switching workspace
changes the visible categories and results without mixing every category into one page.

Each workspace has:

- a category navigator;
- one active category at a time;
- a result grid using the existing object/preset cards;
- category counts and an active-category summary;
- search scoped to the current workspace.

The initial Objects category is the first enabled object category. The initial Presets category is the
first enabled preset pack or preset library category.

### Desktop

Use a two-pane catalog:

- a compact left rail for the Objects/Presets switch, categories, Help mode, and library management;
- a flexible right pane for the active category's cards;
- independent overflow so the category list and results remain bounded by the modal viewport.

### Mobile and Touch

Use a full-screen catalog:

- keep Objects/Presets and search sticky;
- render categories as a horizontally scrolling chip row;
- show only the active category's results;
- use controls and insertion cards with at least 44px touch targets;
- avoid automatically opening the software keyboard on arrival.

The card itself remains the insertion target. Tapping a card inserts it and closes the browser.

## Search

Search filters categories and cards inside the active Objects or Presets workspace. Keep the category
navigator visible so matches retain their context. If the current category has no matches, display the
first matching category. Do not expand every matching category into one result wall.

On fine-pointer devices, focus and select the search field when the catalog opens so keyboard users
can type immediately. Do not automatically open the software keyboard on touch devices.

When an object search has no enabled result, preserve the existing disabled-object recovery and
“Enable & Add” path.

## Library Management

Library management is secondary to insertion and opens from a clearly labeled **Manage library**
action.

- Provide **Object Packs** and **Preset Packs** as adjacent tabs above the fold.
- Render only the selected pack type at a time.
- Keep explicit **Disable all** and **Enable all** actions visible together.
- Keep enabled packs visually neutral with a quiet check state.
- Reserve Ember for the selected pack, focus, search matches, and primary actions.
- The pack card body changes enablement so bulk scanning and toggling uses the largest target. Treat
  the checkbox as its state indicator. A separate full-width footer opens the pack inspector.
- Keep the pack grid stable when inspecting contents. On desktop, permanently reserve an attached
  right-hand inspector and show a quiet selection prompt before a pack is chosen. On touch layouts,
  selection opens an immediate bottom sheet over the pack grid.
- The inspector identifies the selected pack, preserves its description and item count, and presents
  its objects or presets as a scannable ordered list. It must never render after the final grid row.

## Help

Help remains a secondary mode available from the catalog rail. Entering Help switches to Objects,
hides presets, and changes the card action from insertion to opening object help. Preserve the direct
desktop help affordance on object cards.

## Accessibility

- Give the dialog a real heading and accessible name.
- Give search a persistent accessible label, not placeholder-only labeling.
- Use semantic buttons for categories, pack enablement, details, insertion, and close.
- Avoid nested or duplicate button roles from tooltip triggers.
- Preserve visible focus and logical keyboard order.
- Announce active workspace and Help state through native selected/pressed semantics.

## Visual Direction

Use the restrained Zinc modal system. Enabled availability is neutral. Ember is scarce and signals
the user's current position or action. Use IBM Plex Sans weights up to 500 unless a later design brief
explicitly asks for a heavier weight.

## Verification

- Objects and Presets are both visible without scrolling on desktop and mobile.
- Only one category's cards are rendered in the result pane at a time.
- Search never creates one vertically concatenated list of every matching category.
- Preset Packs are accessible above the fold in Manage Library.
- Pack enablement and details work with keyboard and touch.
- Desktop, 390px, and 320px layouts have no horizontal overflow.
- Touch controls are at least 44px where they are primary interactions.
- Disabled-object search recovery, Help mode, and pack persistence continue to work.
