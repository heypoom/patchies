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

To use your own sample, use a URL or use `loadVfsUrl` to load
from the [Virtual Filesystem](/docs/virtual-filesystem).

```js
await sonic.loadSample(0, await loadVfsUrl('user://loop.wav'));
```

## Polyphonic MIDI Synth

Handles MIDI `noteOn`/`noteOff` messages with polyphonic voice management.
Each note gets its own synth instance, and voices are freed when released.

```js
setPortCount(1);

const name = 'sonic-pi-prophet';
setTitle(name);

await sonic.loadSynthDef(name);

const activeNotes = new Map();

recv(msg => {
  if (!msg || typeof msg !== 'object') return;

  const { type, note, velocity } = msg;

  if (type === 'noteOn') {
    if (activeNotes.has(note)) {
      sonic.send('/n_set', activeNotes.get(note), 'gate', 0);
    }

    const id = sonic.nextNodeId();
    activeNotes.set(note, id);

    sonic.send('/s_new', name, id, 0, 0,
      'note', note,
      'amp', (velocity || 127) / 127,
      'gate', 1,
      'out_bus', outBus
    );
  } else if (type === 'noteOff') {
    const id = activeNotes.get(note);

    if (id !== undefined) {
      sonic.send('/n_set', id, 'gate', 0);
      activeNotes.delete(note);
    }
  }
});

onCleanup(() => {
  activeNotes.forEach(id => sonic.send('/n_free', id));
  activeNotes.clear();
});
```

Connect a `midi-in` node to send MIDI messages. The `onCleanup`
handler frees all active voices when the node is removed.

## Using SuperSonic in Workers

You can send OSC messages to scsynth directly from a `worker` node
using `getSuperSonicChannel()`. This gives you a dedicated `OscChannel`
that bypasses the main thread. Ideal for sequencers, LFOs, or any
timing-sensitive code.

```js
const { channel, osc } = await getSuperSonicChannel()
```

This returns both the `OscChannel` for sending messages and the
`osc` encoder for building OSC packets.

```js
const { channel, osc } = await getSuperSonicChannel()

const msg = osc.encodeMessage('/s_new',
  ['sonic-pi-beep', -1, 0, 0, 'note', 64, 'amp', 0.5,
   'out_bus', 0])

channel.send(msg)
```

Pass `out_bus` to route audio to the correct `sonic~` node's
isolated output. You can send `outBus` from a connected `sonic~` node.

The channel is automatically closed when the worker re-runs or is deleted.

### Worker Sequencer

Connect a `sonic~` node's outlet to this worker's inlet to receive
the `outBus` value for audio routing.

```js
const { channel, osc } = await getSuperSonicChannel()

let outBus = 0
recv((msg) => { outBus = msg })

const pattern = [60, 62, 64, 65, 67, 65, 64, 62]
let step = 0

setInterval(() => {
  const note = pattern[step % pattern.length]

  channel.send(osc.encodeMessage('/s_new',
    ['sonic-pi-beep', -1, 0, 0, 'note', note, 'amp', 0.3,
     'out_bus', outBus]))

  step++
}, 200)
```

> **Tip**: `channel.sendDirect(bytes)` bypasses the prescheduler
> for messages that must arrive immediately.

---

## Using OscChannel in an AudioWorklet

OscChannel can also be used inside a `dsp~` AudioWorklet processor,
not just Web Workers. This lets custom AudioWorklet code send OSC
directly to scsynth without routing through the main thread.

There are three key differences from worker usage:

**1. Import from the AudioWorklet-safe entry point**

The standard `supersonic-scsynth` entry point pulls in `TextDecoder`,
`Worker`, and DOM APIs that aren't available in
`AudioWorkletGlobalScope`. The `dsp~` processor uses the slim entry
point (`supersonic-scsynth/osc-channel`) automatically — you don't
need to import anything.

**2. `blocking: false` (SAB mode)**

In SAB mode, AudioWorklet code runs on the audio rendering thread,
which cannot call `Atomics.wait()`. Channels created for `dsp~` are
automatically set to `blocking: false` for non-blocking ring buffer
writes.

**3. No `osc` encoder available**

The slim entry point only exports `OscChannel`. Unlike workers,
`getSuperSonicChannel()` in `dsp~` returns `{ channel }` without
the `osc` encoder. Encode your OSC bytes in a connected `worker`
or `js` node and send them via message passing.

```js
let channel

getSuperSonicChannel().then(result => {
  channel = result.channel
})

recv((oscBytes) => {
  if (channel) channel.send(oscBytes)
})

function process(inputs, outputs) {
  // audio processing here
}
```

**4. NTP time source**

`performance.timeOrigin` is unavailable in `AudioWorkletGlobalScope`,
so the default NTP clock won't work for far-future bundle scheduling.
Use the `getCurrentNTP` setter to provide the AudioWorklet's own
time source:

```js
getSuperSonicChannel().then(({ channel }) => {
  channel.getCurrentNTP = () => {
    return currentTime + ntpStartTime + driftOffset
  }
})
```

---

## Resources

- [Welcome docs for SuperSonic](https://github.com/samaaron/supersonic/blob/main/docs/WELCOME.md)
- [Quickstart for SuperSonic](https://github.com/samaaron/supersonic/blob/main/docs/QUICKSTART.md)
- [Scsynth OSC command reference](https://github.com/samaaron/supersonic/blob/main/docs/SCSYNTH_COMMAND_REFERENCE.md)
- [Included synthesizer definition list](https://github.com/samaaron/supersonic/tree/main/packages/supersonic-scsynth-synthdefs)
- [API reference for SuperSonic](https://github.com/samaaron/supersonic/blob/main/docs/API.md)
- [SuperSonic code on GitHub](https://github.com/samaaron/supersonic)
- [Original scsynth OSC command reference](http://doc.sccode.org/Reference/Server-Command-Reference.html)

Please consider supporting
[Sam Aaron on Patreon](https://www.patreon.com/samaaron)!

## See Also

- [chuck~](/docs/objects/chuck~) - ChucK real-time synthesis language
- [tone~](/docs/objects/tone~) - Tone.js library
- [elem~](/docs/objects/elem~) - Elementary Audio low-level synthesis
- [csound~](/docs/objects/csound~) - Csound synthesis language
