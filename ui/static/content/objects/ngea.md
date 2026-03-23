Microtonal tuning data from the [Network Gong Ensemble Archive](https://networkgongensemblearchive.online).

Frequency measurements of gong ensembles from Thailand, Cambodia,
Indonesia, Philippines, Myanmar, and Vietnam.

Data used with permission from the original author, Elekhlekha. 
Licensed CC BY-SA 4.0.

## Usage

Select a tuning from the dropdown.

Send a **number** (0-based gong index) to outlet 0 to get that gong's data.

Send a **bang** to get the current gong. Outlet 1 emits the full scale when banged.

## Strudel Integration

NGEA tunings are registered globally in Strudel. Use `.ngea(name)`
directly on any pattern — no node connection needed:

```js
// Chain directly on a pattern — maps indices to gong frequencies
"0 2 4 6 3 1".slow(2).ngea('khong-wong-yai')

// Or use ngea() as a frequency array lookup
note("0 2 4 1".slow(2)).freq(i => ngea('sumba')[i])
```

Use **single quotes** for the tuning name — double quotes are
interpreted as mini-notation in Strudel.

Names are partial, case-insensitive matches against the tuning title
(e.g. `'khong'`, `'sumba'`, `'tboli'`, `'ede bih'`).

## See Also

- [osc~](/docs/objects/osc~) — connect gong freqs to an oscillator
- [strudel](/docs/objects/strudel) — sequence gongs with Strudel patterns
- [metro](/docs/objects/metro) — clock to step through gong indices
