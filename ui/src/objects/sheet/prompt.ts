export const sheetPrompt = `The "sheet" object is a spreadsheet node with a bang inlet and a data outlet.

## Inlets
- Inlet 0 (message): Any message triggers output of the full sheet as a 2D array (string[][]).
  - Special messages:
    - { type: 'set', row: number, col: number, value: string } — set a specific cell
    - { type: 'clear' } — clear all cells

## Outlet
- Outlet 0: Emits a 2D array (string[][]) of all cell values when triggered.

## Example: bang to output data
Connect a button to the sheet inlet → sheet outlet → tap to see the data

## Example: set a cell from JS
send({ type: 'set', row: 0, col: 0, value: 'hello' })

## Notes
- Row and column indices are 0-based
- Cells contain string values
- Right-click any cell for context menu (add/remove row/column, clear)
- Double-click a cell to edit it
- Drag the column header edge to resize columns
`;
