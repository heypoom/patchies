export const sheetPrompt = `Use sheet for small editable spreadsheet-style message grids.

Behavior:
- It has one message inlet and one message outlet.
- Send bang to output table data.
- Default output is row objects keyed by column header.
- Use the rows message when downstream code specifically needs a 2D array with headers.
- Column headers are editable directly in the node UI, so choose clear headers when generating patches.

Good uses:
- Lookup sheets for visuals, sequencing, labels, configuration, and small datasets.
- Drop or load CSV data, then route the emitted array into js, map, filter, or unpack.

Avoid using sheet for audio wavetables or sample buffers. Use table for that.`;
