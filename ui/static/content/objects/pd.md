`pd` loads a [Pure Data](https://puredata.info/) patch.

It uses the full `libpd` runtime, including vanilla Pd, Cyclone, and
ELSE. Connect its stereo audio inlet and outlet like any other audio processor.

## Load a patch

Drop a `.pd` file onto the canvas to create a configured `pd` object. You can
also add a patch to the Patchies filesystem, drag it from the Files sidebar, or
enter its VFS path in the object's settings and select **Load**.

```text
patch://pd/main.pd
```

Sibling `.pd` files below the same directory are loaded too, so local
abstractions can resolve.

## Edit patch code

Select the code button above the object to inspect or edit the loaded `.pd`
source. Press Shift+Enter or leave the editor to load your changes.

Patchies stores only the VFS path or URL until you change the code. After the
first edit, the modified source is stored with the object. Loading another VFS
path or URL clears that copy and reads from the external source again.

## Messages

Use `set` to send a Patchies value to a named Pd receiver:

```js
{ type: 'set', key: 'frequency', value: 440 }
{ type: 'set', key: 'waveform', value: 'sine' }
{ type: 'set', key: 'chord', value: [60, 64, 67] }
{ type: 'set', key: 'reset', value: { type: 'bang' } }
```

Numbers become Pd floats, strings become symbols, arrays become lists, and a
Patchies bang becomes a Pd bang.

The message inlet can also replace the running patch from a VFS path, an HTTP(S)
URL, or a Pd source string:

```js
{ type: 'load', src: 'patch://pd/main.pd' }
{ type: 'load', src: 'https://example.com/main.pd' }
{ type: 'load', code: '#N canvas 0 0 450 300 10;\n#X obj 20 20 osc~ 440;\n#X obj 20 60 dac~;' }
```

URL and inline-code loads contain a single patch file. Use a VFS directory when
the patch depends on sibling abstractions.

## Expose patch ports

After analysis, settings lists root-canvas `inlet`, `inlet~`, `outlet`, and
`outlet~` objects. It also lists literal `receive`/`r` and `send`/`s` names.
Names containing substitutions such as `$0` are ignored because they cannot be
addressed reliably outside the patch.

Select message ports to add direct message handles. The first two selected
audio inputs and outputs map to the left and right channels of the object's
stereo audio handles.

## Limitations

- MIDI messages are not supported yet.
- Only `.pd` text files are copied into libpd's virtual filesystem.
- Audio-rate abstraction ports are limited to two input and two output channels.
- Named sends and receives may be internal details of a patch. Only expose the
  ones intended as a public interface.

## See Also

- [out~](/docs/objects/out~) - audio output
- [msg](/docs/objects/msg) - send a control message
