The `hydra` object creates a [Hydra](https://hydra.ojack.xyz) live coding video synthesizer. Hydra is created by [Olivia Jack](https://ojack.xyz) and lets you create all kinds of video effects with minimal code.

![Random walker with Hydra shader](/content/images/patchies-random-walker.png)

> Try out [this demo](/?id=ng7a8mcxobde7kv) which uses P5.js with Hydra to create a random walk shader.

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

- `hydra>` - passes the image through without any changes
- `diff.hydra`, `add.hydra`, `sub.hydra`, `blend.hydra`, `mask.hydra` - perform image operations on two video inputs
- `filet-mignon.hydra` - example code from [AFALFL](https://www.instagram.com/a_f_alfl) (CC BY-NC-SA 4.0)
- `fft.hydra` - audio-reactive visualization

---

## Custom Functions

`setFunction` lets you define your own Hydra generators and modifiers, just like
the built-in `osc`, `noise`, and `rotate` functions. Custom functions become
chainable like any other Hydra transform.

```javascript
const crystalNoise = await setFunction({
  name: 'crystalNoise',
  type: 'src',
  inputs: [
    { type: 'float', name: 'scale', default: 4.0 },
    { type: 'float', name: 'speed', default: 0.1 },
  ],
  glsl: `
    return vec4(vec3(sin(_st.x * scale + time * speed)), 1.0);
  `,
})

crystalNoise(8.0, 0.2).rotate(0.5).out()
```

`setFunction` is async — always `await` it before using the returned generator.

The `type` field controls how the function fits into the Hydra chain:

| Type | GLSL receives | Use for |
| --- | --- | --- |
| `src` | `vec2 _st` | Generators — starting points of a chain |
| `color` | `vec4 _c0` | Color effects applied to an existing chain |
| `coord` | `vec2 _st` | Coordinate transforms (like `rotate`, `scale`) |
| `combine` | `vec4 _c0` + second chain | Blending two chains together |
| `combineCoord` | `vec2 _st` + second chain | Warping coordinates using another chain |

For modifier types (`color`, `coord`, `combine`, `combineCoord`), the returned
value is unused — the method is added to all chains automatically:

```javascript
await setFunction({
  name: 'glitch',
  type: 'color',
  inputs: [{ type: 'float', name: 'amount', default: 0.05 }],
  glsl: `
    float shift = sin(time * 20.0) * amount;

    return vec4(_c0.r + shift, _c0.g, _c0.b - shift, _c0.a);
  `,
})

osc(30).glitch(0.1).out()
```

### Using `#include` in Custom Functions

The `glsl` field supports [`#include` directives](/docs/topics/glsl-imports), so
you can pull in functions from [lygia](https://lygia.xyz) or other sources:

```javascript
const snoiseGen = await setFunction({
  name: 'snoiseGen',
  type: 'src',
  inputs: [{ type: 'float', name: 'scale', default: 4.0 }],
  glsl: `
    #include <lygia/generative/snoise>

    float n = snoise(vec3(_st * scale, time));

    return vec4(vec3(n * 0.5 + 0.5), 1.0);
  `,
})

snoiseGen(6.0).kaleid(6).out()
```

### Sharing Custom Functions Across Nodes

Use a [Shared Library](/docs/topics/javascript-runner#shared-libraries)
(`// @lib`) to define custom functions once and reuse them in multiple
`hydra` objects.

In JS object:

```javascript
// @lib hydra-utils

export const getUtils = async () => ({
  snoiseGen: await setFunction({
    name: 'snoiseGen',
    type: 'src',
    inputs: [{ type: 'float', name: 'scale', default: 4.0 }],
    glsl: `
      #include <lygia/generative/snoise>
      float n = snoise(vec3(_st * scale, time));
      return vec4(vec3(n * 0.5 + 0.5), 1.0);
    `,
  }),
})
```

In Hydra object:

```javascript
import { getUtils } from 'hydra-utils'

const { snoiseGen } = await getUtils()

snoiseGen(6.0)
  .kaleid(4)
  .out()
```

---

## Audio Reactivity

Patchies does NOT use standard Hydra audio reactivity APIs like `a.fft[0]`.

Instead, use `fft()` inside arrow functions to get the FFT data. Hydra **must** be connected to a [fft~](/docs/objects/fft~) object. See the [Audio Reactivity](/docs/audio-reactivity) topic.

```javascript
osc(() => fft().getEnergy('bass')).out()
```

## Resources

- [Hydra Documentation](https://hydra.ojack.xyz/docs)
- [Hydra Functions Reference](https://hydra.ojack.xyz/api)
- [Hydra Book](https://hydra-book.glitches.me)
- [Olivia Jack's Website](https://ojack.xyz/)

## See Also

- [p5](/docs/objects/p5) - creative coding with P5.js
- [glsl](/docs/objects/glsl) - shader programming
- [canvas](/docs/objects/canvas) - vanilla Canvas API
