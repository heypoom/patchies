# 76. Uiua Audio and Video Support

**Status**: Planning
**Created**: 2025-02-20

## Problem

The current Uiua WASM build (adapted from array-box) only returns text output. Large arrays are summarized rather than returned in full:

```
╭─
  200×200×4 ℝ
  0-1 μ0.393
              ╯
[44100 ℝ: ¯0.9645-0.9877 μ0.0002888]
```

This means Uiua's audio and image generation capabilities cannot be used in Patchies. The official Uiua website supports:

- Audio playback (WAV)
- Image display (PNG)
- Animations (GIF/APNG)

## Solution

Create a custom Uiua WASM build that uses `SmartOutput` to detect and encode media outputs, returning them as base64-encoded data alongside text output.

### Architecture

```
packages/uiua/           # New package at repo root
├── Cargo.toml
├── .cargo/config.toml   # WASM rustflags
├── src/
│   ├── lib.rs           # wasm-bindgen exports
│   ├── backend.rs       # Minimal SysBackend implementation
│   └── output.rs        # SmartOutput → JSON conversion
├── build.sh             # Build script
└── README.md
```

### Media Detection (from Uiua's SmartOutput)

Uiua automatically detects media based on array shape and values:

| Type      | Detection Criteria                               | Output Format    |
| --------- | ------------------------------------------------ | ---------------- |
| **Audio** | row_count ≥ 11,025 (¼ second), values in [-5, 5] | WAV (PCM 16-bit) |
| **Image** | shape [h, w] or [h, w, c], min 30×30             | PNG              |
| **GIF**   | shape [frames, h, w, c?], ≥5 frames, min 30×30   | GIF              |
| **APNG**  | same as GIF                                      | APNG             |

### WASM Interface

**Current interface:**

```typescript
eval_uiua(code: string): string  // JSON with text output only
```

**New interface:**

```typescript
eval_uiua(code: string): string  // JSON with media support

// Response types
interface EvalResult {
  success: boolean;
  error?: string;
  stack: OutputItem[];  // Changed from string[]
  formatted?: string;
}

type OutputItem =
  | { type: 'text'; value: string }
  | { type: 'audio'; data: string; label?: string }   // base64 WAV
  | { type: 'image'; data: string; label?: string }   // base64 PNG
  | { type: 'gif'; data: string; label?: string }     // base64 GIF
  | { type: 'svg'; svg: string };
```

### Rust Implementation

```rust
// src/output.rs
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use uiua::algorithm::SmartOutput;
use uiua::Value;

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum OutputItem {
    Text { value: String },
    Audio { data: String, label: Option<String> },
    Image { data: String, label: Option<String> },
    Gif { data: String, label: Option<String> },
    Svg { svg: String },
}

pub fn value_to_output(value: Value, sample_rate: u32) -> OutputItem {
    let backend = MinimalBackend { sample_rate };

    match SmartOutput::from_value(value.clone(), 30.0, &backend) {
        SmartOutput::Wav(bytes, label) => OutputItem::Audio {
            data: STANDARD.encode(&bytes),
            label,
        },
        SmartOutput::Png(bytes, label) => OutputItem::Image {
            data: STANDARD.encode(&bytes),
            label,
        },
        SmartOutput::Gif(bytes, label) => OutputItem::Gif {
            data: STANDARD.encode(&bytes),
            label,
        },
        SmartOutput::Svg { svg, .. } => OutputItem::Svg { svg },
        SmartOutput::Normal(s) => OutputItem::Text { value: s },
        _ => OutputItem::Text { value: value.show() },
    }
}
```

### TypeScript Updates

**UiuaService.ts changes:**

```typescript
export type OutputItem =
  | { type: "text"; value: string }
  | { type: "audio"; data: string; label?: string }
  | { type: "image"; data: string; label?: string }
  | { type: "gif"; data: string; label?: string }
  | { type: "svg"; svg: string };

export type UiuaResult =
  | { success: true; stack: OutputItem[] }
  | { success: false; error: string };
```

### UiuaNode Display

The node will render media inline:

```svelte
{#each result.stack as item}
  {#if item.type === 'text'}
    <pre>{item.value}</pre>
  {:else if item.type === 'image' || item.type === 'gif'}
    <img src="data:image/{item.type === 'gif' ? 'gif' : 'png'};base64,{item.data}" />
  {:else if item.type === 'audio'}
    <audio controls src="data:audio/wav;base64,{item.data}" />
  {:else if item.type === 'svg'}
    {@html item.svg}
  {/if}
{/each}
```

### Video Output Integration

For video chain integration, UiuaNode can output image data to connected video nodes:

1. When an image is generated, extract it as ImageData
2. Send to outlet for downstream video processing
3. This allows Uiua-generated images to flow into Hydra, GLSL, etc.

```typescript
// In UiuaNode, when image output detected:
if (item.type === "image") {
  const img = await loadImage(`data:image/png;base64,${item.data}`);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  // Output to video chain
  sendToOutlet("video", imageData);
}
```

### Audio Output Integration

For audio chain integration:

1. Decode WAV base64 to AudioBuffer
2. Either play directly or route to audio outlet
3. Could create a one-shot sample player connected to audio graph

## Performance Considerations

| Data               | Size        | Base64 Overhead | Transfer Time |
| ------------------ | ----------- | --------------- | ------------- |
| 1s audio (44.1kHz) | ~176KB WAV  | +59KB           | <10ms         |
| 200×200 image      | 10-50KB PNG | +3-17KB         | <5ms          |
| 20-frame GIF       | 100-500KB   | +33-167KB       | <20ms         |

The encoding (WAV/PNG/GIF) happens in Rust, which is fast. Base64 overhead is acceptable for the simplicity it provides.

## Build Process

```bash
cd packages/uiua
./build.sh

# build.sh contents:
wasm-pack build --target web --release --out-name uiua_wasm
cp pkg/uiua_wasm.js pkg/uiua_wasm_bg.wasm ../../ui/src/assets/uiua/
```

## Dependencies

Cargo.toml additions:

```toml
[dependencies]
uiua = { git = "https://github.com/uiua-lang/uiua", features = ["batteries", "web"] }
base64 = "0.22"
```

The `batteries` feature enables:

- `image` - PNG encoding
- `audio_encode` - WAV encoding
- `gif` - GIF encoding
- `apng` - APNG encoding

## Migration

1. Create `packages/uiua/` with proper Rust project structure
2. Implement SmartOutput integration
3. Update TypeScript types in `ui/src/lib/uiua/`
4. Update UiuaNode.svelte to render media
5. Build new WASM and replace existing assets
6. Add video/audio outlet support (optional, phase 2)

## Files to Create/Modify

**New files:**

- `packages/uiua/Cargo.toml`
- `packages/uiua/.cargo/config.toml`
- `packages/uiua/src/lib.rs`
- `packages/uiua/src/backend.rs`
- `packages/uiua/src/output.rs`
- `packages/uiua/build.sh`
- `packages/uiua/README.md`

**Modified files:**

- `ui/src/lib/uiua/UiuaService.ts` - new types
- `ui/src/lib/uiua/uiua-wasm.d.ts` - updated declarations
- `ui/src/lib/components/nodes/UiuaNode.svelte` - media rendering
- `ui/src/assets/uiua/uiua_wasm.js` - rebuilt
- `ui/src/assets/uiua/uiua_wasm_bg.wasm` - rebuilt

## References

- [Uiua SmartOutput](https://github.com/uiua-lang/uiua/blob/main/src/algorithm/media.rs)
- [Array Box WASM build](https://github.com/codereport/array-box/blob/main/scripts/update-uiua-wasm.sh)
- [Uiua pad/editor WebBackend](https://github.com/uiua-lang/uiua/blob/main/pad/editor/src/backend.rs)
