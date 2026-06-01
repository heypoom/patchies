# 148. Code Editor Detached Layouts

## Goal

Add shared detached layouts for node code editors so Patchies can support live
coding workflows where code is large, focused, and optionally overlaid on top of
the background output.

This changes the mental model of `CodeEditor.svelte` from "the node's editor" to
"one editor accessor for a code field." The durable source of truth remains the
node data field, usually `node.data.code`, while inline, overlay, and sidebar
editors are different views that can edit the same field.

## Motivation

Live coding performances often make the code itself part of the visual output:
large text, custom typography, and editor UI that sits front-and-center instead
of beside a small node preview.

Patchies currently renders most code editors inline with the node, usually to the
right of the preview or object body. That layout is good for patch building, but
it is cramped for performance, screen sharing, and focused editing.

Detached editor layouts should support:

- a transparent "Zen" overlay above the background output
- a focused sidebar editor that uses the existing `SidebarPanel` system
- future display-only or performance-oriented code views

The first implementation focuses on visual code nodes that already use
`CanvasPreviewLayout`, JS-style code block nodes that share `CodeBlockBase`, and
simple DSP code nodes that share `SimpleDspLayout`. Most expression-style nodes
such as `CommonExprLayout` do not need detached editing initially because their
inline editors are already compact. Longer live-coding expression nodes can opt
in when their `expr` field benefits from the same focused editor, starting with
`chuck~` and `bytebeat~`.

## Source Of Truth

Node data remains the source of truth for editable code.

```typescript
interface CodeEditorTarget {
  nodeId: string;
  dataKey: string; // usually "code", but also "expr", "prompt", etc.
  language: SupportedLanguage;
  nodeType?: string;
  title?: string;
  mode: "overlay" | "sidebar";
}

type EditorLayoutPreference = "inline" | "overlay" | "sidebar";
```

All editor accessors read from and write to the active node's `data[dataKey]`
through the same node data update path used by inline editors.

`CodeEditor.svelte` should stay a reusable CodeMirror wrapper. It owns
CodeMirror view creation, local editor events, error decorations, keybindings,
and commit events, but it does not own the durable code value.

## Behavior

- Only one detached editor target is active at a time.
- Opening detached mode for a node stores `{ nodeId, dataKey, language,
nodeType, title, mode }` in a shared store.
- Code editor chrome in `CanvasPreviewLayout` exposes an expand action that opens
  the current code field in overlay mode.
- The user's default editor layout decides whether opening a visual node editor
  starts inline, opens the overlay, or opens the sidebar editor directly.
- `Shift+click` on the visual node code edit action opens the alternate layout
  for that invocation: inline defaults open overlay, and overlay defaults open
  inline, while sidebar defaults open overlay.
- Strudel editor views hide line-number gutters in both inline and detached
  layouts so pattern code stays visually central.
- While a detached editor is active for a node field, the inline editor for that
  same field is hidden or replaced with a compact "editing elsewhere" affordance.
- Closing detached mode clears the active target and allows the inline editor to
  render normally again.
- Editing in detached mode updates `node.data[dataKey]` continuously, matching
  current inline editor behavior.
- Detached editing can also invoke an optional target-specific change callback
  after updating node data, so expression editors with live side effects such as
  `bytebeat~` can keep their "run on edit" behavior in fullscreen.
- Blur commits still emit the existing `codeCommit` event so undo/redo records a
  single focused editing session.
- `Shift-Enter` should run the same node action as the inline editor where the
  node provides one.
- Deleting the target node closes detached mode.
- If the target node's data changes externally, the detached editor receives the
  new value through the existing `value` prop sync path.
- If the target node's settings schema or values change externally while
  detached mode is open, the detached settings panel receives the current schema
  and values without requiring the user to close and reopen detached mode.
- If no background output is active when overlay mode opens, the edited node
  becomes a temporary output override only when it is compatible with the
  render graph. DOM/main-thread editors such as `p5`, `canvas.dom`, `dom`, and
  `vue` do not become background output targets automatically.
- Temporary output overrides are cleared on exit, but existing `bg.out`
  connections or user-selected output overrides are preserved.

## Layouts

### Overlay

The overlay editor is rendered once near the canvas shell, above the background
output and above `SvelteFlow`.

Expected presentation:

- fullscreen transparent editor background
- large configurable font size
- ample padding so the code reads well on a projected output
- code editor spans the screen with no outer margin, panel border, or title
- close and run buttons sit inside the fullscreen editor padding
- close, run, settings, and custom action buttons honor device safe-area insets
  so they remain tappable on phones with notches or system gesture regions,
  including portaled Orca and Strudel detached editors
- a settings button appears when the target object exposes settings; it opens a
  small floating settings panel below the button
- `Shift+Esc` closes the expanded editor, matching surface expand mode
- configurable editor transparency
- optional line wrapping
- minimal chrome, with close and layout-switch controls where available
- `nodrag`, `nopan`, and `nowheel` behavior so XYFlow does not consume editor
  interactions

The overlay should reuse the existing fullscreen UI-hiding infrastructure used by
surface expand mode. It should set `isFullscreenActive` while open and close the
sidebar so the rest of the Patchies UI is hidden during focused editing.

### Sidebar

Add a `code` view to `SidebarView` and render a code editor panel inside
`SidebarPanel`.

The sidebar editor uses the same active target store. Switching a target to
sidebar mode should open the sidebar, select the `code` tab, and render the
editor there.

Sidebar mode is useful for focused editing without covering the background
output. Unlike overlay mode, opening the sidebar editor should not create a
temporary background output override.

## Settings

Add editor layout preferences to `SettingsModal.svelte`.

Initial settings:

- Default editor layout: `Inline`, `Overlay`, or `Sidebar`
- Overlay editor transparency
- Code editor font family
- Code editor font size for inline and sidebar layouts
- Fullscreen editor font size for overlay layout; this should stay separate from
  the inline/sidebar font size so expanded editing can remain intentionally
  larger.

Settings should live in a dedicated store under `src/stores/`, not directly in
the settings modal component. The default editor layout is user preference state,
not patch data.

## Architecture

### Store

Create a dedicated store under `src/stores/`, for example
`code-editor-layout.store.ts`.

Responsibilities:

- hold the active `CodeEditorTarget | null`
- expose helpers such as `openOverlay(target)`, `openSidebar(target)`, `close()`
- expose `isDetachedTarget(nodeId, dataKey)` so node components can hide their
  inline editor when needed
- avoid localStorage initially; layout state is session UI state, not patch data

Create a separate persisted settings store for editor layout preferences, for
example `editor-layout-settings.store.ts`.

Responsibilities:

- hold the default editor layout preference
- hold the overlay transparency preference
- persist user preferences to localStorage

### Shared Shells

Add dedicated presentation components:

- `DetachedCodeEditorOverlay.svelte`
- `SidebarCodeEditorView.svelte`

Both components resolve the active node and code value from the canvas state,
then pass normal props into `CodeEditor.svelte`.

### Inline Integration

Node components should not duplicate detached-editor logic. The first integration
point should be `CanvasPreviewLayout`, because it is already shared by the visual
objects that benefit most from performance-oriented code display.

Prefer a small helper or wrapper around existing code-editor render paths so
common nodes can ask:

```typescript
const isEditingElsewhere = isDetachedTarget(nodeId, dataKey);
```

For the first pass, wire the behavior through `CanvasPreviewLayout` consumers
before handling one-off custom nodes.

## Undo And Concurrency

Use option 1: do not allow two visible editor accessors for the same node field.

When detached mode is active for a node field, hide the inline editor for that
field. This avoids cursor synchronization, double focus state, and ambiguous blur
commits.

Undo/redo should continue to use the existing `codeCommit` event emitted by
`CodeEditor.svelte` on blur. Because only one accessor is visible for a field,
each focused editing session maps cleanly to one undo command.

## Run Action

The main unknown is how consistently node-specific run behavior is exposed today.
Some nodes pass local `onrun` callbacks directly into `CodeEditor.svelte`.

Implementation should avoid hardcoding run behavior in the detached editor. Good
options:

1. Register an optional run callback in the active target when opening detached
   mode.
2. Route run requests through a node-level service if one already exists or is
   introduced later.
3. Omit detached `Shift-Enter` from the first prototype for node types where the
   run action is not available.

The first implementation should pass `onrun` through where the shared layout
already has access to it. Nodes that cannot expose run cleanly can still edit in
overlay mode, but `Shift-Enter` does not need to work for those nodes until their
run path is traced.

## Scope

First pass:

- shared active detached-editor target store
- overlay editor for `CanvasPreviewLayout`, `CodeBlockBase`, and
  `SimpleDspLayout` consumers
- sidebar editor for `CanvasPreviewLayout`, `CodeBlockBase`, and
  `SimpleDspLayout` consumers
- opt-in detached editing for longer expression editors such as `chuck~` and
  `bytebeat~`, using `dataKey: "expr"` and the same node run callback as the
  inline editor
- Settings modal option for default editor layout: `Inline`, `Overlay`, or
  `Sidebar`
- Settings modal option for overlay editor transparency
- hide inline editor while detached overlay is active
- compact inline affordance showing that the editor is open in expanded view
- close behavior when target node is removed
- preserve undo/redo commit behavior

Follow-up:

- layout switch between overlay and sidebar
- typography controls for performance mode beyond the first overlay defaults
- persisted user preferences for font size, line wrapping, and chrome density
- broader support for node-specific run callbacks

## Files Likely Touched

- `ui/src/lib/components/CodeEditor.svelte`
- `ui/src/lib/components/CanvasPreviewLayout.svelte`
- `ui/src/lib/components/FlowCanvasInner.svelte`
- `ui/src/lib/components/settings-modal/SettingsModal.svelte`
- `ui/src/lib/components/sidebar/SidebarPanel.svelte`
- `ui/src/stores/ui.store.ts`
- `ui/src/stores/code-editor-layout.store.ts`
- a dedicated settings store for editor layout preferences
- common node layout components that feed `CanvasPreviewLayout`

## Testing

Unit or component coverage should verify:

- opening detached mode stores the correct active target
- closing detached mode clears the target
- default editor layout setting opens visual code editors inline or in overlay
- inline editor is hidden for the active detached node field
- editing through detached mode updates the node data field
- blur emits a single undo/redo commit for the edited field
- deleting the target node closes detached mode

Manual verification should cover:

- overlay editor renders above background output
- editor wheel and drag interactions do not pan or zoom the canvas
- large font, ample padding, and transparent background remain readable over
  visual output
- overlay transparency setting changes the editor background opacity
