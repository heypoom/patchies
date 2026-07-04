# 100. Object Module Migration

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

## Family Modules

Small, obvious object families may share one module when their implementation belongs together, such as:

- `midi/` for `midi.in` and `midi.out`
- `vdo-ninja/` for VDO.Ninja push and pull nodes
- `canvas/`, `textmode/`, and `three/` for worker and DOM variants of the same object family
- audio DSP families where several text/audio objects are generated from one shared implementation pattern

Otherwise, object-specific files should be placed in independent module folders named after the object.
