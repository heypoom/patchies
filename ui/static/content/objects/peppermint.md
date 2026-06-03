Run [Peppermint](https://github.com/chayapatr/peppermint) data pipelines in the browser.

Peppermint is a pipe-first language for transforming lists, objects, strings, and numbers. In Patchies, incoming messages become `input()`, `send()` emits to the outlet, and `print()` writes to the virtual console for debugging.

```peppermint
input()
  |> print
  |> send
```

## How It Works

The `peppermint` object runs manually from the play button and automatically whenever a message arrives. A `bang` triggers a run with the last captured input value.

Patchies adds two functions:

| Function  | What it does                                                   |
| --------- | -------------------------------------------------------------- |
| `input()` | Reads the latest inbound Patchies message, or `none` at first. |
| `send(x)` | Sends `x` from the message outlet and passes it through.       |

Peppermint's own `print(x)` still prints to the virtual console and passes `x` through. Use it to inspect intermediate values without sending extra messages.

```peppermint
input()
  |> filter(it.age >= 18)
  |> print
  |> send
```

Send this list into the inlet:

```json
[
  { "name": "alice", "age": 25 },
  { "name": "bob", "age": 17 }
]
```

The outlet emits:

```json
[{ "name": "alice", "age": 25 }]
```

## Pipes

Use `|>` to pass data left to right through a pipeline. A bare function name in a pipe is called with the piped value, so these are equivalent:

```peppermint
input() |> send
input() |> send()
```

Inside table functions, `it` is the current row or item:

```peppermint
input()
  |> filter(it.score > 0.8)
  |> add(label: "{it.name}: {it.score}")
  |> sort(by: "score", dir: "desc")
  |> take(5)
  |> send
```

## Common Functions

Peppermint works well with list-of-object messages, which behave like small tables.

| Function               | Use it to                                          |
| ---------------------- | -------------------------------------------------- |
| `filter(expr)`         | Keep rows where `expr` is true.                    |
| `map(expr)`            | Transform every item.                              |
| `mapi(expr)`           | Transform with `it.idx` and `it.val`.              |
| `add(field: expr)`     | Add computed fields to object rows.                |
| `drop("field")`        | Remove fields.                                     |
| `select("a", "b")`     | Keep selected fields.                              |
| `rename(old: "new")`   | Rename fields.                                     |
| `sort(by: "field")`    | Sort rows by a field.                              |
| `take(n)`              | Keep the first `n` rows.                           |
| `unique(by: "field")`  | Remove duplicates.                                 |
| `collapse(...)`        | Aggregate rows into summaries.                     |
| `len(list)`            | Count list items.                                  |
| `concat(a, b)`         | Join lists together.                               |
| `slice(list, a, b)`    | Get a slice.                                       |
| `find(table, col, val)` | Find the first row with a matching column value.   |

Use `col.field` when aggregating across rows:

```peppermint
input()
  |> collapse(by: "region", total: sum(col.revenue), avg: mean(col.score), n: count())
  |> send
```

## Values And Branching

Peppermint has numbers, strings, booleans, `none`, lists, and objects:

```peppermint
rows = [
  { name: "alice", age: 25 },
  { name: "bob", age: 17 }
]

rows
  |> add(adult: it.age >= 18)
  |> send
```

Integer and float literals can be tuned directly in the editor. Hold Option on
macOS or Control on Windows/Linux, then drag a number up or down to change it.

Use `match` for branching:

```peppermint
input()
  |> add(tier: match(it.score,
      > 0.8: "high",
      > 0.5: "medium",
      _:     "low"
  ))
  |> send
```

Strings support interpolation:

```peppermint
input()
  |> add(summary: "{it.name} is {it.age} years old")
  |> send
```

## Context And Errors

Table pipelines return a `Context`, which carries:

| Field     | Meaning                                  |
| --------- | ---------------------------------------- |
| `.data`   | Rows that successfully passed the pipe.  |
| `.errors` | Rows that failed during row-level steps. |

`send(context)` emits `context.data`, which is usually what you want. Name the result when you want to inspect errors:

```peppermint
result = input()
  |> add(ratio: it.income / it.age)

print(result.errors)
result.data |> send
```

Whole-pipe errors become `Err(message)` and skip downstream steps. Handle them with `match`:

```peppermint
result = input()
  |> filter(it.age > 18)

match(result,
  Ok(data): data |> send,
  Err(msg): print(msg)
)
```

For row-level errors, `recover(field: fallback)` moves failed rows back into `.data`:

```peppermint
input()
  |> add(label: match(it.score, > 0.8: "high", _: "low"))
  |> recover(label: "unknown")
  |> send
```

## Namespaces

Use `use math` for numeric helpers:

```peppermint
use math

input()
  |> map(math.sqrt(it))
  |> send
```

Use `use text` for string helpers:

```peppermint
use text

input()
  |> map(text.upper(it))
  |> send
```

Patchies does not support Peppermint file loading in this object, so prefer `input()` over `load(...)`. Avoid `use ml` in Patchies for now because those examples depend on packages that are not available in Pyodide here.

## Resources

- [Peppermint on GitHub](https://github.com/chayapatr/peppermint)
- [Peppermint docs](https://github.com/chayapatr/peppermint/tree/main/docs)

## See Also

- [python](/docs/objects/python) — Run Python code directly with Pyodide
- [js](/docs/objects/js) — JavaScript code block
- [peek](/docs/objects/peek) — Inspect messages flowing through a patch
