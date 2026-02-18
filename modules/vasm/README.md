# Visual Assembly Module (`asm`)

This is the source code for the virtual machine that powers the `asm` object in Patchies.

Originally part of the [visual assembly canvas](https://github.com/heypoom/visual-assembly-canvas) project before it was ported to Patchies.

## Documentation

See the [in-app documentation](https://patchies.app/docs/objects/asm) for full instruction sets, syntax, and usage examples.

## Development

The virtual machine is written in Rust and compiled to WebAssembly, running on a web worker to avoid blocking the main thread.

```bash
# Run tests
cargo test
```

## Building & Linking WASM

After making changes to the Rust code, rebuild and link to the UI:

```bash
# 1. Clean old build artifacts
rm -rf pkg

# 2. Build WASM with wasm-pack (must use --target web for init function)
wasm-pack build --target web

# 3. Clean and copy to UI assets
rm -rf ../../ui/src/assets/vasm/*
cp pkg/*.js pkg/*.wasm pkg/*.d.ts pkg/package.json ../../ui/src/assets/vasm/

# 4. Re-link the package in UI
cd ../../ui && bun install
```

**Important**: Must use `--target web` (not `bundler`) because the code expects `machineModule.default()` init function.
