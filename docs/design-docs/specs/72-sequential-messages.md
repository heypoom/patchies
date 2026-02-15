# 72. Sequential Messages

## Motivation

In Max/MSP and Pure Data, message boxes support comma-separated sequential messages. Clicking a message box containing `{type: 'set', value: 1}, bang, [255, 0, 0]` sends three messages in order. This is a fundamental patching pattern for triggering multiple actions from a single event.

Patchies' `msg` object currently only sends a single message per trigger. Adding sequential message support brings us closer to Max/MSP parity and enables more expressive patches.

## Syntax

Commas at the **top level** (outside `{}`, `[]`, and quotes) separate sequential messages:

```text
{type: 'set', value: 1}, bang, [255, 0, 0]
```

Sends in order:

1. `{type: 'set', value: 1}` — parsed as JSON5 object
2. `{type: 'bang'}` — bare string becomes typed object
3. `[255, 0, 0]` — parsed as JSON5 array

Commas **inside** structures are not separators:

- `{a: 1, b: 2}` — single object (commas inside `{}`)
- `[1, 2, 3]` — single array (commas inside `[]`)
- `"hello, world"` — single string (comma inside quotes)

## Parsing Algorithm

Single-pass O(n) character scanner tracking nesting depth:

- Track `braceDepth` (`{}`), `bracketDepth` (`[]`), quote state (single, double, backtick)
- Handle backslash escapes inside quotes
- Split on `,` only when all depths are 0 and not inside quotes
- Trim segments, filter empties

Implemented as `splitSequentialMessages()` in `src/lib/utils/message-parser.ts`.

## Integration with Existing Features

### Placeholders ($1-$9)

Splitting happens **before** placeholder substitution. Each segment gets independent substitution:

```text
{note: $1, velocity: 100}, bang
```

If `$1 = 60`, sends: `{note: 60, velocity: 100}` then `{type: 'bang'}`.

If a segment has unsubstituted placeholders, only that segment is skipped (others still send).

### Inlet Count

`parseInletCount()` scans the full message text for `$1`-`$9`. This continues to work correctly — inlets are determined by the highest placeholder across all segments.

### Display

Sequential messages use JavaScript syntax highlighting on the button display. An `isSequential` derived flag enables highlighting even when the full string doesn't parse as a single JSON5 value.

## Breaking Change

Bare strings containing literal commas (e.g., `hello, world`) now split into two messages: `{type: 'hello'}` then `{type: 'world'}`. Previously this sent `{type: 'hello, world'}`. Users can quote to preserve: `"hello, world"`. This matches Max/MSP semantics.
