# 100. Object Module Migration

Status: Complete.

Patchies objects should live in `ui/src/objects/<object-or-family>` when code is specific to that object or a small, obvious object family.

## Goal

Keep object-owned implementation details colocated with the object instead of spreading them across shared `ui/src/lib` directories.

## Structure

Each object module owns its object-specific files:

- Svelte node components
- object schemas
- audio or text object runtime classes
- object-specific AI prompts
- object-specific tests
- workers, helpers, constants, settings, and types

Shared infrastructure remains in `ui/src/lib` when it is not owned by a single object or a small object family. Examples include registries, schema helper utilities, base rendering layouts used by several unrelated objects, object service plumbing, and native DSP framework code.

Markdown object documentation remains in `ui/static/content/objects/`.

## Boundary Rules

Files outside `ui/src/objects` should not import object-owned implementation details directly. The allowed exceptions are registry-style files whose job is to gather object definitions:

- `ui/src/lib/nodes/node-types.ts` imports Svelte node components.
- `ui/src/lib/audio/v2/nodes/index.ts` imports audio node classes.
- `ui/src/lib/objects/v2/nodes/index.ts` imports text object classes.
- `ui/src/lib/objects/schemas/index.ts` imports object schemas.
- `ui/src/lib/ai/object-prompts/index.ts` imports object prompts.
- `ui/src/lib/objects/builtin-shorthands.ts` imports object-owned shorthand transforms.
- `ui/src/lib/rendering/types.ts` imports object-owned render-node type members.

Default node data is object-owned in `ui/src/objects/default-node-data.ts`. The legacy `ui/src/lib/nodes/defaultNodeData.ts` path is only a compatibility wrapper.

Render-node data shapes such as `glsl`, `hydra`, `shaderpark`, `regl`, `swgl`, `textmode`, and `projmap` are object-owned type definitions. `ui/src/lib/rendering/types.ts` is the central render type registry and may import those object-owned types.

Patchbay-specific message, audio, and video runtime helpers are owned by `ui/src/objects/patchbay/`. Shared virtual routing services may remain in `ui/src/lib` when they are not patchbay-specific.

## Family Modules

Small, obvious object families may share one module when their implementation belongs together, such as:

- `midi/` for `midi.in` and `midi.out`
- `vdo-ninja/` for VDO.Ninja push and pull nodes
- `canvas/`, `textmode/`, and `three/` for worker and DOM variants of the same object family
- audio DSP families where several text/audio objects are generated from one shared implementation pattern

Otherwise, object-specific files should be placed in independent module folders named after the object.

## Migration Notes

The migration is complete as of the object module refactor. Future object work should add new object-specific schemas, prompts, components, settings, default data, tests, render type members, and object-local helpers under `ui/src/objects/<object-or-family>` unless the code is clearly shared infrastructure.
