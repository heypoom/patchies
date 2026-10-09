# 195. Music code containers

Strudel, Csound, and ChucK share a code container with two persisted layouts:
Editor (the default) and Compact. Expanded Editor remains a temporary fullscreen
view; closing it restores the previous layout and editor dimensions.

## Layout and controls

- Editor uses floating title and action controls above the code viewport,
  without an embedded header. ChucK keeps Replace, Add, and
  Remove visible outside the scrolling code area. Its shred Settings button
  is a direct action in Editor mode; Compact keeps Settings in the node menu.
- Compact reuses the JS code action button and floating title/menu chrome.
  Clicking the body follows the default editor-layout preference; Shift-click
  chooses the alternate layout. Inline inspection opens to the right without
  enlarging the node. The inspection viewport is absolutely positioned outside
  the compact body; XYFlow's measured node bounds remain 100 × 42 pixels.
  The inspection toolbar puts Keep Editor in Patch and Expand Editor inside
  its overflow menu. These actions never appear as standalone toolbar buttons.
  Keep Editor in Patch switches back to the persisted Editor layout.
- The overflow menu provides Hide Code, Expand Editor, Enable/Disable Resizing,
  and object-specific actions. Editor mode shows only the overflow trigger
  beside its floating runtime controls. Csound exposes Sync to transport directly
  first in Overflow as a Sync/Unsync icon action, followed by Expand Editor,
  Show/Hide Editor, and Enable/Disable Resizing. ChucK uses the same order
  without transport sync and has no Settings entry in Editor mode.
  Expand is reachable from both layouts, including when code is empty.
- Editors start at 400 × 240 logical canvas pixels. Resizing changes width and
  height with a minimum of 320 × 120. The standard XYFlow NodeResizer appears
  on selected inline editors when resizing is enabled. Compact inspection uses the saved size.
- Code viewport dimensions are independent of content, wrapping, and font size.
  Code scrolls inside the viewport. Disabling resizing locks its current size.

## Strudel settings

Strudel shows Settings and Overflow beside playback controls, including in
fullscreen. Overflow is ordered Mute/Unmute, Show/Hide Console, Expand Editor,
then Show/Hide Editor. Compact adds Settings after these actions. Resizing moves into Settings alongside transport sync, font size,
font family, and Custom Styles. Settings and the console are mutually exclusive;
automatic console opening on errors also dismisses Settings. In standalone
Editor mode, Settings occupies the same right-side panel slot as the console,
aligned with the editor’s top edge. It stays open while editing code and has
a close button; the Settings action also toggles it. The panel reuses
ObjectSettings’ floating shell, compact width, spacing, and scroll behavior;
Strudel’s controls use its toggle and input styling.

Compact shows only the overflow trigger, with Settings inside its menu.
Opening Settings from compact Overflow hides code inspection and places the
settings panel at the side editor’s position. Opening code inspection dismisses
that panel. The Settings button above the floating side editor instead opens
a popover anchored to that button, keeping the compact inspection editor visible.
Fullscreen opens Settings as a persistent panel on the right. Its Settings
button toggles that panel, and showing the console replaces it.

Normal font size uses `fontSize`; expanded font size uses `expandedFontSize`.
Each falls back to the corresponding global editor preference (12px and 28px
by default). Expanded size must exceed normal size. The panel edits the size
for its current layout, with independent history. `setFontSize` changes normal
size, and `setExpandedFontSize` changes expanded size, regardless of current layout.

Font family uses `fontFamily`; Custom Styles opens a small CSS
editor dialog for the declarations in `styles.container`. These are the same
node fields written by messages. Incoming messages update open controls and
the CSS editor. Changes persist and support undo/redo. Fullscreen shares these
settings and menus, and Escape dismisses an open panel or dialog before exiting
fullscreen. The CSS dialog applies edits live without evaluating Strudel code.
In normal and compact inspection layouts, container CSS targets the outer
editor viewport, so `border: none` removes its chrome border. In fullscreen it
targets the detached container. Styles apply once per visible editor; border
and padding changes remain inside the fixed viewport dimensions. The separate
NodeResizer outline remains available.

## Persistence and lifecycle

`editorCollapsed`, `editorSize`, and `editorResizingEnabled` are node data.
Layout, size, and resize-lock changes support undo/redo. A drag is one size
change. Temporary right-side inspection is local view state.

Hiding code never stops playback, clears shreds, or disconnects ports. In
particular, Strudel's editor/runtime stays mounted while hidden and retains its
existing fullscreen portal. Csound and ChucK retain their existing audio runtime
and fullscreen host. Sidebar editing remains available.

`setCode` updates saved code in every layout without executing it. Existing
language-specific Run, Add, Replace, and playback messages keep their semantics.
Csound and ChucK store code in `expr`; Strudel stores it in `code`.

## Implementation

The shared components, layout types, tests, and test fixtures live together in
`ui/src/lib/music-code-layout/`. A shared container owns floating controls,
viewport, compact inspection, sizing, and menu.
A shared code-editor adapter connects Csound and ChucK to CodeMirror, sidebar,
and fullscreen targets. Object components supply runtime controls, ports, status,
and settings. Strudel supplies its specialized editor as a persistent snippet.

Validation covers layout switching, retained editor/runtime mounts, bounded
content, zoom-aware resizing, resize locking, history commits, fullscreen return,
and code updates while compact.
