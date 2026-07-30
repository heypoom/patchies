# 100. Object Module Migration

Status: Complete.

Last verified against code: 2026-07-06.

This spec defines the current internal object ownership boundary. It is not the
final plugin boundary in [167. Modular Patchies Roadmap](167-modular-patchies-roadmap.md).
It prepares object modules for plugin packaging.

Patchies objects should live in `ui/src/objects/<object-or-family>` when code is specific to that object or a small, obvious object family.

## Goal

Keep object-specific implementation details with the object. Do not spread them
across shared `ui/src/lib` directories.

## Structure

Each object module owns its object-specific files:

- Svelte node components
- object schemas
- audio or text object runtime classes
- object-specific AI prompts
- object-specific tests
- workers, helpers, constants, settings, and types

Shared infrastructure stays in `ui/src/lib` when no object or small family owns it.
Examples include registries, schema helpers, shared render layouts, object services,
and native DSP framework code.

Markdown object documentation remains in `ui/static/content/objects/`.

## Current State

The migration has landed in the current codebase:

- Svelte node components are imported from `ui/src/objects` into `ui/src/lib/nodes/node-types.ts`.
- V2 audio node classes are imported from object modules into `ui/src/lib/audio/v2/nodes/index.ts`.
- V2 text object classes are imported from object modules into `ui/src/lib/objects/v2/nodes/index.ts`.
- Manual object schemas are imported from object modules into `ui/src/lib/objects/schemas/index.ts`.
- Object-owned render-node type members are imported into `ui/src/lib/rendering/types.ts`.
- Default node data is owned by `ui/src/objects/default-node-data.ts`, with `ui/src/lib/nodes/defaultNodeData.ts` kept as a compatibility wrapper.

These central files are still static registries. This spec allows them. [47. Modular
Patchies API Design](47-modular-patchies-api-design.md) treats them as bootstrap
surfaces that should become built-in plugin manifests and dynamic registration calls.

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

This boundary is strict. A shared registry can import object definitions to build a
catalog. Shared runtime code does not import object-specific helpers for
object-specific behavior. If shared code branches on an object type, add an
object-owned method, definition field, or service extension point.

## Family Modules

Small, obvious object families may share one module when their implementation belongs together, such as:

- `midi/` for `midi.in` and `midi.out`
- `vdo-ninja/` for VDO.Ninja push and pull nodes
- `canvas/`, `textmode/`, and `three/` for worker and DOM variants of the same object family
- audio DSP families where several text/audio objects are generated from one shared implementation pattern

Otherwise, object-specific files should be placed in independent module folders named after the object.

## Migration Notes

The object module refactor completed this migration. Add new object schemas,
prompts, components, settings, defaults, tests, render types, and helpers under
`ui/src/objects/<object-or-family>`, unless the code is shared infrastructure.

## Relationship To Plugins

The object-module layout only organizes the source tree. It does not make objects
dynamically loadable.

The next boundary is a manifest-like object definition for built-ins and external
plugins. A module under `ui/src/objects/<object-or-family>` is easy to convert
because it already contains its implementation and metadata.

When converting an object module into a plugin:

- Keep object-owned files in the plugin package.
- Register runtime classes, schemas, views, defaults, prompts, and docs metadata through plugin APIs.
- Do not import plugin internals from shared `ui/src/lib` code.
- keep markdown docs in `ui/static/content/objects/` until a later docs-packaging spec replaces that rule.

## Success Criteria

- New object-specific code lands under `ui/src/objects/<object-or-family>` by default.
- Shared files import object-owned code only when they are registry or bootstrap surfaces.
- Render-node discriminants remain object-owned and are assembled by the shared render type registry.
- A future plugin migration can move one object module without hunting for scattered object-owned code in `ui/src/lib`.
