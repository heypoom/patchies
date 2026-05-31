export const peppermintPrompt = `## peppermint Object Instructions

Peppermint is a pipe-first data transformation language running through Pyodide.
Use it for compact message transforms over arrays, objects, strings, and numbers.

CRITICAL RULES:
1. Use input() to read the latest inbound Patchies message
2. input() returns none before the first message arrives
3. Use send(value) to emit a message from the outlet
4. send(value) returns value, so it can end a pipeline
5. The object re-runs automatically whenever a message arrives
6. Only send() emits Patchies messages; a final expression alone does not send output
7. Prefer pure transformations; each run starts with a fresh Peppermint environment

Language essentials:
- Pipe data left-to-right with |>
- Comments start with #
- Values: strings, numbers, true, false, none
- Lists: [1, 2, 3]
- Objects: { name: "alice", age: 25 }
- Object spread: { ...it, active: true }
- Field access: it.age, it.name
- Ranges: 1..10
- String interpolation: "hello {it.name}"
- Branch with match(value, pattern: result, _: fallback)
- Functions use ->, e.g. double = x -> x * 2
- Use parentheses for multi-line function bodies

Pipe and table primitives:
- filter(expr): keep rows/items where expr is true; use it inside expr
- map(expr): transform every item
- mapi(expr): transform with it.idx and it.val
- add(field: expr, ...): add computed fields to object rows
- drop("field", ...): remove fields
- select("field", ...): keep fields; can compute named fields
- rename(old: "new"): rename one field
- sort(by: "field", dir: "asc" | "desc"): sort rows
- take(n): keep first n rows
- unique(by: "field"): deduplicate rows
- collapse(by: "field", avg: mean(col.score), n: count()): aggregate rows
- sum(col.field), mean(col.field), count(), min(col.field), max(col.field): aggregate helpers
- len(list), get(list, i), find(table, "field", value), slice(list, start, end), concat(a, b)

Patchies-specific primitives:
- input(): current inbound message, latest message on manual run, or none before any message
- send(value): send value to outlet 0 and pass it through unchanged
- print(value): write value to the virtual console and pass it through unchanged

Recommended patterns:
- Always end user-visible transforms with |> send()
- Guard missing input with match(input(), none: ..., _: ...)
- For list-of-object messages, use filter/add/select/sort/take directly after input()
- For a single object, either send({ ...input(), field: value }) or wrap it in a list if using table functions
- Avoid load(), save(), file imports, env, ml, and viz unless the user explicitly asks; Patchies messages are usually the data source

Example - Filter Rows:
\`\`\`json
{
  "type": "peppermint",
  "data": {
    "code": "input()\\n  |> filter(it.age >= 18)\\n  |> send()"
  }
}
\`\`\`

Example - Add Fields:
\`\`\`json
{
  "type": "peppermint",
  "data": {
    "code": "input()\\n  |> add(label: \\"{it.name} is {it.age}\\")\\n  |> add(adult: it.age >= 18)\\n  |> send()"
  }
}
\`\`\`

Example - Sort and Select:
\`\`\`json
{
  "type": "peppermint",
  "data": {
    "code": "input()\\n  |> sort(by: \\"score\\", dir: \\"desc\\")\\n  |> take(5)\\n  |> select(\\"name\\", \\"score\\")\\n  |> send()"
  }
}
\`\`\`

Example - Aggregate:
\`\`\`json
{
  "type": "peppermint",
  "data": {
    "code": "input()\\n  |> collapse(by: \\"group\\", avg: mean(col.value), n: count())\\n  |> send()"
  }
}
\`\`\`

Example - Map Values:
\`\`\`json
{
  "type": "peppermint",
  "data": {
    "code": "input()\\n  |> map(it * 2)\\n  |> send()"
  }
}
\`\`\`

Example - Single Object:
\`\`\`json
{
  "type": "peppermint",
  "data": {
    "code": "msg = input()\\nmatch(msg,\\n  none: send(none),\\n  _:    send({ ...msg, processed: true })\\n)"
  }
}
\`\`\`

Example - Handle Missing Input:
\`\`\`json
{
  "type": "peppermint",
  "data": {
    "code": "match(input(),\\n  none: print(\\"waiting for input\\"),\\n  _:    input() |> send()\\n)"
  }
}
\`\`\``;
