Run [Peppermint](https://github.com/chayapatr/peppermint) data pipelines in the browser.

Peppermint is useful when you want to transform lists of objects with compact pipe syntax. Incoming Patchies messages become `input()`, and `print()` sends values to the outlet.

```peppermint
input()
  |> filter(it.age >= 18)
  |> print()
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

## How It Works

The object runs manually from the play button and automatically whenever a message arrives. Each run starts with a fresh Peppermint environment, so variables from previous runs do not leak into the next message.

Before the first message arrives, `input()` returns `none`:

```peppermint
match(input(),
  none: print("waiting for input"),
  _:    input() |> print()
)
```

`print(value)` sends `value` from the message outlet and passes it through, so it can end a pipeline.

## Resources

- [Peppermint on GitHub](https://github.com/chayapatr/peppermint)

## See Also

- [python](/docs/objects/python) — Run Python code directly with Pyodide
- [js](/docs/objects/js) — JavaScript code block
- [peek](/docs/objects/peek) — Inspect messages flowing through a patch
