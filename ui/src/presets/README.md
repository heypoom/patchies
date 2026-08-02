# Presets Directory

This directory contains the built-in Patchies preset catalog. Every source file
here is a built-in preset definition, its family barrel, or a preset-specific test.

## Ownership

Built-in preset modules own:

- Built-in preset definitions and their tests
  Shared preset support stays in `ui/src/lib/presets`, including library types,
  migration, tree helpers, and built-in preset-pack metadata. Shared extension
  infrastructure remains in `ui/src/lib`, including the extension store,
  object-pack registry, and shared pack-icon resolver.

## Imports

Use the `$presets` alias for preset-owned imports:

```ts
import { BUILTIN_PRESETS } from '$presets';
import { BUILT_IN_PRESET_PACKS } from '$lib/presets/preset-packs';
```

Files outside `src/presets` may import the built-in catalog to register presets.
Preset support code belongs in `src/lib/presets`.
