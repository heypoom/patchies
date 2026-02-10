The `textmode.dom` object creates ASCII art and text-mode graphics using [textmode.js](https://code.textmode.art). It runs on the main thread with full interactivity support.

![Textmode demo](/content/images/textmode.webp)

> ✨ [Try this patch](/?id=3hd88qv62h4zltq&readonly=true)! Code sample and library by [@humanbydefinition](https://github.com/humanbydefinition)

## Getting Started

The textmode instance is exposed as `tm`:

```javascript
tm.setup(() => {
  tm.fontSize(16);
  tm.frameRate(60);
});

tm.draw(() => {
  tm.background(0, 0, 0, 0);

  tm.push();
  tm.char("█");
  tm.charColor(0, 150, 255);
  tm.point();
  tm.pop();
});
```

## Comparison with textmode

| Feature | `textmode` | `textmode.dom` |
|---------|------------|----------------|
| Runs on | Web worker | Main thread |
| Video chaining | Fast | Slow (CPU-to-GPU copy) |
| Mouse/touch/keyboard | No | Yes |
| Images/videos | No | Yes |
| Custom fonts | No | Yes |

Use `textmode` for pure video processing. Use `textmode.dom` when you need interactivity.

## Interactivity

Full support for:

- [Mouse events](https://code.textmode.art/docs/events.html#mouse-events)
- [Touch events](https://code.textmode.art/docs/events.html#touch-events)
- [Keyboard events](https://code.textmode.art/docs/events.html#keyboard-events)

## Media Loading

Load [images and videos](https://code.textmode.art/docs/loadables.html) as textures.

## Special Functions

See the [Patchies JavaScript Runner](/docs/javascript-runner) for all available functions.

Textmode-specific:

- `noOutput()` - hides video output port
- `setHidePorts(true | false)` - hide/show all ports
- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` - see [Canvas Interaction](/docs/canvas-interaction)
- `fft()` - audio analysis with low latency

## Plugins

Use [textmode.filters.js](https://github.com/humanbydefinition/textmode.filters.js) for image filters:

```javascript
tm.layers.base.filter('brightness', 1.3);
```

## Presets

- `digital-rain.tm` - Matrix-style rain effect
- `animated-wave.tm` - Animated wave pattern
- `plasma-field.tm` - Plasma effect
- `rain.tm`, `torus.tm`, `fire.tm` - More examples

## Caution

> Too many `textmode.dom` objects can crash your browser with "Too many active WebGL contexts". Use sparingly.

## Resources

- [Textmode.js Documentation](https://code.textmode.art/docs/introduction.html) - full reference
- [Support @humanbydefinition](https://code.textmode.art/docs/support.html) - support the creator

## See Also

- [textmode](/docs/objects/textmode) - offscreen variant (faster for chaining)
- [canvas.dom](/docs/objects/canvas.dom) - HTML5 canvas with DOM access
- [glsl](/docs/objects/glsl) - GPU shaders
