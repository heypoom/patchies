`wam~` loads a [Web Audio Module](https://www.webaudiomodules.com/)
(WAM) from its JavaScript entry URL. It works as either an instrument or an
effect: connect audio to its signal inlet when the WAM accepts audio, then send
its output to [out~](/docs/objects/out~).

The default module is the Big Muff effect. Open the settings menu and browse
the community registry to load another WAM. The module's own GUI appears in
the node.

## Community browser

Use **Browse community WAMs** in settings to fetch the current
[WAM community registry](https://www.webaudiomodules.com/community/plugins.json).
Choose a plugin to load it immediately.
Use **Load from URL** when you already have an entry URL from another
source.

```text
[midi.in] -> [wam~] -> [out~]
```

## MIDI

The message inlet accepts Patchies MIDI messages and sends them to the loaded
module as WAM MIDI events:

```text
{ type: "noteOn", note: 60, velocity: 100, channel: 1 }
{ type: "noteOff", note: 60, velocity: 0, channel: 1 }
{ type: "controlChange", control: 1, value: 64, channel: 1 }
{ type: "programChange", program: 5, channel: 1 }
```

Use [midi.in](/docs/objects/midi) or [midi.file](/docs/objects/midi.file) as a
source. Channels are 1-based, as elsewhere in Patchies.

## Control messages

The same message inlet controls the loaded WAM. Use the module's exposed
parameter IDs for `key` and `params` keys.

```js
// Set one parameter now, or schedule it at an audio time.
{ type: 'set', key: 'drive', value: 0.7 }
{ type: 'set', key: 'drive', value: 0.7, time: 12.5 }

// Send a batch of parameter values.
{ type: 'set', params: { drive: 0.7, tone: 0.35 } }

// Save the WAM's current state into the patch.
{ type: 'save' }

// Load a WAM, apply state to the current WAM, or do both together.
{ type: 'load', url: 'https://example.com/wam/index.js' }
{ type: 'load', state: { /* state from this WAM */ } }
{ type: 'load', url: 'https://example.com/wam/index.js', state: { /* state */ } }

// Control Patchies' output gain for this node.
{ type: 'mute' }
{ type: 'unmute' }
```

`time` is an absolute `AudioContext.currentTime` timestamp, matching
[parameter automation](/docs/parameter-automation). Use `timeMode: 'relative'`
when `time` is seconds from now. Scheduled values are sent as WAM automation
events; values without `time` use the module's immediate parameter API.

> **Tip**: Parameter IDs are defined by each WAM. A module that does not expose
> a parameter or state API ignores the corresponding control message.

## State

Click **Save state** after changing a plugin setting, or send `{ type: 'save' }`.
Patchies stores the state returned by the module and provides it again on the
next load. `{ type: 'load', state }` applies and stores a snapshot on the current
WAM. Supplying both `url` and `state` loads that WAM with the snapshot. Loading
a URL without state clears the old module's saved state.

Use **Mute output** in settings to silence the WAM without stopping its audio
runtime. This has the same effect as sending `{ type: 'mute' }` and persists
with the patch.

## Parameters and state

Open the **Parameters** tab in settings to inspect the parameter IDs and current
values exposed by the module. Copy a parameter ID to use as the `key` in a
`set` message. Use **Copy state** to copy the current serializable state as
formatted JSON.

`wam~` is headless at runtime: its audio and MIDI processing continues while
the node is offscreen. Closing or culling the GUI does not unload the WAM.

## Resizing

Turn on **Enable resizing** in settings, or right-click the node and select
the same action. Resize handles appear while the node is selected. Disable it
again from either place when you want to lock the node size.

When a WAM GUI loads, `wam~` automatically fits the node to that GUI. Loading
a different WAM replaces the previous size with the new GUI’s size. The resize
handles preserve the WAM GUI's aspect ratio and cannot make it smaller than its
native dimensions. Manual
resizing stores the width and height in the patch, so the node keeps your size
after reopening it until you load a different WAM.

## Limitations

- We load WAM entry URLs directly. Only use URLs from sources you trust!
- It only supports one audio input, one audio output, MIDI and
control messages, and a single attached plugin GUI.

## See Also

- [midi.in](/docs/objects/midi) - MIDI input device
- [midi.file](/docs/objects/midi.file) - Standard MIDI file player
- [out~](/docs/objects/out~) - audio output
