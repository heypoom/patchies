# 125. GLSL Metadata Directives ✓

## Problem

GLSL nodes always display "glsl" as their title — you can't tell what a node does without reading its code. Uniform sliders use generic number inputs with no range constraints, so a `strength` uniform that should be 0.0–1.0 gets the same unbounded input as an `octaves` uniform that should be 2–16. Users have no way to annotate their shader code with hints for the UI.

## Solution

Parse `// @title`, `// @param`, and `// @noinlet` comment directives from shader code. Use `@title` to set the node title. Use `@param` to enrich uniform sliders with min/max/step and descriptions. Use `@noinlet` to keep selected uniforms configurable through the settings UI only, without exposing node inlet handles. These directives are already part of the shader effect format (spec 123) but are independently useful for any GLSL node right now.

## Directives

### `@title`

Sets the node's display title.

```glsl
// @title Chromatic Aberration

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    // ...
}
```

The node title changes from "glsl" to "Chromatic Aberration". If absent, the title remains "glsl" (or whatever `data.title` was set to).

**Format**: `// @title <human-readable name>`

Only the first `@title` directive is used.

### `@param`

Enriches a uniform's settings slider with range, step, and description.

```glsl
// @param strength 0.01 0.0 0.1 "Aberration strength"
// @param samples 8.0 2.0 32.0 "Sample count"
// @param octaves 5 1 16 "Noise octaves"
// @param invert false "Invert output"

uniform float strength; // 0.01
uniform float samples;  // 8.0
uniform int octaves;    // 5
uniform bool invert;    // false
```

**Format**: `// @param <name> [default] [min] [max] ["description"]`

Each `@param` must have a matching `uniform` declaration — the type is inferred from it.

| Field         | Required | Description                                    |
| ------------- | -------- | ---------------------------------------------- |
| `name`        | yes      | Must match a `uniform` declaration in the code |
| `default`     | no       | Default value (overrides inline comment value) |
| `min`         | no       | Minimum slider value                           |
| `max`         | no       | Maximum slider value                           |
| `description` | no       | Quoted string shown as the slider label        |

When `min` and `max` are both present for a numeric uniform, the settings panel renders a `slider` instead of a plain `number` input. The description, if provided, replaces the raw uniform name as the label.

`@param` directives that don't match any uniform declaration are ignored.

### `@noinlet`

Hides one or more uniform inlet handles while keeping the uniforms in the settings UI.

```glsl
// @param mode 0 (0: Linear, 1: Radial, 2: Circular) "Mode"
// @noinlet mode

uniform int mode;
```

`mode` still appears in `<ObjectSettings>` and is sent to the renderer from `node.data.uniformValues`, but no `message-in-*-mode-int` handle is rendered on the node.

**Format**: `// @noinlet <name>[, <name>...]`

Names can be comma-separated and may include whitespace. Multiple `@noinlet` directives are merged.

`@noinlet` directives that don't match any uniform declaration are ignored.

### `@format` (existing)

Already implemented — sets FBO texture format (`rgba8`, `rgba16f`, `rgba32f`).

```glsl
// @format rgba32f
```

## Parsing

Directives are parsed from single-line comments only (`//`), not block comments. They can appear anywhere in the file but conventionally go at the top.

```
DIRECTIVE_RE = /^[ \t]*\/\/\s*@(title|param|noinlet)\s+(.+)$/gm
```

**`@title`**: captures everything after `@title` as the title string, trimmed.

**`@param`**: parsed as space-separated tokens with an optional quoted string at the end:

```
@param <type> <name> [<default>] [<min>] [<max>] ["<description>"]
```

**`@noinlet`**: parsed as a comma-separated list of uniform names:

```
@noinlet mode, seed
```

## Implementation

### 1. Directive parser

Add `parseShaderDirectives()` to `shader-code-to-uniform-def.ts` (or a new `shader-directives.ts` file):

```typescript
interface ShaderDirectives {
  name?: string;
  params: Map<string, ParamDirective>;
  noInlets: Set<string>;
}

interface ParamDirective {
  type: string;
  name: string;
  default?: number | boolean;
  min?: number;
  max?: number;
  description?: string;
}
```

### 2. Extend `GLUniformDef`

Add optional fields to carry parsed `@param` metadata:

```typescript
export interface GLUniformDef {
  name: string;
  type: GLUniformType;
  arraySize?: number;
  // From @param directives
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  hideInlet?: boolean;
}
```

### 3. Enrich `shaderCodeToUniformDefs`

After parsing uniform declarations, merge in any matching `@param` directives to populate `min`, `max`, and `description` on each `GLUniformDef`.

### 4. Upgrade `uniformDefsToSettingsSchema`

When a `GLUniformDef` has both `min` and `max`, emit a `SliderField` instead of a `NumberField`:

```typescript
.with('float', () => [{
  key: def.name,
  label: def.description ?? def.name,
  type: def.min != null && def.max != null ? 'slider' : 'number',
  default: def.default ?? 0,
  min: def.min,
  max: def.max,
  step: def.step ?? 0.01,
  persistence: 'node'
}])
```

### 5. Wire GLSL settings reset

GLSL uniforms use `node.data.uniformValues` directly instead of the generic `node.data.settings` managed by `SettingsManager`. The generic `<ObjectSettings>` reset button therefore needs an explicit `onSettingsRevertAll` handler from `GLSLCanvasNode.svelte`.

The GLSL reset handler should:

1. Build a fresh values object from the current uniform settings schema defaults.
2. Store it in local `uniformValues` and `node.data.uniformValues`.
3. Push each reset value through `glSystem.setUniformData()` with `toGLValue()` so the running renderer updates immediately.

### 6. Hide `@noinlet` handles

In `GLSLCanvasNode.svelte`, render top handles from visible uniforms only:

```svelte
{#each visibleUniformDefs as { def, uniformIndex }, visibleIndex}
  <StandardHandle
    port="inlet"
    type={def.type === 'sampler2D' ? 'video' : 'message'}
    id={`${uniformIndex}-${def.name}-${def.type}`}
    total={visibleUniformDefs.length}
    index={visibleIndex}
  />
{/each}
```

The handle ID keeps the original uniform index so renderer inlet mapping remains stable. The visual `index` uses the compact visible index so handles are evenly spaced.

When shader code is rerun, remove any existing edges targeting hidden uniform handles.

### 7. Wire `@title` into node title

In `GLSLCanvasNode.svelte`, parse `@title` from the shader code and pass it to `CanvasPreviewLayout`:

```svelte
const shaderName = $derived(parseShaderName(data.code));

<CanvasPreviewLayout title={shaderName ?? data.title ?? 'glsl'} ... />
```

### 8. Syntax highlighting

Extend the existing directive highlighting in `glsl.codemirror.ts` (which already highlights `@format`) to also highlight `@title`, `@param`, and `@noinlet` directives with the same muted style.

## Examples

### Before (current)

```glsl
uniform float strength; // 0.01
uniform float samples;  // 8.0
```

Node title: "glsl". Settings panel: two unbounded number inputs labeled "strength" and "samples".

### After

```glsl
// @title Chromatic Aberration
// @param strength 0.01 0.0 0.1 "Aberration strength"
// @param samples 8.0 2.0 32.0 "Sample count"

uniform float strength; // 0.01
uniform float samples;  // 8.0
```

Node title: "Chromatic Aberration". Settings panel: two range sliders labeled "Aberration strength" (0.0–0.1) and "Sample count" (2.0–32.0).

## Relation to Spec 123

Spec 123 (Shader Effect Format) defines these same directives as part of the full effect system. This spec extracts the `@title` and `@param` parsing as a standalone feature that works in any GLSL node today, without needing VFS effects, drag-drop, or the inference engine.

When spec 123 is implemented, its metadata parser reuses the directive parser from this spec.

## Dependencies

None. Works with existing GLSL nodes and settings infrastructure.
