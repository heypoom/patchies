# 125. GLSL Metadata Directives

## Problem

GLSL nodes always display "glsl" as their title — you can't tell what a node does without reading its code. Uniform sliders use generic number inputs with no range constraints, so a `strength` uniform that should be 0.0–1.0 gets the same unbounded input as an `octaves` uniform that should be 2–16. Users have no way to annotate their shader code with hints for the UI.

## Solution

Parse `// @name` and `// @param` comment directives from shader code. Use `@name` to set the node title. Use `@param` to enrich uniform sliders with min/max/step and descriptions. These directives are already part of the shader effect format (spec 123) but are independently useful for any GLSL node right now.

## Directives

### `@name`

Sets the node's display title.

```glsl
// @name Chromatic Aberration

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    // ...
}
```

The node title changes from "glsl" to "Chromatic Aberration". If absent, the title remains "glsl" (or whatever `data.title` was set to).

**Format**: `// @name <human-readable name>`

Only the first `@name` directive is used.

### `@param`

Enriches a uniform's settings slider with range, step, and description.

```glsl
// @param float strength 0.01 0.0 0.1 "Aberration strength"
// @param float samples 8.0 2.0 32.0 "Sample count"
// @param int octaves 5 1 16 "Noise octaves"
// @param bool invert false "Invert output"

uniform float strength; // 0.01
uniform float samples;  // 8.0
uniform int octaves;    // 5
uniform bool invert;    // false
```

**Format**: `// @param <type> <name> [default] [min] [max] ["description"]`

| Field         | Required | Description                                    |
| ------------- | -------- | ---------------------------------------------- |
| `type`        | yes      | `float`, `int`, or `bool`                      |
| `name`        | yes      | Must match a `uniform` declaration in the code |
| `default`     | no       | Default value (overrides inline comment value)  |
| `min`         | no       | Minimum slider value                            |
| `max`         | no       | Maximum slider value                            |
| `description` | no       | Quoted string shown as the slider label          |

When `min` and `max` are both present for a numeric uniform, the settings panel renders a `slider` instead of a plain `number` input. The description, if provided, replaces the raw uniform name as the label.

`@param` directives that don't match any uniform declaration are ignored.

### `@format` (existing)

Already implemented — sets FBO texture format (`rgba8`, `rgba16f`, `rgba32f`).

```glsl
// @format rgba32f
```

## Parsing

Directives are parsed from single-line comments only (`//`), not block comments. They can appear anywhere in the file but conventionally go at the top.

```
DIRECTIVE_RE = /^[ \t]*\/\/\s*@(name|param)\s+(.+)$/gm
```

**`@name`**: captures everything after `@name` as the title string, trimmed.

**`@param`**: parsed as space-separated tokens with an optional quoted string at the end:
```
@param <type> <name> [<default>] [<min>] [<max>] ["<description>"]
```

## Implementation

### 1. Directive parser

Add `parseShaderDirectives()` to `shader-code-to-uniform-def.ts` (or a new `shader-directives.ts` file):

```typescript
interface ShaderDirectives {
  name?: string;
  params: Map<string, ParamDirective>;
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

### 5. Wire `@name` into node title

In `GLSLCanvasNode.svelte`, parse `@name` from the shader code and pass it to `CanvasPreviewLayout`:

```svelte
const shaderName = $derived(parseShaderName(data.code));

<CanvasPreviewLayout title={shaderName ?? data.title ?? 'glsl'} ... />
```

### 6. Syntax highlighting

Extend the existing directive highlighting in `glsl.codemirror.ts` (which already highlights `@format`) to also highlight `@name` and `@param` directives with the same muted style.

## Examples

### Before (current)

```glsl
uniform float strength; // 0.01
uniform float samples;  // 8.0
```

Node title: "glsl". Settings panel: two unbounded number inputs labeled "strength" and "samples".

### After

```glsl
// @name Chromatic Aberration
// @param float strength 0.01 0.0 0.1 "Aberration strength"
// @param float samples 8.0 2.0 32.0 "Sample count"

uniform float strength; // 0.01
uniform float samples;  // 8.0
```

Node title: "Chromatic Aberration". Settings panel: two range sliders labeled "Aberration strength" (0.0–0.1) and "Sample count" (2.0–32.0).

## Relation to Spec 123

Spec 123 (Shader Effect Format) defines these same directives as part of the full effect system. This spec extracts the `@name` and `@param` parsing as a standalone feature that works in any GLSL node today, without needing VFS effects, drag-drop, or the inference engine.

When spec 123 is implemented, its metadata parser reuses the directive parser from this spec.

## Dependencies

None. Works with existing GLSL nodes and settings infrastructure.
