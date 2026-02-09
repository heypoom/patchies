# Visual Assembly Module (`asm`)

This is the source code for the virtual machine that powers the `asm` object in Patchies.

Originally part of the [visual assembly canvas](https://github.com/heypoom/visual-assembly-canvas) project before it was ported to Patchies.

## Documentation

See the [in-app documentation](https://patchies.app/docs/objects/asm) for full instruction sets, syntax, and usage examples.

## Development

The virtual machine is written in Rust and compiled to WebAssembly, running on a web worker to avoid blocking the main thread.

```bash
# Build the WASM module
cargo build --release --target wasm32-unknown-unknown

# Run tests
cargo test
```
