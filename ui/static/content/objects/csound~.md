[Csound](https://csound.com) audio programming language for synthesis and
processing.

## Editor Layout

The code editor is placed inline in the patch.

- Select the object and drag the resize handles to change the container size. Code scrolls inside its container.
- Use **Disable Resizing** to lock that size.
- Use **Hide Code** for a compact object that keeps running headlessly. Clicking
  on the code button opens the code in the preferred editor (e.g. inline, sidebar).
- **Keep Editor in Patch** restores the inline editor.
- **Expand Editor** opens the editor in fullscreen.

To update code while it is hidden, connect a `js` object to the message inlet:

```javascript
// Store new code without interrupting the running program.
send({
  type: 'setCode',
  value: 'instr 1\n a1 oscili 0.2, 440\n outs a1, a1\nendin\nschedule(1, 0, 1)'
})

// Run the stored code when you are ready.
send({type: 'bang'})
```

## Transport Sync

Enable **Sync to transport** in the overflow menu to lock playback to the global
[transport](/docs/transport-control). When synced, play/pause is controlled by
the transport bar instead of per-node controls.

## Resources

If you'd like to support Csound's development, check out their
[contribution page](https://csound.com/contribute.html)!

## See Also

- [sonic~](/docs/objects/sonic~) - SuperCollider synthesis
- [tone~](/docs/objects/tone~) - Tone.js synthesis
- [chuck~](/docs/objects/chuck~) - ChucK audio programming
