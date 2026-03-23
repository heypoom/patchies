/**
 * IMPORTANT: This prompt must contain ONLY API documentation.
 *
 * The NGEA data (tuning names, frequencies, cent values, cultural descriptions,
 * contributor information, locations, etc.) is licensed CC BY-SA 4.0 with an
 * explicit prohibition against use for training AI/ML models.
 *
 * Do NOT add any actual tuning data to this prompt. Keep it strictly to:
 * - Inlet/outlet message shapes
 * - Method names and signatures
 * - Code usage examples using placeholder names only
 *
 * Source: https://networkgongensemblearchive.online
 */
export const ngeaPrompt = `## ngea Object Instructions

The ngea object provides real-world microtonal tuning data from the Network Gong Ensemble Archive (NGEA) — Southeast Asian gong ensembles from Thailand, Cambodia, Indonesia, Philippines, Myanmar, and Vietnam.

**Outlets:**
- Outlet 0 (gong): \`{ type: 'gong', index, id, freq, cents, accumulate }\` — triggered by index input
- Outlet 1 (scale): \`{ type: 'scale', name, location, freqs[], cents[] }\` — triggered by bang

**Inlet messages:**
- Number: output gong data at that index (0-based)
- \`{ type: 'bang' }\`: output current gong data
- String: switch to a named tuning (partial match, e.g. \`'Khong'\` matches \`'Khong Wong Yai'\`)

**Strudel integration — use single quotes for the name:**

NGEA tunings are registered globally in Strudel. Double-quoted strings become mini-notation patterns in Strudel, so always use single quotes for the name argument.

\`\`\`js
// .ngea() method maps pattern indices to gong frequencies
"0 2 4 6 3 1".slow(2).ngea('khong-wong-yai')

// ngea() as frequency array lookup
note("0 2 4 1".slow(2)).freq(i => ngea('sumba')[i])
\`\`\`
`;
