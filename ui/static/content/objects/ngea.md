Microtonal tuning data from the [Network Gong Ensemble Archive](https://networkgongensemblearchive.online).

Frequency measurements of gong ensembles from Thailand, Cambodia,
Indonesia, Philippines, Myanmar, and Vietnam.

Data used with permission from the original author, Elekhlekha. 
Licensed CC BY-SA 4.0.

## Usage

Select a tuning from the dropdown. The outlet type mirrors what you send in.

**bang** → `{type: 'gong', index, id, freq, cents, accumulate}`

**number** → same as bang, plus `scale: {name, location, freqs[], cents[]}` attached

**string** → switches to the named tuning (partial, case-insensitive match), no output

**noteOn** → emits `pitchBend` then `noteOn`, both with `frequency` field. Note is mapped to a gong via `note % gongCount`, then pitch-bent to the exact microtonal frequency (±2 semitone bend range).

**noteOff** → emits `noteOff` with `frequency` field

## MIDI Microtuning

Wire a [midi.in](/docs/objects/midi.in) node into ngea to retune a MIDI controller to any
Southeast Asian gong ensemble tuning. Wire the output to [midi.out](/docs/objects/midi.out)
to hear the result on a synth:

```
midi.in → ngea → midi.out
```

Each incoming MIDI note is mapped to a gong (`note % gongCount`), then
a `pitchBend` message is emitted before the `noteOn` to bend the synth to
the exact frequency. The bend value is normalized to -1.0–1.0 assuming a ±2
semitone range — match this in your synth's pitch bend range setting.

## Strudel Integration

NGEA tunings are registered globally in Strudel. Use `.ngea(name)`
directly on any pattern — no node connection needed:

```js
// Chain directly on a pattern — maps indices to gong frequencies
"0 2 4 6 3 1".slow(2).ngea('Khong Wong Yai')

// Or use ngea() as a frequency array lookup
note("0 2 4 1".slow(2)).freq(i => ngea('Sumba')[i])
```

Use **single quotes** for the tuning name — double quotes are
interpreted as mini-notation in Strudel.

Names are partial, case-insensitive matches against the tuning title
(e.g. `'Khong'`, `'Sumba'`, `'T\'boli'`, `'Ede Bih'`).

## See Also

- [midi.in](/docs/objects/midi.in) — source of MIDI notes to retune
- [midi.out](/docs/objects/midi.out) — send retuned MIDI to a synth
- [osc~](/docs/objects/osc~) — connect gong freqs to an oscillator
- [strudel](/docs/objects/strudel) — sequence gongs with Strudel patterns
- [metro](/docs/objects/metro) — clock to step through gong indices
