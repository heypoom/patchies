# Uiua WASM Module

Custom Uiua WASM build for Patchies with audio and video output support.

## Features

- **SmartOutput media detection**: Automatically detects and encodes audio/image/animation outputs
- **Native Uint8Array transfer**: Uses `serde-wasm-bindgen` for efficient binary data transfer
- **Audio output**: Arrays with ≥11,025 elements → WAV
- **Image output**: 2D/3D arrays ≥30×30 → PNG
- **Animation output**: 4D arrays with ≥5 frames → GIF

## Building

```bash
./build.sh
```

This builds the WASM module and copies it to `ui/src/assets/uiua/`.

### Requirements

- Rust toolchain (rustup)
- wasm-pack (`cargo install wasm-pack`)
- wasm32-unknown-unknown target (`rustup target add wasm32-unknown-unknown`)

## API

```typescript
// Evaluate code with media detection
eval_uiua(code: string): EvalResult

interface EvalResult {
  success: boolean;
  error?: string;
  stack: OutputItem[];
  formatted?: string;
}

type OutputItem =
  | { type: "text"; value: string }
  | { type: "audio"; data: Uint8Array; label?: string }
  | { type: "image"; data: Uint8Array; label?: string }
  | { type: "gif"; data: Uint8Array; label?: string }
  | { type: "svg"; svg: string };

// Format code (convert keyboard prefixes to Unicode)
format_uiua(code: string): FormatResult

// Get Uiua version
uiua_version(): string
```

## Attribution

Based on:

- [Uiua](https://www.uiua.org/) by Kai Schmidt
- Build approach adapted from [Array Box](https://github.com/codereport/array-box) by Conor Hoekstra
