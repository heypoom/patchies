# Multi-Line Shader Error Highlighting

**Date:** 2026-01-11

## Objective

Enable CodeMirror to highlight multiple error lines from GLSL shader compilation failures with hover tooltips showing error messages.

## Data Flow

The `lineErrors` data flows through these files:

```
shader-validator.ts → shadertoy-draw.ts → fboRenderer.ts (worker)
                                               ↓ postMessage
                                          GLSystem.ts → logger.ts → eventbus
                                                                       ↓
                                          GLSLCanvasNode.svelte ← ConsoleOutputEvent
                                                    ↓
                                          CodeEditor.svelte (highlights lines)
```

## Key Files & Changes

| File | Role | Key Change |
|------|------|------------|
| `src/lib/canvas/shader-validator.ts` | Extracts line numbers & messages from GL error log | Returns `lineErrors: Record<number, string[]>` |
| `src/lib/canvas/shadertoy-draw.ts` | Creates shader draw command, calls validator | Passes `lineErrors` in error callback |
| `src/workers/rendering/fboRenderer.ts` | Runs in Web Worker, posts errors to main thread | Posts `lineErrors` via `postMessage` |
| `src/lib/canvas/GLSystem.ts` | Handles worker messages on main thread | Passes `lineErrors` to logger |
| `src/lib/utils/logger.ts` | Emits events to eventbus | Accepts and dispatches `lineErrors` in event |
| `src/lib/eventbus/events.ts` | Type definitions for events | Added `lineErrors?: Record<number, string[]>` to `ConsoleOutputEvent` |
| `src/lib/components/nodes/GLSLCanvasNode.svelte` | GLSL node component | Derives `errorLines` from `lineErrors`, passes to CodeEditor |
| `src/lib/components/CodeEditor.svelte` | CodeMirror wrapper | Derives error lines from `lineErrors`, line highlighting + hover tooltips |

## Error Log Format

GLSL compilation errors follow this format:
```
ERROR: 0:22: 'color' : undeclared identifier
ERROR: 0:22: 'r' :  field selection requires structure...
ERROR: 0:23: 'color' : undeclared identifier
```

The regex `/ERROR: \d+:(\d+): (.+)/g` captures:

- Group 1: Line number (second number after `ERROR:`)
- Group 2: Error message text

## Preamble Line Offset

The compiled shader includes a preamble (uniforms, precision, etc.) that the user didn't write. The `PREAMBLE_LINES` constant (13 lines in shadertoy-draw.ts) is subtracted from reported line numbers to map back to user source lines.

## CodeMirror Integration

CodeMirror uses a `StateField` with `StateEffect` pattern:

### Line Highlighting

- `setErrorLinesEffect`: Carries `number[] | null` (derived from `lineErrors` keys)
- `errorLineField`: Creates `Decoration.line({ class: 'cm-errorLine' })` for each line
- Decorations are created with `Decoration.set(ranges, true)` where `true` enables sorting

### Hover Tooltips

- `setLineErrorsEffect`: Carries `Record<number, string[]> | null`
- `lineErrorsField`: Stores error messages for tooltip lookup
- `errorTooltip`: Uses CodeMirror's `hoverTooltip` for rich tooltip UI
- Shows all error messages for the hovered line
- Styled with dark background, red border, and light red text
- Multiple messages separated by horizontal lines

Note: Only `lineErrors` flows through the pipeline. Error line numbers are derived where needed via `Object.keys(lineErrors).map(Number)`. Gutter markers were considered but removed since hover tooltips on highlighted lines provide sufficient feedback without UI clutter.

The editor scrolls to the **first** error line when errors are set.

## Debugging Tips

1. **Check worker messages**: In GLSystem.ts `handleWorkerMessage`, log `data` to see what the worker sends
2. **Check event dispatch**: In logger.ts `addNodeLog`, log the event being dispatched
3. **Check CodeEditor effect**: Add logging in the `$effect` that handles `errorLines`
4. **Verify line mapping**: If lines seem off, check `PREAMBLE_LINES` constant matches actual preamble

## Future Considerations

- Could add error severity levels (warning vs error) with different highlight colors
- Could add "jump to next/previous error" keyboard shortcuts
