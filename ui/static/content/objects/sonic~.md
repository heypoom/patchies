Integrates [SuperSonic](https://sonic-pi.net/supersonic), which brings
SuperCollider's powerful `scsynth` audio engine to the browser via AudioWorklet.

`scsynth` is the synth engine James McCartney created for version 3 of [SuperCollider](https://supercollider.github.io/),
a platform for audio synthesis and algorithmic composition.

Sam Aaron compiled the original `scsynth` engine to WebAssembly and made SuperSonic,
letting you use OSC messages to trigger synths with sample-accurate timing.

Try out [the SuperSonic demo here](https://sonic-pi.net/supersonic/demo.html#demo).

## Context

The `sonic~` JavaScript context provides:

- `sonic`: SuperSonic instance for synthesis control
- `SuperSonic`: Class for static methods (e.g., `SuperSonic.osc.encode()`)
- `sonicNode`: Audio node wrapper (`sonic.node`)
- `on(event, callback)`: Subscribe to events
- `inputNode`: Audio input GainNode
- `outputNode`: Audio output GainNode
- `outBus`: Assigned output bus index for this node (number)

## Audio Routing

Each `sonic~` node gets its own isolated stereo output bus
from the shared scsynth engine.

Use `outBus` to route your synths to the correct output:

```js
sonic.send('/s_new', 'sonic-pi-beep', -1, 0, 0,
  'note', 64, 'out_bus', outBus);
```

Most `sonic-pi-*` synthdefs accept an `out_bus` parameter.
Always pass `'out_bus', outBus` to keep audio isolated between
`sonic~` nodes.

Up to 16 `sonic~` nodes can have isolated output buses.
Beyond that, `outBus` falls back to 0 (shared output).

Available events: `'ready'`, `'loading:start'`, `'loading:complete'`,
`'error'`, `'message'`

## Messaging

Supports [Patchies JavaScript Runner](/docs/javascript-runner) functions
(`send`, `recv`, `setPortCount`, `onCleanup`, etc.).

## Command Listener

SuperSonic works by sending OSC (OpenSoundControl) messages to the synth engine.

For example, you can send `'/s_new' 'sonic-pi-beep' -1 0 0 'note' 64 'release' 2`.
Make sure to load the synth with `loadSynthDef` first

```js
setPortCount(1)

recv(msg => sonic.send(...msg))
```

## Load and Play Synth

```js
setPortCount(1);

await sonic.loadSynthDef('sonic-pi-prophet');

recv((note) => {
  sonic.send('/s_new', 'sonic-pi-prophet', -1, 0, 0,
    'note', note, 'release', 2, 'out_bus', outBus);
});
```

## Load and Play Samples

This loads the built-in sample from SuperSonic.

```js
await sonic.loadSynthDef('sonic-pi-basic_stereo_player');
await sonic.loadSample(0, 'loop_amen.flac');
await sonic.sync();

sonic.send('/s_new', 'sonic-pi-basic_stereo_player',
  -1, 0, 0, 'buf', 0, 'rate', 1, 'out_bus', outBus);
```

To use your own sample, use loadVfsUrl from the [Virtual Filesystem](/docs/virtual-filesystem) API.

```js
await sonic.loadSample(0, await loadVfsUrl('user://loop.wav'));
```

## Resources

- [welcome docs for SuperSonic](https://github.com/samaaron/supersonic/blob/main/docs/WELCOME.md)
- [quickstart for SuperSonic](https://github.com/samaaron/supersonic/blob/main/docs/QUICKSTART.md)
- [scsynth OSC command reference](https://github.com/samaaron/supersonic/blob/main/docs/SCSYNTH_COMMAND_REFERENCE.md)
- [included synthesizer definition list](https://github.com/samaaron/supersonic/tree/main/packages/supersonic-scsynth-synthdefs)
- [API reference for SuperSonic](https://github.com/samaaron/supersonic/blob/main/docs/API.md)
- [SuperSonic code on GitHub](https://github.com/samaaron/supersonic)
- [original scsynth OSC command reference](http://doc.sccode.org/Reference/Server-Command-Reference.html)

Please consider supporting
[Sam Aaron on Patreon](https://www.patreon.com/samaaron)!

## See Also

- [chuck~](/docs/objects/chuck~) - ChucK real-time synthesis language
- [tone~](/docs/objects/tone~) - Tone.js library
- [elem~](/docs/objects/elem~) - Elementary Audio low-level synthesis
- [csound~](/docs/objects/csound~) - Csound synthesis language
