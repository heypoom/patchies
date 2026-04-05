The `textmode` object creates ASCII art and text-mode graphics using [textmode.js](https://code.textmode.art). It runs on a web worker for fast video chaining.

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

## Comparison with textmode.dom

| Feature | `textmode` | `textmode.dom` |
|---------|------------|----------------|
| Runs on | Web worker | Main thread |
| Video chaining | Fast | Slow (CPU-to-GPU copy) |
| Mouse/touch/keyboard | No | Yes |
| Images/videos | No | Yes |
| Custom fonts | No | Yes |

Need interactivity or media loading? Use [textmode.dom](/docs/objects/textmode.dom) instead.

## Special Functions

See the [Patchies JavaScript Runner](/docs/javascript-runner) for all available functions.

Textmode-specific:

- `noOutput()` - hides video output port
- `setHidePorts(true | false)` - hide/show all ports
- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` - see [Canvas Interaction](/docs/canvas-interaction)
- `fft()` - audio analysis

## Plugins

### Filters Plugin

Use [textmode.filters.js](https://github.com/humanbydefinition/textmode.filters.js) for image filters:

```javascript
t.layers.base.filter('brightness', 1.3);
```

### Synth Plugin

The [textmode.synth.js](https://code.textmode.art/api/textmode.synth.js/) plugin
provides composable visual sources for generating patterns, gradients, and
effects. All synth functions are available as top-level globals.

```javascript
const label = "synth.textmode.art";

t.setup(() => {
  t.fontSize(16);
})

t.layers.base.synth( // define a synth for the textmode.js base layer
  char(osc(2, -0.1, 0.5).kaleid(20))
    .charMap("@#%*+=-:. ")
    .charColor(osc(25, -0.1, 0.5).kaleid(50))
    .cellColor(osc(25, -0.1, 0.5).kaleid(50).colorama(0.1))
);

// custom layer for the label, rendered on top of the base layer
const labelLayer = t.layers.add({
  fontSize: 64,
  blendMode: "difference"
});

const drawText = (s, x, y) => {
  t.charColor("#fff");
  t.cellColor(0, 0, 0, 0);

  for (let i = 0; i < s.length; i++) {
    t.translate(x + i, y);
    t.char(s[i]);
    t.rect(1, 1);
    t.translate(-(x + i), -y);
  }
};

t.draw(() => { // base layer draw loop
  const a = t.frameCount * 0.05, n = t.frameCount;

  t.filter("hueRotate", n);
  t.filter("chromaticAberration", { amount: 8, direction: [Math.sin(a), Math.cos(a)] });
  t.filter("glitch", (n * 0.01) % 0.2);
});

labelLayer.draw(() => {
  t.clear();
  drawText(label, -label.length / 2, 0);

  const time = t.frameCount / 60;
  const R = Math.min(width, height) * 0.05;

  const x = R * (0.70 * Math.sin(time * 0.93) + 0.22 * Math.sin(time * 2.41 + 1.2) + 0.08 * Math.sin(time * 6.90 + 0.4));
  const y = R * (0.70 * Math.cos(time * 1.07) + 0.20 * Math.cos(time * 2.83 + 0.7) + 0.10 * Math.cos(time * 7.30 + 2.1));
  labelLayer.offset(x, y);
});
```

> **Tip**: Try the [synth playground](https://synth.textmode.art) to experiment
> with these functions interactively.

See the [full synth API reference](https://code.textmode.art/api/textmode.synth.js/) for
all options and chaining methods.

## Presets

- `digital-rain.tm` - Matrix-style rain effect
- `animated-wave.tm` - Animated wave pattern
- `plasma-field.tm` - Plasma effect
- `rain.tm`, `torus.tm`, `fire.tm` - More examples

## Resources

- [Textmode.js Documentation](https://code.textmode.art/docs/introduction.html) - full reference
- [Support @humanbydefinition](https://code.textmode.art/docs/support.html) - support the creator

## See Also

- [textmode.dom](/docs/objects/textmode.dom) - main thread variant with interactivity
- [canvas](/docs/objects/canvas) - HTML5 canvas graphics
- [glsl](/docs/objects/glsl) - GPU shaders
