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

Bang the node (or send any message) to emit the scale on outlet 1,
then receive it in a connected Strudel node:

```js
let freqs = [];
recv(msg => { if (msg?.type === 'scale') freqs = msg.freqs; });

note("0 2 4 1 5 3".slow(2))
  .freq(i => freqs[Math.round(i) % freqs.length] ?? 440)
```

The `scaleName` field (e.g. `ngea-khong-wong-yai`) is available in
the scale message for reference.

## See Also

- [osc~](/docs/objects/osc~) — connect gong freqs to an oscillator
- [strudel](/docs/objects/strudel) — sequence gongs with Strudel patterns
- [metro](/docs/objects/metro) — clock to step through gong indices
