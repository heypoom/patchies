# 100. Peppermint Object

## Summary

Add a `peppermint` object that runs Peppermint source code in the browser through Pyodide. Peppermint is a pipe-first Python-hosted language for data transformation, so the object should behave like a message transform: inbound Patchies messages become `input()` in Peppermint, and Patchies' injected `send()` emits messages from the object's outlet.

## Motivation

Patchies already has a `python` object for general Pyodide scripting. Peppermint gives users a smaller, data-oriented language for common Patchies message flows:

```peppermint
input()
  |> print
  |> send
```

This should make list/object transformation feel closer to patching than writing a full Python program, while still using Python libraries under the hood.

## Runtime Behavior

### Execution Triggers

The object supports two run paths:

1. Manual run from the node's run control.
2. Automatic run when a message arrives at the message inlet.

On every inbound message, the object stores the message as the latest input value and re-evaluates the current Peppermint source code.

### `input()`

Patchies injects an `input()` function into the Peppermint global environment.

- During an inbound-message run, `input()` returns the message currently being processed.
- During a manual run, `input()` returns the latest stored inbound message.
- Before any inbound message has arrived, `input()` returns Peppermint `none`.

This keeps manual runs valid for scripts that do not need input and lets input-aware scripts branch explicitly:

```peppermint
match(input(),
  none: print("waiting for input"),
  _:    input() |> send()
)
```

### `print()`

Peppermint's stdlib `print()` function keeps its normal debugging behavior.

- `print(value)` returns `value` unchanged so pipeline flow continues.
- `print(value)` writes to the node's virtual console.
- Peppermint `Context` values print their `.data` list, matching the reference stdlib behavior.

### `send()`

Patchies injects a `send()` function into the Peppermint global environment.

- `send(value)` sends `value` to message outlet 0.
- `send(value)` returns `value` unchanged so pipeline flow continues.
- Peppermint `Context` values emit their `.data` list, matching the value users typically want from table pipelines.

### Return Values

Only `send()` emits messages. A final expression result that is not sent should not be echoed to the virtual console or emitted to the outlet. This keeps the console quiet unless the user explicitly calls `print()`.

### Re-entrancy

Peppermint execution is async because package installation and Pyodide evaluation are async. If a new inbound message arrives while a run is active:

- Store it as the latest pending input.
- Do not enqueue every intermediate message.
- After the current run finishes, run once more using the latest pending input.

This "latest wins" behavior avoids unbounded backlog for fast message streams.

## Architecture

### Node Component

Add `PeppermintNode.svelte`, modeled after `PythonNode.svelte` and rendered through `CodeBlockBase`.

The component owns:

- `MessageContext` for receiving inbound messages and sending outbound messages.
- `latestInput`, initialized to a sentinel that maps to Peppermint `none`.
- `isInitialized`, `isRunning`, and `pendingInput` run state.
- Event bus listeners for Pyodide/Peppermint worker output.

The node label is `peppermint`, editor language is `peppermint`, and the default code is:

```peppermint
input()
  |> filter(it.age >= 18)
  |> send()
```

### Pyodide Worker

Reuse the existing Pyodide worker infrastructure rather than introducing a new runtime family.

Implementation options:

1. Extend the current worker protocol with a Peppermint-specific `executePeppermintCode` message.
2. Create a sibling Peppermint worker that shares setup patterns with the Python worker.

The recommended implementation is option 1 if the type surface stays small. It reuses per-node Pyodide instances, package loading, stdout/stderr forwarding, and the existing message bridge.

The worker should lazily initialize Peppermint once per node:

```python
import micropip

await micropip.install("pandas")
await micropip.install("peppermint-lang@0.4.0a2")

from peppermint.interpreter import Interpreter
from peppermint.parser import parse
from peppermint.stdlib import build_global_env
from peppermint.context import Context
```

Each run creates a fresh Peppermint environment:

```python
env = build_global_env()
env.set("input", patchies_input)
env.set("send", patchies_send)
interp = Interpreter(env, quiet=True)
result = interp.run(parse(src))
```

Using a fresh env per run prevents assignments from leaking across runs while keeping the Pyodide instance and installed packages warm.

### Message Conversion

Patchies messages are JavaScript values crossing into Pyodide. The implementation should keep values as plain Python-compatible data:

- arrays become Python lists
- objects become Python dicts
- strings, numbers, booleans, and null map to their Python equivalents

Outbound values should be converted back to JavaScript values before posting from the worker. If a Peppermint value is an `Ok`, unwrap to the contained value. If it is a `Context`, emit `.data`.

Errors should be reported to the node console. Parse/runtime locations should be translated into `lineErrors` later if the parser exposes stable locations through thrown errors.

## Editor Support

### v1 Syntax Highlighting

Add `peppermint` to `SupportedLanguage` and `loadLanguageExtension()`.

Use the reference repo's VS Code TextMate grammar as the source for a small CodeMirror highlighter module:

`.references/peppermint/ecosystem/vscode-peppermint/syntaxes/peppermint.tmLanguage.json`

Patchies should not depend directly on `.references`; copy or adapt the minimal rules into `ui/src/lib/codemirror/peppermint.codemirror.ts`.

### v1 Autocomplete

Add a basic completion source with:

- language keywords: `match`, `use`, `as`, `ns`, `quiet`, `true`, `false`, `none`, `it`, `col`
- pipe/operator snippets: `|>`, `->`
- core stdlib functions: `filter`, `map`, `mapi`, `add`, `drop`, `select`, `rename`, `sort`, `take`, `print`, `send`, `collapse`, `sum`, `mean`, `count`, `min`, `max`, `len`, `unique`, `slice`, `concat`

The reference LSP catalog can guide labels, signatures, and docs, but v1 should stay static and browser-local.

### Later Diagnostics

The reference repo includes parser/analyzer/LSP code. A later phase can run `parse(src)` and the analyzer in Pyodide on code changes or before execution, then surface diagnostics in CodeMirror using the existing line-error mechanism.

Full LSP wiring is intentionally out of scope for v1.

## Registration and Documentation

Add the object to the standard Patchies surfaces:

- `ui/src/lib/components/nodes/PeppermintNode.svelte`
- `ui/src/lib/nodes/node-types.ts`
- `ui/src/lib/nodes/defaultNodeData.ts`
- `ui/src/lib/canvas/constants.ts`
- `ui/src/lib/objects/schemas/peppermint.ts`
- `ui/src/lib/objects/schemas/index.ts`
- `ui/src/lib/extensions/object-packs.ts` under `Scripting`
- `ui/static/content/objects/peppermint.md`
- `ui/src/lib/ai/object-descriptions-types.ts`
- `ui/src/lib/ai/object-prompts/peppermint.ts`
- `ui/src/lib/ai/object-prompts/index.ts`
- `ui/src/lib/codemirror/types.ts`
- `ui/src/lib/codemirror/language.ts`

## Built-In Presets

Mirror the non-ML examples from the Peppermint reference repository into built-in presets:

- Source files come from `.references/peppermint/examples`.
- Examples under `.references/peppermint/examples/ml` are intentionally excluded because Patchies' Pyodide runtime does not support Numba.
- Reference `load(...)` calls are adapted to `input()` because Patchies data arrives through object messages, not Peppermint file loading.
- ML-dependent snippets outside the `ml` folder should be adapted or omitted for the same runtime reason.
- Each example is stored as its own preset source module under `ui/src/lib/presets/builtin/peppermint/`.
- Preset keys preserve the upstream `.pep` filenames, such as `conway.pep`, `quicksort.pep`, and `sales_analysis.pep`.
- The presets are exposed through a dedicated `Peppermint Examples` preset pack that requires the `peppermint` object.

## Testing

### Runtime Probe

Before wiring the full node, verify in Pyodide that:

- `micropip.install("pandas")` succeeds
- `micropip.install("peppermint-lang")` succeeds
- `parse()` and `Interpreter(build_global_env())` can run a simple pipeline

This is important because compatibility depends on the Pyodide Python version and package metadata.

### Unit Tests

Add focused tests for any extracted run-state helper if the re-entrancy logic is moved out of the Svelte component.

The important behavior to cover is:

- manual run before input uses `none`
- inbound message triggers one run
- a message arriving during a run schedules exactly one follow-up run with the latest message

### Manual Verification

Use a small patch:

1. `msg` emits a list of row objects.
2. `peppermint` runs:

   ```peppermint
   input()
     |> filter(it.age >= 18)
     |> send()
   ```

3. `peek` or another message display confirms only adult rows are emitted.
4. Manual run before any inbound message with:

   ```peppermint
   input() |> send()
   ```

   emits `none`.

## Open Questions

- Whether the package should be installed from PyPI at runtime or vendored/cached later for offline use.
- Whether Peppermint file imports like `use "./transforms.py"` should be supported through Patchies VFS in a future phase.
- Whether fast inbound streams should eventually support every-message processing as an opt-in mode instead of latest-wins.
