# Objects Directory

This directory contains object-owned Patchies modules. Each object, or small obvious object family, should live under `src/objects/<object-or-family>/` and own the files that are specific to that object.

For historical context and the full migration boundary rules, see [`docs/design-docs/specs/100-object-module-migration.md`](../../../docs/design-docs/specs/100-object-module-migration.md).

## Ownership

Object modules should own object-specific:

- Svelte node components
- object schemas
- audio or text object runtime classes
- object-specific AI prompts
- default data, render-node type members, settings, constants, helpers, and tests
- workers or system classes that are not shared infrastructure

Markdown object documentation stays in `ui/static/content/objects/`.

Shared infrastructure belongs outside this directory when it is not owned by one object or a small object family. Examples include registries, schema helper utilities, shared layout components used by unrelated objects, object service plumbing, rendering infrastructure, and native DSP framework code.

## Layout

There is no required folder shape beyond keeping object-owned files colocated. Use subfolders when they make a module easier to scan:

```text
src/objects/<object-or-family>/
  components/        # Optional Svelte components
  workers/           # Optional workers (*.worker.ts)
  native-dsp/        # Optional native DSP node/processor files
  render-types.ts    # Optional render-node type member
  schema.ts          # Optional object schema
  prompt.ts          # Optional AI prompt
  *.test.ts          # Object-specific tests
```

## Imports

Use the `$objects` alias when importing object-owned files:

```ts
import MyNode from '$objects/mymodule/MyNode.svelte';
import { MyObject } from '$objects/mymodule/MyObject';
```

Files outside `src/objects` should only import object modules when they are registry-style files whose job is to gather object definitions, such as component, audio, text-object, schema, prompt, shorthand, default-data, or render-type registries.

If a file outside `src/objects` needs non-registry behavior from an object module, reconsider the boundary: either move the shared behavior out to `src/lib`, or move the object-specific caller into the owning object module.
