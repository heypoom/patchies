# Multi-Line Shader Error Highlighting

**Date:** 2026-01-11

## Objective

Enable CodeMirror to highlight multiple error lines from GLSL shader compilation failures, instead of only the first error line.

## Data Flow

The error line information flows through 6 files:

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
| `src/lib/canvas/shader-validator.ts` | Extracts line numbers from GL error log | Changed from single regex match to `matchAll()` with Set deduplication |
| `src/lib/canvas/shadertoy-draw.ts` | Creates shader draw command, calls validator | Changed `errorLine?: number` to `errorLines?: number[]` in callback type |
| `src/workers/rendering/fboRenderer.ts` | Runs in Web Worker, posts errors to main thread | Changed `postMessage` payload from `errorLine` to `errorLines` |
| `src/lib/canvas/GLSystem.ts` | Handles worker messages on main thread | Changed condition check and logger call to use `errorLines` array |
| `src/lib/utils/logger.ts` | Emits events to eventbus | Changed `nodeError` overload and `addNodeLog` to accept `errorLines: number[]` |
| `src/lib/eventbus/events.ts` | Type definitions for events | Changed `ConsoleOutputEvent.errorLine` to `errorLines: number[]` |
| `src/lib/components/nodes/GLSLCanvasNode.svelte` | GLSL node component | Changed state from `errorLineNum` to `errorLines`, passes array to CodeEditor |
| `src/lib/components/CodeEditor.svelte` | CodeMirror wrapper | Updated StateEffect to accept array, creates multiple line decorations |

## Error Log Format

GLSL compilation errors follow this format:
```
ERROR: 0:22: 'color' : undeclared identifier
ERROR: 0:22: 'r' :  field selection requires structure...
ERROR: 0:23: 'color' : undeclared identifier
```

The regex `/ERROR: \d+:(\d+):/g` captures the line number (second number after `ERROR:`).

## Preamble Line Offset

The compiled shader includes a preamble (uniforms, precision, etc.) that the user didn't write. The `PREAMBLE_LINES` constant (13 lines in shadertoy-draw.ts) is subtracted from reported line numbers to map back to user source lines.

## CodeMirror Integration

CodeMirror uses a `StateField` with `StateEffect` pattern:
- `setErrorLinesEffect`: Carries `number[] | null`
- `errorLineField`: Creates `Decoration.line({ class: 'cm-errorLine' })` for each line
- Decorations are created with `Decoration.set(ranges, true)` where `true` enables sorting

The editor scrolls to the **first** error line when errors are set.

## Debugging Tips

1. **Check worker messages**: In GLSystem.ts `handleWorkerMessage`, log `data` to see what the worker sends
2. **Check event dispatch**: In logger.ts `addNodeLog`, log the event being dispatched
3. **Check CodeEditor effect**: Add logging in the `$effect` that handles `errorLines`
4. **Verify line mapping**: If lines seem off, check `PREAMBLE_LINES` constant matches actual preamble

## Future Considerations

- Could add error severity levels (warning vs error) with different highlight colors
- Could show inline error messages in CodeMirror gutters
- Could add "jump to next/previous error" keyboard shortcuts
