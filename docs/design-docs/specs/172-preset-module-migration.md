# 172. Preset Module Migration

Status: Complete.

Last verified against code: 2026-08-02.

## Goal

Keep built-in preset definitions in `ui/src/presets`, matching the source
ownership boundary established by `ui/src/objects`. Keep reusable preset support
code in `ui/src/lib/presets`.

## Boundary

`ui/src/presets` owns only built-in preset definitions, their family barrels,
and preset-specific tests.

`ui/src/lib/presets` owns:

- Preset-library types, migration, and utility functions
- Built-in preset-pack definitions, availability, and lookup helpers

Shared extension infrastructure remains outside the module:

- `ui/src/stores/extensions.store.ts` owns extension enablement state and the
  shared `PresetPack` type.
- `ui/src/lib/extensions/object-packs.ts` owns object-pack definitions.
- `ui/src/lib/extensions/pack-icons.ts` owns the shared icon resolver used by
  object and preset pack UI.

## Imports

Use `$presets` for built-in preset definitions and `$lib/presets` for reusable
preset support. The preset-pack registry may import the shared `PresetPack` type
only. The store remains the state owner and imports the pack registry; the pack
registry does not import store values.

## Success Criteria

- Built-in preset generation writes into `ui/src/presets`.
- Reusable preset support stays in `ui/src/lib/presets`.
- Existing preset and preset-pack behavior remains unchanged.
