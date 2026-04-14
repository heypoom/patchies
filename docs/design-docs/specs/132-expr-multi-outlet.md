# 132. Expression Multi-Outlet

## Summary

Add Pure Data-style multi-outlet support to `expr`, `expr~`, and `fexpr~`. Each non-assignment expression separated by semicolons creates its own outlet, ordered left to right.

## Motivation

Pure Data's `expr` family supports multiple outlets:

> Each expression separated by a semicolon creates its own outlet. The outlets are ordered from left to right, corresponding to the sequence of expressions in the object box.

This enables routing different computations to different downstream nodes from a single expression object, which is fundamental for DSP and message-passing workflows (e.g., splitting a signal into dry/wet paths, or extracting multiple fields from an object).

## Design

### Semicolon Parsing: Assignments vs Outlets

Semicolons currently serve dual purpose — variable assignment (`a = $1 * 2; a + b`) and, with this feature, outlet separation. We disambiguate using **assignment detection**:

- **Assignment statement**: contains `=` that is NOT part of `==`, `!=`, `<=`, `>=`, `=>`. These set variables but do not create outlets.
- **Outlet expression**: everything else. Each creates one outlet.

```js
// 1 outlet — `a` and `b` are assignments, `a + b` is the only outlet expression
a = $1 * 2
b = $2 + 3
a + b

// 2 outlets
$1 + 1
$1 * 2

// 3 outlets with shared variable
a = $1 * 2
a + 1
a - 1
a * 3

// 1 outlet — backwards compatible single expression
$1 + $2
```

### Parsing Implementation

Add to `expr-parser.ts`:

```ts
interface ParsedExpressions {
  /** All statements in order, including assignments */
  statements: string[]
  /** Non-assignment expressions that create outlets, in order */
  outletExpressions: string[]
  /** Number of outlets (= outletExpressions.length, minimum 1) */
  outletCount: number
}

function parseMultiOutletExpressions(expression: string): ParsedExpressions
```

**Assignment detection regex**: A statement is an assignment if it matches a pattern like `identifier =` where `=` is not preceded by `!`, `<`, `>` and not followed by `=`. Concretely:

```ts
function isAssignment(statement: string): boolean {
  // Match: identifier = value, but not ==, !=, <=, >=, =>
  return /^[a-zA-Z_]\w*\s*=[^=]/.test(statement.trim())
}
```

**Splitting**: Split on `;` at the top level. The expr-eval library already handles semicolons for sequential evaluation, but we need to split before passing to the library so each outlet expression gets its own evaluator.

### Changes Per Object

#### `expr` (message-rate)

**Current**: Single outlet, `messageContext.send(result)`.
**New**: N outlets, `messageContext.send(results[i], { to: i })`.

The message system already supports outlet indexing via `SendMessageOptions.to`.

**Evaluator change**: `createExpressionEvaluator` currently returns a single function. For multi-outlet, we need an array of functions — one per outlet expression. Assignments are prepended to each outlet expression so variables are in scope.

```ts
type MultiOutletEvaluatorResult =
  | {
      success: true
      fns: Array<(...args: unknown[]) => unknown>
      outletCount: number
    }
  | {success: false; error: string}

function createMultiOutletEvaluator(
  expression: string,
): MultiOutletEvaluatorResult
```

Each outlet evaluator is constructed as: `assignments.join(';') + ';' + outletExpr` — the assignments establish the variable scope, and the final expression is the outlet's output value.

**ExprNode.svelte changes**:

- Derive `outletCount` from the parsed expression
- Render dynamic outlet handles (loop instead of single handle)
- In `handleMessage`, evaluate each outlet function and send with `{ to: i }`

**Files**:

- `ui/src/lib/utils/expr-parser.ts` — add `parseMultiOutletExpressions`, `createMultiOutletEvaluator`
- `ui/src/lib/components/nodes/ExprNode.svelte` — dynamic outlets, multi-send

#### `expr~` (audio-rate)

**Current**: Worklet has single evaluator, writes to `outputs[0]`.
**New**: Worklet has N evaluators, writes to `outputs[0..N-1]`.

**Worklet recreation**: `AudioWorkletNode`'s `numberOfOutputs` is set at construction and cannot change. When the outlet count changes (on re-run), the node must be destroyed and recreated. This happens infrequently (only on Shift+Enter) so the cost is acceptable.

**Protocol change**: The `set-expression` message carries the full multi-expression string. The worklet parses it internally (it already has expr-eval). Add a new message type or extend the existing one:

```ts
// Option: send parsed expressions array
interface SetExpressionsMessage {
  type: 'set-expressions'
  assignments: string[] // shared variable assignments
  outletExpressions: string[] // one expression per outlet
}
```

**expression-processor.ts changes**:

- Store `evaluators: ExprDspFn[]` (array instead of single)
- In `process()`, loop over evaluators and write to corresponding `outputs[i]`
- Phasor state is shared across all outlet expressions within a sample (reset `phasorIndex` once per sample, not per evaluator)

**ExprNode.ts (audio V2 class) changes**:

- `create()` uses outlet count to set `numberOfOutputs`
- `send('expression', ...)` triggers worklet recreation if outlet count changed
- `connectFrom()` unchanged (inlets only)
- Need new connection support: other nodes connecting FROM expr~'s multiple outputs. This is handled by the edge system using source handle IDs (`audio-out-0`, `audio-out-1`, etc.)

**AudioExprNode.svelte changes**:

- Derive `outletCount` from expression parsing
- Render dynamic audio outlet handles
- On re-run, if outlet count changed, recreate the audio node

**Files**:

- `ui/src/lib/audio/expression-processor.ts` — multi-evaluator, multi-output
- `ui/src/lib/audio/v2/nodes/ExprNode.ts` — dynamic outlet count, worklet recreation
- `ui/src/lib/components/nodes/AudioExprNode.svelte` — dynamic outlet rendering

#### `fexpr~` (filter expression)

**Current**: Single evaluator, single `outputHistory`, single `y1` accessor.
**New**: N evaluators, N output histories, `y1`...`yN` accessors.

Same worklet recreation strategy as expr~.

**Output history**: Each outlet gets its own circular buffer and `y` accessor. In PD, `y1[-1]` refers to the previous output of outlet 1, `y2[-1]` to outlet 2, etc. However, since our current fexpr~ only has `y1`, and multi-outlet is the natural extension:

- `y1[-n]` = previous output of outlet 1 (first outlet)
- `y2[-n]` = previous output of outlet 2 (second outlet)
- etc.

All `y` accessors are available to all outlet expressions. This means outlet 2's expression can reference outlet 1's previous output, enabling cross-outlet feedback.

**fexpr-processor.ts changes**:

- `outputHistory: Float32Array[]` (array of buffers, one per outlet)
- `outputAccessors: Array<(offset: number) => number>` (one per outlet)
- `evaluators: FExprDspFn[]` (array)
- In `process()`, evaluate each outlet expression per sample, write to corresponding output, update corresponding output history
- Evaluation order matters for cross-outlet references: evaluate outlet 1 first, store in history, then outlet 2 can see `y1[-0]` (but -0 is current sample — actually this gets tricky). For simplicity, evaluate all outlets using output history from the **previous** sample only. Current-sample cross-references would require a specific evaluation order guarantee, which we can defer.

**FExprNode.ts changes**: Same pattern as ExprNode.ts — dynamic outlet count, worklet recreation.

**AudioFExprNode.svelte changes**: Same pattern as AudioExprNode.svelte — dynamic outlet rendering.

**Files**:

- `ui/src/lib/audio/fexpr-processor.ts` — multi-evaluator, multi-output, multi-history
- `ui/src/lib/audio/v2/nodes/FExprNode.ts` — dynamic outlet count, worklet recreation
- `ui/src/lib/components/nodes/AudioFExprNode.svelte` — dynamic outlet rendering

### Edge System & Connections

Source handle IDs for multi-outlet audio nodes need to encode the outlet index. Following the existing convention in CLAUDE.md:

- `audio-out-0`, `audio-out-1`, etc. for audio outlets
- Message outlets already use index-based routing via `SendMessageOptions.to`

The `AudioService.connectNodes()` method routes connections based on source/target handle IDs. For multi-output nodes, the source handle tells us which output to connect from. Need to verify that `AudioWorkletNode.connect(destination, outputIndex)` works with the output index.

### Display

The `CommonExprLayout` component (used by ExprNode) and the audio expr layouts show a prefix like `expr` before the expression. When multi-outlet is active, the display doesn't change — the expression text itself communicates the outlet structure. The outlet handles visually communicate the count.

## Implementation Order

1. **Parser** (`expr-parser.ts`): `parseMultiOutletExpressions`, `createMultiOutletEvaluator`, and tests
2. **expr** (message-rate): Simplest — no worklet, message system already supports outlet indexing
3. **expr~** (audio-rate): Worklet multi-output, worklet recreation on outlet count change
4. **fexpr~** (filter): Same as expr~ plus multi-output history
5. **Documentation**: Update all three markdown files

## Edge Cases

- **Empty expression**: 1 outlet (current behavior)
- **All assignments, no outlet expressions**: 1 outlet that outputs 0 (or the last assignment's value — TBD, but defaulting to 0 is safer)
- **Single expression, no semicolons**: 1 outlet (fully backwards compatible)
- **Trailing semicolon**: `$1 + 1;` — the empty string after the last `;` is ignored
- **Expression parse error in one outlet**: Report error, all outlets output 0/silence
- **Outlet count changes on re-run**: For expr, just update handles. For expr~/fexpr~, recreate worklet node.

## Backwards Compatibility

Fully backwards compatible. Existing single-expression usage produces exactly 1 outlet, same as before. Multi-line variable expressions (`a = $1 * 2; a + 1`) still produce 1 outlet because the assignment is detected and excluded.
