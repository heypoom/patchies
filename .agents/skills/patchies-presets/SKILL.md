---
name: patchies-presets
description: Use when adding, editing, migrating, or reviewing Patchies built-in presets, preset packs, preset pack registry wiring, preset pack icons, or preset-pack tests.
---

# Patchies Presets

## Built-In Preset Packs

When adding or changing a built-in preset pack:

- Create preset files under `ui/src/lib/presets/builtin/`.
- Use one file per preset. Do not combine multiple preset definitions in one source file.
- For a pack with multiple presets, create a subdirectory for the pack with one preset file per preset, optional shared helper files, and an `index.ts` barrel that exports the pack's preset names and preset map.
- Update the builtin preset index.
- Add the pack to `ui/src/lib/extensions/preset-packs.ts`.
- Add a lucide icon in `ui/src/lib/extensions/pack-icons.ts`.

## Tests

- Do not add brittle tests that assert source text unless that text is user-visible or part of the preset contract.
- Do not add or update tests that assert the preset pack registry.
