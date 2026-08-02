# Preset Module Migration

## Objective

Move built-in preset definitions into `ui/src/presets` while keeping shared
preset support code in `ui/src/lib/presets`, without changing behavior.

## Key Challenges & Solutions

The preset-pack registry depends on the extension-store `PresetPack` type. It
remains in `ui/src/lib/presets` with other reusable support code, while
`ui/src/presets` stays a built-in catalog.

## What Could Be Better

`PresetPack` is still declared with extension state. A future extension manifest
boundary could move the shared contract to a neutral module.

## Action Items

- Use `$presets` only for built-in preset definitions.
- Keep support, extension UI, and state outside `ui/src/presets`.
