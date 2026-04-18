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

**Single outlet — output type mirrors input type:**

- \`bang\` → \`{ type: 'gong', index, id, freq, cents, accumulate }\`
- \`number\` → same as bang, plus \`scale: { name, location, freqs[], cents[] }\` attached
- \`string\` → switches tuning (partial match, e.g. \`'Khong'\` matches \`'Khong Wong Yai'\`), no output
- \`{ type: 'noteOn', note, velocity, channel }\` → emits \`{ type: 'pitchBend', value, channel, frequency }\` then \`{ type: 'noteOn', note, velocity, channel, frequency }\`
- \`{ type: 'noteOff', note, velocity, channel }\` → emits \`{ type: 'noteOff', note, velocity, channel, frequency }\`

MIDI note numbers are mapped to gongs via \`note % gongCount\`. The pitch bend value is -1.0 to 1.0 (±2 semitone range). Active notes are tracked — switching tunings sends noteOff for all held notes first.

**MIDI microtuning example:**
\`\`\`
midi.in → ngea → midi.out
\`\`\`

**Strudel integration — use single quotes for the name:**

NGEA tunings are registered globally in Strudel. Double-quoted strings become mini-notation patterns in Strudel, so always use single quotes for the name argument.

\`\`\`js
// .ngea() method maps pattern indices to gong frequencies
"0 2 4 6 3 1".slow(2).ngea('Tuning Title')

// ngea() as frequency array lookup
note("0 2 4 1".slow(2)).freq(i => ngea('Tuning Title')[i])
\`\`\`
`;
