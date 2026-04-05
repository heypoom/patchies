The `textmode.dom` object creates ASCII art and text-mode graphics using [textmode.js](https://code.textmode.art). It runs on the main thread with full interactivity support.

![Textmode demo](/content/images/textmode.webp)

> ✨ [Try this patch](/?id=3hd88qv62h4zltq)! Code sample and library by [@humanbydefinition](https://github.com/humanbydefinition)

## Getting Started

The textmode instance is exposed as `tm`:

```javascript
t.setup(() => {
  t.fontSize(16);
  t.frameRate(60);
});

t.draw(() => {
  t.background(0, 0, 0, 0);

  t.push();
  t.char("█");
  t.charColor(0, 150, 255);
  t.point();
  t.pop();
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

### Synth Plugin

The [textmode.synth.js](https://code.textmode.art/api/textmode.synth.js/) plugin provides composable visual sources for generating patterns, gradients, and effects. All synth functions are available as top-level globals — no import needed.

```javascript
t.setup(() => {
  t.fontSize(12);
});

t.draw(() => {
  t.background(0);

  t.push();
  t.cellColor(gradient(0.5, 1));
  t.charColor(noise(0.02, 0.5));
  t.char("█");
  t.point();
  t.pop();
});
```

> **Tip**: Try the [synth playground](https://synth.textmode.art) to experiment with these functions interactively.

See the [full synth API reference](https://code.textmode.art/api/textmode.synth.js/) for all options and chaining methods.

### Filters Plugin

Use [textmode.filters.js](https://github.com/humanbydefinition/textmode.filters.js) for image filters:

```javascript
t.layers.base.filter('brightness', 1.3);
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
