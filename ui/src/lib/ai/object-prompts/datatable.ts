export const datatablePrompt = `Use datatable for small editable CSV-style message tables.

Behavior:
- It has one message inlet and one message outlet.
- Send bang to output table data.
- Default output is a 2D JavaScript array with column headers as the first row.
- Enable row-object output only when downstream code needs objects keyed by column header.
- Column headers are editable directly in the node UI, so choose clear headers when generating patches.

Good uses:
- Lookup tables for visuals, sequencing, labels, configuration, and small datasets.
- Drop or load CSV data, then route the emitted array into js, map, filter, or unpack.

Avoid using datatable for audio wavetables or sample buffers. Use table for that.`;
