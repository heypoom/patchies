The `hydra` object creates a [Hydra](https://hydra.ojack.xyz) live coding video synthesizer. Hydra is created by [Olivia Jack](https://ojack.xyz) and lets you create all kinds of video effects with minimal code.

![Random walker with Hydra shader](/content/images/patchies-random-walker.png)

> Try out [this demo](/?id=f4tvzfxk1qr4xr2) which uses P5.js with Hydra to create a random walk shader.

## Getting Started

Write Hydra code directly in the editor. The standard Hydra API works as expected:

```javascript
osc(10, 0.1, 1.5)
  .rotate(0.5)
  .out()
```

See the [Hydra documentation](https://hydra.ojack.xyz/docs) to learn how to use Hydra. Try out the standalone editor at [hydra.ojack.xyz](https://hydra.ojack.xyz) to see how Hydra works - use the "shuffle" button to get code samples you can copy into Patchies.

## Special Functions

See the [Patchies JavaScript Runner](/docs/javascript-runner) for all available functions like `send()`, `recv()`, `setPortCount()`, `onCleanup()`, and more.

Hydra-specific functions:

- `setVideoCount(ins = 1, outs = 1)` - creates the specified number of video source ports
  - `setVideoCount(2)` initializes `s0` and `s1` sources with the first two visual inlets
- `setMouseScope('global' | 'local')` - sets mouse tracking scope
  - `'local'` (default) tracks mouse within the canvas preview
  - `'global'` tracks mouse across the entire screen

## Available Objects

- Full Hydra synth is available as `h`
- Outputs are available as `o0`, `o1`, `o2`, and `o3`
- `mouse.x` and `mouse.y` provide real-time mouse coordinates (scope depends on `setMouseScope`)

## Presets

Try out these presets to get started:

- `pipe.hydra` - passes the image through without any changes
- `diff.hydra`, `add.hydra`, `sub.hydra`, `blend.hydra`, `mask.hydra` - perform image operations on two video inputs
- `filet-mignon.hydra` - example code from [AFALFL](https://www.instagram.com/a_f_alfl) (CC BY-NC-SA 4.0)
- `fft.hydra` - audio-reactive visualization

## Audio Reactivity

Patchies does NOT use standard Hydra audio reactivity APIs like `a.fft[0]`.

Instead, use `fft()` inside arrow functions to get the FFT data. Hydra **must** be connected to a [fft~](/docs/objects/fft~) object. See the [Audio Reactivity](/docs/audio-reactivity) topic.

```javascript
osc(() => fft().getEnergy('bass') / 255).out()
```

## Resources

- [Hydra Documentation](https://hydra.ojack.xyz/docs) - official docs
- [Hydra Functions Reference](https://hydra.ojack.xyz/api) - API reference
- [Olivia Jack's website](https://ojack.xyz/) - learn more about her work

## See Also

- [p5](/docs/objects/p5) - creative coding with P5.js
- [glsl](/docs/objects/glsl) - shader programming
- [canvas](/docs/objects/canvas) - vanilla Canvas API
