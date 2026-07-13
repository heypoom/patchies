---
name: patchies-assembly-module
description: Use when changing Patchies assembly VM code, VASM Rust sources, wasm-pack output, machine WASM assets, asm object behavior, or modules/vasm build/link steps.
---

# Patchies Assembly Module

## Scope

The assembly VM lives in `modules/vasm/` and ships browser assets copied into `ui/src/assets/vasm/`.

Use this skill for changes to:

- Rust sources under `modules/vasm/src/`
- VASM tests under `modules/vasm/tests/`
- proc macros under `modules/vasm/poom_macros/`
- generated wasm-pack output in `modules/vasm/pkg/`
- linked UI assets in `ui/src/assets/vasm/`
- Patchies objects that consume the VASM package, such as `asm` or related assembly-memory objects

## Build And Link

After modifying Rust code in `modules/vasm/`, rebuild and link:

```bash
cd modules/vasm
rm -rf pkg
wasm-pack build --target web
rm -rf ../../ui/src/assets/vasm/*
cp pkg/*.js pkg/*.wasm pkg/*.d.ts pkg/package.json ../../ui/src/assets/vasm/
cd ../../ui
bun install
```

Use `--target web`, not `bundler`. The app expects the `machineModule.default()` init shape.

## Verification

- Run the relevant Rust tests from `modules/vasm/` when changing VM behavior.
- Rebuild the WASM package and relink UI assets after Rust changes.
- Run focused UI checks only when the consuming UI/object code changed.
- Run `git diff --check` after edits.
