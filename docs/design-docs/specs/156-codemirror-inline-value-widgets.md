# 156. CodeMirror Inline Value Widgets

## Goal

Add lightweight inline controls to Patchies CodeMirror editors so creative-code
values can be recognized, previewed, and adjusted without leaving the source.

This is inspired by Bret Victor-style direct manipulation and shader editors
that expose numeric and color values inline. The code remains plain JavaScript
or GLSL. Widgets are editor affordances layered on top of source text, not a new
structured-editing format.

## Motivation

Patchies users often tune values by repeatedly editing literals, running code,
and watching the visual result. That workflow is expressive, but small numeric
changes are tedious when the user has to select text, type, rerun, and repeat.

Inline value widgets should make obvious literals feel touchable:

- numeric literals can be nudged by dragging
- normalized 2D values can show an XY-pad affordance
- normalized 3D values can show a color swatch

The editor should still feel like a code editor. Users should be able to ignore
the widgets entirely and type as usual.

## Initial Scope

Support JavaScript and GLSL CodeMirror editors.

Recognized literals:

- integers and floats in JavaScript and GLSL
- `vec2(x, y)` in GLSL when both components are numeric literals
- `vec3(r, g, b)` in GLSL when all components are numeric literals
- `[x, y]` in JavaScript when both entries are numeric literals
- `[r, g, b]` in JavaScript when all entries are numeric literals
- `vec3(r, g, b)` and `color(r, g, b)` in Shader Park JavaScript editors when
  all arguments are numeric literals
- GLSL literals inside recognized GLSL-in-JS template strings, reusing the
  existing GLSL-in-JS detection rules

Normalized vector affordances:

- `vec2(...)` and `[x, y]` values with all components in `0.0..1.0` show an
  XY-pad cue.
- `vec3(...)` and `[r, g, b]` values with all components in `0.0..1.0` show a
  color swatch cue.
- Values outside `0.0..1.0` remain editable as individual numeric literals, but
  do not show normalized XY or color affordances.

## Behavior

### Passive Cues

When the activation modifier is held and the pointer hovers a recognized value,
the editor shows a compact inline affordance for that value:

- a small square or crosshair cue next to normalized 2D values
- a small color swatch next to normalized 3D values

Hovering without the activation modifier should not show value widgets. The cue
should be scoped to the hovered value so the editor does not turn into UI soup
while the user is reading code.

Widgets should not replace the source text. The literal remains visible and
editable.

Scalar numbers do not show an always-visible passive cue. When the activation
modifier is held and the pointer is over a recognized scalar number, that number
is underlined to show that it can be dragged.

### Dragging Numbers

Holding Option on macOS or Control on other platforms while dragging up/down on a
recognized numeric literal changes that literal.

Expected behavior:

- Up increases the value.
- Down decreases the value.
- The source text updates while dragging so the running node can respond through
  the existing editor change path.
- The literal's visible precision is preserved when possible. For example,
  `1.00` should keep two decimal places while dragging, and `3` should stay an
  integer unless the interaction explicitly enters fractional mode in a later
  version.
- Negative values and decimal values are supported.
- Exponential notation is out of scope for the first implementation.
- Dragging should focus the editor before the first edit so the existing
  `codeCommit` blur behavior can record the old and new source for undo/redo.

Because Patchies usually does not know the intended range of a scalar literal,
the first scalar interaction is a draggable number editor, not a slider with
invented min/max limits.

### Vector Widgets

For normalized 2D values, the first implementation underlines the `vec2(...)`
or array source while the activation modifier is held and the value is hovered.
Option/Control-clicking that underlined value opens an editor overlay grid for
direct 2D dragging without being clipped by the CodeMirror scroller.
Clicking outside the grid or Option/Control-clicking the same underlined value
again closes the grid.

For normalized GLSL `vec3(r, g, b)` values and Shader Park JavaScript
`vec3(r, g, b)` / `color(r, g, b)` values, the first implementation shows the
RGB color represented by the value. Option/Control-clicking the hovered color
opens a native color picker and writes the selected color back to the three
normalized component literals. JavaScript `[r, g, b]` colors keep the passive
swatch cue for now, but do not open the color picker in this scope.

### Keyboard And Pointer Rules

- Use CodeMirror keymap conventions for keyboard commands and DOM event handlers
  for pointer interactions.
- Treat Option on macOS and Control on Windows/Linux as the activation modifier
  for direct manipulation. Avoid Control-click on macOS because browsers and the
  OS commonly treat it as a secondary-click context-menu gesture.
- Do not consume normal clicks, selection, cursor movement, text editing, or
  completion interactions when the modifier is not held.
- Pointer interactions must stop propagation to the canvas while active so
  XYFlow does not pan or drag the node.
- Widgets must be usable in inline, overlay, and sidebar editor layouts.
- Avoid native `title` tooltips. If explanation is needed, use CodeMirror
  tooltip/popover UI or accessible labels.

## Architecture

Create a focused CodeMirror extension, for example:

```text
ui/src/lib/codemirror/value-widgets.ts
```

Responsibilities:

1. Walk the CodeMirror syntax tree for visible ranges.
2. Detect supported literals and collect their source ranges.
3. Render widget decorations next to recognized values.
4. Handle modified pointer drag interactions.
5. Dispatch source text edits through `view.dispatch({ changes })`.

The extension should be added through `loadLanguageExtension()` for JavaScript
and GLSL so all normal Patchies editor placements receive the same behavior.

`CodeEditor.svelte` should remain a reusable wrapper around CodeMirror. It may
add shared theme styles for the widgets, but it should not own parsing or widget
business logic.

## Detection

Detection should prefer syntax-tree structure over broad regular expressions.

For GLSL:

- Use `syntaxTree(view.state)` from the active GLSL language.
- Detect `Number` nodes.
- Detect `CallExpression` nodes whose callee is `vec2` or `vec3` and whose
  arguments are numeric literals.

For JavaScript:

- Use the JavaScript syntax tree.
- Detect `Number` nodes outside strings, comments, and template text.
- Detect array expressions with exactly two or three numeric literal entries.
- When inside recognized GLSL-in-JS template ranges, apply GLSL detection rather
  than normal JavaScript array detection.

The implementation should reuse existing GLSL-in-JS helpers where practical, so
completion, hover hints, and value widgets agree about which template strings
are GLSL.

## Formatting

When a widget changes source text, it should preserve the user's original style
where reasonable:

- preserve integer vs float form
- preserve decimal precision
- preserve signs
- preserve surrounding whitespace and commas
- replace only the numeric token being edited

Vector-level interactions should replace only the component tokens, not the
entire `vecN(...)` call or array expression, unless the source shape is already
too malformed to edit safely.

## Integration With Existing Systems

Inline widget edits should flow through the same path as typed CodeMirror edits:

- `EditorView.updateListener` updates node data continuously.
- GLSL widget edits trigger the editor's run action after updating source text
  so shader changes are visible while dragging.
- Shader Park widget edits trigger the editor's run action after updating source
  text so procedural shapes and colors update while tuning literals.
- Body-level overlays, such as the XY grid, remeasure their editor anchor when
  the XYFlow viewport pans or zooms so the overlay does not drift away from the
  transformed editor.
- `Shift-Enter` and existing run behavior remain unchanged.
- Blur emits the existing `codeCommit` event for undo/redo tracking.
- Error line decorations, hover hints, autocomplete, Vim mode, line wrapping,
  and detached editor layouts continue to work.

If a widget interaction starts while the editor is unfocused, focus the editor
and capture the pre-drag document before dispatching the first change.

## Performance

The extension should scan visible ranges, not the whole document on every view
update, unless the file is small enough that a whole-document scan is clearly
cheaper and simpler.

Recompute decorations on:

- document changes
- viewport changes
- syntax tree changes

Do not parse JavaScript or GLSL manually on every pointer move. Pointer drags
should update known source ranges from the active interaction.

## Testing

Add focused tests for detection and source editing helpers.

Useful test coverage:

- GLSL scalar numbers are detected.
- GLSL `vec2(0.25, 0.75)` is detected as a normalized 2D value.
- GLSL `vec3(1.0, 0.5, 0.0)` is detected as a color value.
- GLSL `vec3(1.5, 0.5, 0.0)` does not show a color swatch because one
  component is outside `0.0..1.0`.
- JavaScript `[0.25, 0.75]` is detected as a normalized 2D value.
- JavaScript `[1.0, 0.5, 0.0]` is detected as a color value.
- Normal JavaScript strings are ignored.
- Recognized GLSL-in-JS template strings use GLSL detection.
- Number formatting preserves integer and decimal precision.

Component or browser tests can be added later for drag behavior if the helper
surface makes pure tests insufficient.

## Out Of Scope

- Full semantic type inference for JavaScript expressions.
- Inferring scalar min/max ranges without metadata.
- Replacing code with opaque structured editor controls.
- Editing non-literal expressions such as `vec3(sin(t), 0.5, value)`.
- Adding widgets for languages beyond JavaScript and GLSL.
- Persisting widget state outside source text.

## Future Work

- Open an XY pad from normalized 2D cues.
- Open a color picker from normalized 3D cues.
- Use GLSL `// @param` metadata to provide known scalar ranges when available.
- Add optional modifier variants such as Shift for coarse changes or Option/Alt
  for fine changes.
- Support `vec4` and alpha-aware color cues.
- Let object-specific APIs opt in to richer widgets for known argument
  positions, such as Hydra color functions.
