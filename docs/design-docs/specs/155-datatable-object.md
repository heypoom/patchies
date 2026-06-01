# 155. Datatable Object

`datatable` is an editable data grid for small CSV-like tables. It is separate
from `table`, which remains an audio/wavetable float buffer.

## Scope

- Add a `datatable` node with one message inlet and one message outlet.
- Store table data in node data as editable `columns` and `rows`.
- Render a compact grid UI where column headers are normal editable inputs.
- Allow adding and removing columns.
- Allow adding and removing rows when editing table data.
- Allow resizing the node with `NodeResizer`; the table viewport should scroll
  when content exceeds the resized bounds.
- Allow resizing individual columns by dragging the right border of a column
  header.
- Move row and column deletion into context menus instead of always-visible grid
  buttons.
- Allow reordering columns and rows from their context menus.
- Match spreadsheet-like cell editing: clicking selects a cell, typing while a
  cell is selected enters edit mode with that typed character, and double-click
  enters edit mode with the current cell content.
- Column headers follow the same select-then-edit model as body cells: click to
  select, type to replace/edit, and double-click to edit the existing header.
- Allow dragging a column header to reorder columns freely.
- On `bang`, output a 2D JavaScript array by default. The first row is the
  current column header row, followed by each data row.
- Add a checkbox setting to output array-of-row-objects instead. This mode uses
  current column headers as keys and each row as an object value.
- Support pasted or loaded CSV text as a table source. The first CSV row becomes
  column headers so users can rename them directly after import.

## Data Contract

The default output intentionally preserves headers as the first row because CSV
headers are not always reliable or meaningful. Object output is opt-in for cases
where renamed headers should become object keys.

```ts
type DatatableNodeData = {
  columns: string[];
  rows: unknown[][];
  outputObjects?: boolean;
  width?: number;
  height?: number;
  columnWidths?: number[];
};
```

For object output, blank column headers fall back to `column_1`, `column_2`, and
so on. Duplicate headers receive numeric suffixes, such as `name_2`, to avoid
overwriting earlier values.

## Implementation Notes

- Put shared table conversion helpers under `ui/src/objects/datatable/` so the
  message contract is tested outside the Svelte component.
- Register the object as a dedicated node type rather than a V2 text object,
  because the main behavior is an editable grid UI.
- Add a manual object schema for documentation and message validation surfaces.
- Add `.csv` drag/drop handling after MIME-specific text formats and before the
  generic `text/* -> markdown` fallback.
- Preserve user-resized dimensions across table data changes. Before the user
  resizes, the node may auto-size its width from the current column count.
- Preserve user-resized column widths across table data changes where possible;
  new columns receive the default width.
- Column reorder should move header names, row cells, and stored column widths
  together.
- Column header drag reorder should use a small movement threshold so normal
  header clicks and edits do not accidentally reorder columns.
