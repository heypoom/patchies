# Object Settings

The `settings` API lets user code expose a configurable settings panel directly on a node. Call `settings.define()` with a schema and a gear icon appears — clicking it opens a floating panel with the defined controls.

![Object settings panel showing a hydra node with BPM slider, Mode select, Mute toggle, Color picker and API key field](/content/images/user-defined-settings.webp)

## Supported Objects

`settings` is available in: [js](/docs/objects/js), [worker](/docs/objects/worker), [p5](/docs/objects/p5), [canvas](/docs/objects/canvas), [canvas.dom](/docs/objects/canvas.dom), [textmode](/docs/objects/textmode), [textmode.dom](/docs/objects/textmode.dom), [three](/docs/objects/three), [three.dom](/docs/objects/three.dom), [hydra](/docs/objects/hydra), [swgl](/docs/objects/swgl), [dom](/docs/objects/dom), and [vue](/docs/objects/vue).

## Basic Usage

```javascript
await settings.define([
  { key: 'speed', type: 'slider', label: 'Speed', min: 0, max: 10, default: 1 },
  { key: 'color', type: 'color', label: 'Color', default: '#ff6600' },
  { key: 'mode', type: 'select', label: 'Mode', default: 'loop',
    options: [
      { label: 'Loop', value: 'loop' },
      { label: 'Ping-pong', value: 'pingpong' },
      { label: 'Once', value: 'once' }
    ]
  }
]);

// Read values synchronously after define() resolves
const speed = settings.get('speed');
const color = settings.get('color');
```

`define()` is async — it loads any persisted values before resolving. Always `await` it before calling `get()`.

## API Reference

### `settings.define(schema)`

Defines the settings schema. Opens the settings panel UI. Returns a Promise that resolves once persisted values are loaded.

Call once at the top level of your code. Re-running the code redefines the schema.

### `settings.get(key)`

Returns the current value for a field. Synchronous after `define()` has resolved.

```javascript
const opacity = settings.get('opacity'); // number
const label = settings.get('label');     // string
const active = settings.get('active');   // boolean
```

### `settings.getAll()`

Returns all current values as a plain object.

```javascript
const { speed, color, mode } = settings.getAll();
```

### `settings.set(key, value)`

Programmatically updates a setting value from code. The new value is persisted using the field's `persistence` setting and fires any registered `onChange` callbacks — so the panel updates in real time.

```javascript
settings.set('gain', 0.8);
settings.set('mode', 'loop');
```

Useful for updating settings from received messages or internal computations:

```javascript
recv((msg) => {
  settings.set('gain', msg.value);
});
```

### `settings.onChange(callback)`

Registers a callback that fires whenever a value changes — either from user interaction in the panel or from a `settings.set()` call.

```javascript
settings.onChange((key, value, allValues) => {
  console.log(key, value);     // changed field
  console.log(allValues);      // all current values
});
```

Registering `onChange` marks the node as active (green border). Callbacks are automatically cleared when code is re-run, so re-registering each run is intentional.

### `settings.clear()`

Resets all settings to defaults and clears persisted values.

## Field Types

### `slider`

A range slider. `min` and `max` are required.

```javascript
{ key: 'speed', type: 'slider', label: 'Speed', min: 0, max: 5, step: 0.1, default: 1 }
```

| Property | Type | Description |
| -------- | ---- | ----------- |
| `min` | number | Minimum value (required) |
| `max` | number | Maximum value (required) |
| `step` | number | Step increment (default: 1) |
| `default` | number | Initial value |

### `number`

A numeric input field.

```javascript
{ key: 'count', type: 'number', label: 'Count', min: 1, max: 100, default: 10 }
```

| Property | Type | Description |
| -------- | ---- | ----------- |
| `min` | number | Minimum value |
| `max` | number | Maximum value |
| `step` | number | Step increment |
| `default` | number | Initial value |

### `boolean`

A toggle switch.

```javascript
{ key: 'loop', type: 'boolean', label: 'Loop', default: true }
```

### `string`

A text input.

```javascript
{ key: 'label', type: 'string', label: 'Label', placeholder: 'Enter text...', default: 'Hello' }
```

### `select`

A dropdown with predefined options.

```javascript
{
  key: 'shape',
  type: 'select',
  label: 'Shape',
  default: 'circle',
  options: [
    { label: 'Circle', value: 'circle' },
    { label: 'Square', value: 'square' },
    { label: 'Triangle', value: 'triangle', description: 'Three-sided polygon' }
  ]
}
```

Option `description` shows as a tooltip.

### `color`

A color picker. Value is a hex string (e.g. `'#ff6600'`).

```javascript
{ key: 'bg', type: 'color', label: 'Background', default: '#000000' }
```

Optionally provide `presets` to show a swatch grid above the picker:

```javascript
{
  key: 'palette',
  type: 'color',
  label: 'Color',
  default: '#ff0000',
  presets: ['#ff0000', '#00ff00', '#0000ff', '#ffff00']
}
```

## Common Field Properties

All field types share these properties:

| Property | Type | Description |
| -------- | ---- | ----------- |
| `key` | string | Unique identifier, used with `settings.get(key)` |
| `label` | string | Display name shown in the panel |
| `type` | string | Field type: `slider`, `number`, `boolean`, `string`, `select`, `color` |
| `description` | string | Optional tooltip shown on the label |
| `default` | any | Default value |
| `persistence` | string | Where to store the value (see below) |

## Persistence

Control where values are stored using the `persistence` field property:

| Value | Behavior |
| ----- | -------- |
| `'node'` | Saved in the patch file — exported with the patch (default) |
| `'kv'` | Saved in local IndexedDB — persists across sessions but not exported |
| `'none'` | In-memory only — resets on page reload |

```javascript
settings.define([
  // Saved with patch — shared when you export or share the link
  { key: 'speed', type: 'slider', label: 'Speed', min: 0, max: 10, default: 1 },

  // Local only — your personal preference, not exported
  { key: 'theme', type: 'select', label: 'Theme', persistence: 'kv',
    options: [{ label: 'Dark', value: 'dark' }, { label: 'Light', value: 'light' }]
  },

  // Ephemeral — resets each session
  { key: 'debug', type: 'boolean', label: 'Debug mode', persistence: 'none', default: false }
]);
```

## Reacting to Changes

Use `onChange` to update visuals or behavior in real time when the user adjusts a setting:

```javascript
await settings.define([
  { key: 'hue', type: 'slider', label: 'Hue', min: 0, max: 360, default: 180 },
  { key: 'speed', type: 'slider', label: 'Speed', min: 0.1, max: 5, default: 1 }
]);

let hue = settings.get('hue');
let speed = settings.get('speed');

settings.onChange((key, value) => {
  if (key === 'hue') hue = value;
  if (key === 'speed') speed = value;
});

function draw() {
  background(`hsl(${hue}, 80%, 10%)`);
  // ...
}
```

## Examples

### Canvas — parametric animation

```javascript
await settings.define([
  { key: 'count', type: 'slider', label: 'Circle count', min: 1, max: 50, default: 12 },
  { key: 'color', type: 'color', label: 'Color', default: '#4488ff' },
  { key: 'speed', type: 'slider', label: 'Speed', min: 0.1, max: 5, default: 1, step: 0.1 }
]);

let { count, color, speed } = settings.getAll();

settings.onChange((_, __, all) => { ({ count, color, speed } = all); });

function draw(ts) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (ts * 0.001 * speed);
    const x = width / 2 + Math.cos(angle) * 150;
    const y = height / 2 + Math.sin(angle) * 150;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
```

### Hydra — tunable shader

```javascript
await settings.define([
  { key: 'freq', type: 'slider', label: 'Frequency', min: 1, max: 60, default: 10 },
  { key: 'sync', type: 'slider', label: 'Sync', min: 0, max: 1, step: 0.01, default: 0.1 }
]);

let freq = settings.get('freq');
let sync = settings.get('sync');
settings.onChange((k, v) => { if (k === 'freq') freq = v; if (k === 'sync') sync = v; });

osc(() => freq, () => sync, 0.8).rotate(0.1).out();
```

### Worker — message-driven with live config

```javascript
await settings.define([
  { key: 'interval', type: 'number', label: 'Interval (ms)', min: 50, max: 5000, default: 500 },
  { key: 'enabled', type: 'boolean', label: 'Active', default: true }
]);

let interval = settings.get('interval');
let enabled = settings.get('enabled');
settings.onChange((key, value) => {
  if (key === 'interval') interval = value;
  if (key === 'enabled') enabled = value;
});

setInterval(() => {
  if (enabled) send(Date.now());
}, 100);
```

### JS — update settings from incoming messages

```javascript
await settings.define([
  { key: 'gain', type: 'slider', label: 'Gain', min: 0, max: 1, step: 0.01, default: 0.5 },
  { key: 'mode', type: 'select', label: 'Mode', default: 'sine',
    options: [{ label: 'Sine', value: 'sine' }, { label: 'Square', value: 'square' }]
  }
]);

// Settings panel can be controlled from messages
recv((msg) => {
  if (msg.gain !== undefined) settings.set('gain', msg.gain);
  if (msg.mode !== undefined) settings.set('mode', msg.mode);
});

// Or from the clock
clock.every('4:0:0', () => {
  settings.set('gain', Math.random());
});
```

## Notes

- `define()` must be called at the **top level** of your code (not inside a callback or loop). Re-running the code resets the schema.
- The settings panel only appears after `define()` is called with a non-empty schema. If the schema is empty or `define()` is never called, no gear icon is shown.
- **Revert All** appears in the panel when any field has a `default` and the current value differs from it. Clicking it restores all fields to their defaults.

## See Also

- [JavaScript Runner](/docs/javascript-runner) — Full JSRunner documentation
- [Data Storage](/docs/data-storage) — General-purpose persistent key-value storage
- [Canvas Interaction](/docs/canvas-interaction) — Mouse and keyboard events in visual objects
