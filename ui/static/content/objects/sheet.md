The `sheet` object is an editable spreadsheet-style grid for message data.

## Getting Started

Use the plus buttons to add rows or columns.

Select the object and drag its resize handles to set the visible table area.
Extra rows or columns scroll inside the table. The node cannot be resized
taller than the current table content.

Disable **Allow resize** in settings to hide the node resize handles.
Disable **Auto fit height** to keep the node height fixed when rows or cell
content change.
Disable **Show footer** to hide the row count and add-row footer.

Use the expand button beside settings to edit the sheet in a detached overlay.
Send `expand` to open it, and `collapse` to close it.

Drag the right edge of a column header to resize that column.

Right-click a column header to insert, move, or delete that column. Right-click
a cell or row to insert, move, or delete that row.

Table cells are multiline. Press `Enter` for a newline, or `Shift+Enter` to
output the table, the same as sending `bang`.

Click a cell to select it. Type while a cell is selected to replace it and enter
edit mode, or double-click a cell to edit the existing value.

Drag across body cells to select multiple cells. Press `Delete` or `Backspace`
to clear the selected cell contents.

The leading `#` column is a row handle only. Drag a numbered row cell to reorder
that row. The `#` column is not included in emitted table data.

Column headers can be selected the same way. Click a header to select it, type
to replace it, or double-click to edit the existing header.

Drag a column header to reorder columns.

Send `bang` to output the table. By default this is an array of row objects
using the current column headers as keys:

```js
[
  { name: "Ada", age: "37" },
  { name: "Grace", age: "85" }
]
```

Disable **row objects** to output a 2D JavaScript array instead. In that mode,
the first row is the current column headers:

```js
[
  ["name", "age"],
  ["Ada", "37"],
  ["Grace", "85"]
]
```

Blank object-mode headers use fallback names like `column_1`.

Use `rows` to always output the 2D array, ignoring the Send 2D array setting.
Use `objects` to always output row objects.

## CSV

Drop a `.csv` file onto the canvas to create a `sheet` from it. The first
CSV row becomes editable column headers.

You can also send CSV text directly to the inlet to replace the table.

## See Also

- [msg](/docs/objects/msg) — send table commands
- [js](/docs/objects/js) — process emitted table data
- [unpack](/docs/objects/unpack) — split array data across outlets
