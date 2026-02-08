Integrates [SuperSonic](https://sonic-pi.net/supersonic/demo.html), which brings
SuperCollider's powerful `scsynth` audio engine to the browser via AudioWorklet.

## Context

The `sonic~` context provides:

- `sonic`: SuperSonic instance for synthesis control
- `SuperSonic`: Class for static methods (e.g., `SuperSonic.osc.encode()`)
- `sonicNode`: Audio node wrapper (`sonic.node`)
- `on(event, callback)`: Subscribe to events
- `inputNode`: Audio input GainNode
- `outputNode`: Audio output GainNode

Available events: `'ready'`, `'loading:start'`, `'loading:complete'`,
`'error'`, `'message'`

## Messaging

Supports [Patchies JavaScript Runner](/docs/javascript-runner) functions
(`send`, `recv`, `setPortCount`, `onCleanup`, etc.).

## Load and Play Synth

```js
setPortCount(1);

await sonic.loadSynthDef('sonic-pi-prophet');

recv((note) => {
  sonic.send('/s_new', 'sonic-pi-prophet', -1, 0, 0,
    'note', note, 'release', 2);
});
```

## Load and Play Samples

```js
await sonic.loadSynthDef('sonic-pi-basic_stereo_player');
await sonic.loadSample(0, 'loop_amen.flac');
await sonic.sync();

sonic.send('/s_new', 'sonic-pi-basic_stereo_player', -1, 0, 0,
  'buf', 0, 'rate', 1);
```

## Resources

- [SuperSonic documentation](https://github.com/samaaron/supersonic)
- [scsynth OSC reference](http://doc.sccode.org/Reference/Server-Command-Reference.html)

Please consider supporting
[Sam Aaron on Patreon](https://www.patreon.com/samaaron)!

## See Also

- [tone~](/docs/objects/tone~) - Tone.js synthesis
- [elem~](/docs/objects/elem~) - Elementary Audio synthesis
- [csound~](/docs/objects/csound~) - Csound synthesis
