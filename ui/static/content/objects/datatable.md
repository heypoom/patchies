The `datatable` object is an editable CSV-style table for message data.

## Getting Started

Edit the column headers directly in the top row. Use the plus buttons to add
rows or columns, and the trash buttons to remove them.

Select the object and drag its resize handles to set the visible table area.
Extra rows or columns scroll inside the table.

Table cells are multiline. Press `Enter` for a newline, or `Shift+Enter` to
output the table, the same as sending `bang`.

Send `bang` to output the table. By default this is a 2D JavaScript array where
the first row is the current column headers:

```js
[
  ["name", "age"],
  ["Ada", "37"],
  ["Grace", "85"]
]
```

Enable **row objects** to output an array of objects instead:

```js
[
  { name: "Ada", age: "37" },
  { name: "Grace", age: "85" }
]
```

Blank object-mode headers use fallback names like `column_1`.

Use `rows` to always output the 2D array, ignoring the row objects setting.
Use `objects` to always output row objects.

## CSV

Drop a `.csv` file onto the canvas to create a `datatable` from it. The first
CSV row becomes editable column headers.

You can also send CSV text directly to the inlet to replace the table.

## See Also

- [msg](/docs/objects/msg) — send table commands
- [js](/docs/objects/js) — process emitted table data
- [unpack](/docs/objects/unpack) — split array data across outlets
