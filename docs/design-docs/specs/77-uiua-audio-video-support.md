# 77. Uiua Audio and Video Support

**Status**: Implemented
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

Create a custom Uiua WASM build that uses `SmartOutput` to detect and encode media outputs, returning native `Uint8Array` typed arrays via `serde-wasm-bindgen`.

### Architecture

```
packages/uiua/           # New package at repo root
├── Cargo.toml
├── .cargo/config.toml   # WASM rustflags
├── src/
│   ├── lib.rs           # wasm-bindgen exports
│   ├── backend.rs       # Minimal SysBackend implementation
│   └── output.rs        # SmartOutput → JsValue conversion
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
eval_uiua(code: string): string  // JSON string, text output only
```

**New interface:**

```typescript
eval_uiua(code: string): EvalResult  // Native JS object via serde-wasm-bindgen

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
```

### Rust Implementation

Uses `serde-wasm-bindgen` for zero-copy transfer of typed arrays:

```rust
// src/lib.rs
use js_sys::Uint8Array;
use serde::Serialize;
use wasm_bindgen::prelude::*;

mod backend;
mod output;

use backend::MinimalBackend;
use output::value_to_output;

#[derive(Serialize)]
pub struct EvalResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub stack: Vec<OutputItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted: Option<String>,
}

#[wasm_bindgen]
pub fn eval_uiua(code: &str) -> JsValue {
    let mut env = Uiua::with_safe_sys();
    let backend = MinimalBackend::new(44100);

    let formatted = uiua::format::format_str(code, &Default::default())
        .ok()
        .map(|f| f.output);

    let code_to_run = formatted.as_deref().unwrap_or(code);

    let result = match env.run_str(code_to_run) {
        Ok(_) => {
            let stack: Vec<OutputItem> = env
                .stack()
                .iter()
                .map(|v| value_to_output(v.clone(), &backend))
                .collect();

            EvalResult {
                success: true,
                error: None,
                stack,
                formatted,
            }
        }
        Err(e) => EvalResult {
            success: false,
            error: Some(e.to_string()),
            stack: vec![],
            formatted,
        },
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}
```

```rust
// src/output.rs
use js_sys::Uint8Array;
use serde::Serialize;
use uiua::algorithm::SmartOutput;
use uiua::Value;
use wasm_bindgen::JsValue;

use crate::backend::MinimalBackend;

/// Custom serializer for Vec<u8> → Uint8Array
fn serialize_bytes<S>(bytes: &[u8], serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    // serde-wasm-bindgen will convert this to Uint8Array
    serializer.serialize_bytes(bytes)
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum OutputItem {
    Text {
        value: String,
    },
    Audio {
        #[serde(serialize_with = "serialize_bytes")]
        data: Vec<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
    },
    Image {
        #[serde(serialize_with = "serialize_bytes")]
        data: Vec<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
    },
    Gif {
        #[serde(serialize_with = "serialize_bytes")]
        data: Vec<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
    },
    Svg {
        svg: String,
    },
}

pub fn value_to_output(value: Value, backend: &MinimalBackend) -> OutputItem {
    match SmartOutput::from_value(value.clone(), 30.0, backend) {
        SmartOutput::Wav(bytes, label) => OutputItem::Audio { data: bytes, label },
        SmartOutput::Png(bytes, label) => OutputItem::Image { data: bytes, label },
        SmartOutput::Gif(bytes, label) => OutputItem::Gif { data: bytes, label },
        SmartOutput::Apng(bytes, label) => OutputItem::Gif { data: bytes, label }, // Treat as GIF
        SmartOutput::Svg { svg, .. } => OutputItem::Svg { svg },
        SmartOutput::Normal(s) => OutputItem::Text { value: s },
    }
}
```

```rust
// src/backend.rs
use uiua::SysBackend;

/// Minimal backend that only provides sample rate for audio encoding
pub struct MinimalBackend {
    sample_rate: u32,
}

impl MinimalBackend {
    pub fn new(sample_rate: u32) -> Self {
        Self { sample_rate }
    }
}

impl SysBackend for MinimalBackend {
    fn audio_sample_rate(&self) -> u32 {
        self.sample_rate
    }

    // All other methods use default implementations (no-ops or errors)
}
```

### TypeScript Updates

**UiuaService.ts changes:**

```typescript
export type OutputItem =
  | { type: "text"; value: string }
  | { type: "audio"; data: Uint8Array; label?: string }
  | { type: "image"; data: Uint8Array; label?: string }
  | { type: "gif"; data: Uint8Array; label?: string }
  | { type: "svg"; svg: string };

export type UiuaResult =
  | { success: true; stack: OutputItem[]; formatted?: string }
  | { success: false; error: string };

// No more JSON.parse needed - returns native JS object
async eval(code: string): Promise<UiuaResult> {
  await this.ensureModule();
  return this.module!.eval_uiua(code) as UiuaResult;
}
```

### UiuaNode Display

The node renders media using Blob URLs (more efficient than data URIs):

```svelte
<script lang="ts">
  function createBlobUrl(data: Uint8Array, mimeType: string): string {
    const blob = new Blob([data], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  // Clean up blob URLs when component unmounts
  onDestroy(() => {
    blobUrls.forEach(url => URL.revokeObjectURL(url));
  });
</script>

{#each result.stack as item}
  {#if item.type === 'text'}
    <pre>{item.value}</pre>
  {:else if item.type === 'image'}
    <img src={createBlobUrl(item.data, 'image/png')} alt={item.label ?? 'Uiua image'} />
  {:else if item.type === 'gif'}
    <img src={createBlobUrl(item.data, 'image/gif')} alt={item.label ?? 'Uiua animation'} />
  {:else if item.type === 'audio'}
    <audio controls src={createBlobUrl(item.data, 'audio/wav')} />
  {:else if item.type === 'svg'}
    {@html item.svg}
  {/if}
{/each}
```

### Video Output Integration

For video chain integration, UiuaNode can output image data to connected video nodes:

1. Decode PNG Uint8Array to ImageBitmap
2. Draw to canvas, extract ImageData
3. Send to outlet for downstream video processing

```typescript
// In UiuaNode, when image output detected:
if (item.type === "image") {
  const blob = new Blob([item.data], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

  // Output to video chain
  sendToOutlet("video", imageData);
}
```

### Audio Output Integration

For audio chain integration:

1. Decode WAV Uint8Array to AudioBuffer using AudioContext.decodeAudioData()
2. Either play directly or route to audio outlet
3. Could create a one-shot sample player connected to audio graph

```typescript
if (item.type === "audio") {
  const audioContext = getAudioContext();
  const arrayBuffer = item.data.buffer.slice(
    item.data.byteOffset,
    item.data.byteOffset + item.data.byteLength
  );
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Play or route to outlet
}
```

## UiuaNode UI Design

### Progressive Disclosure with Toggleable Outlets

The node uses a single-node design with optional outlets that can be enabled via checkboxes:

| Setting              | Default | Effect                          |
| -------------------- | ------- | ------------------------------- |
| Enable Audio Outlet  | false   | Adds audio outlet when enabled  |
| Enable Video Outlet  | false   | Adds video outlet when enabled  |

**Design rationale:**

- **Progressive disclosure**: Beginners see a simple text node, power users enable outlets as needed
- **Always preview**: Media renders inline regardless of outlet state
- **Chainable**: Outlets allow integration into audio/video pipelines

### Node Data Schema

```typescript
interface UiuaNodeData {
  code: string;
  enableAudioOutlet: boolean; // default: false
  enableVideoOutlet: boolean; // default: false
}
```

### Outlet Configuration

| Outlets Enabled | Outlet 0        | Outlet 1 | Outlet 2 |
| --------------- | --------------- | -------- | -------- |
| None            | message (text)  | -        | -        |
| Audio only      | message (text)  | audio    | -        |
| Video only      | message (text)  | video    | -        |
| Both            | message (text)  | audio    | video    |

### Complete Component Structure

```svelte
<script lang="ts">
  import type { OutputItem } from '$lib/uiua/UiuaService';
  import { StandardHandle } from '$lib/components/handles';
  import { onDestroy } from 'svelte';

  interface UiuaNodeData {
    code: string;
    enableAudioOutlet: boolean;
    enableVideoOutlet: boolean;
  }

  let { node }: { node: { id: string; data: UiuaNodeData } } = $props();

  // Dynamic outlet count based on toggles
  const outletCount = $derived(
    1 + (node.data.enableAudioOutlet ? 1 : 0) + (node.data.enableVideoOutlet ? 1 : 0)
  );

  let result: OutputItem[] = $state([]);
  let blobUrls: string[] = $state([]);

  function createBlobUrl(data: Uint8Array, mimeType: string): string {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    blobUrls.push(url);
    return url;
  }

  async function decodeToImageData(data: Uint8Array): Promise<ImageData> {
    const blob = new Blob([data], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  }

  // Send to outlets when result changes
  $effect(() => {
    for (const item of result) {
      // Always send text to message outlet (outlet 0)
      if (item.type === 'text') {
        send(0, item.value);
      }

      // Send to audio outlet if enabled
      if (node.data.enableAudioOutlet && item.type === 'audio') {
        send(1, item.data);
      }

      // Send to video outlet if enabled
      if (node.data.enableVideoOutlet && (item.type === 'image' || item.type === 'gif')) {
        decodeToImageData(item.data).then((imageData) => {
          const videoOutletIndex = node.data.enableAudioOutlet ? 2 : 1;
          send(videoOutletIndex, imageData);
        });
      }
    }
  });

  onDestroy(() => blobUrls.forEach(URL.revokeObjectURL));
</script>

<!-- Settings toggles -->
<div class="flex gap-3 px-2 py-1 text-xs text-zinc-400">
  <label class="flex items-center gap-1">
    <input
      type="checkbox"
      bind:checked={node.data.enableAudioOutlet}
      class="rounded border-zinc-600"
    />
    Audio out
  </label>
  <label class="flex items-center gap-1">
    <input
      type="checkbox"
      bind:checked={node.data.enableVideoOutlet}
      class="rounded border-zinc-600"
    />
    Video out
  </label>
</div>

<!-- Code editor -->
<CodeEditor value={node.data.code} nodeId={node.id} />

<!-- Inline output display (always shown) -->
<div class="output max-h-48 overflow-auto">
  {#each result as item}
    {#if item.type === 'text'}
      <pre class="text-xs text-zinc-300 whitespace-pre-wrap">{item.value}</pre>
    {:else if item.type === 'image'}
      <img
        src={createBlobUrl(item.data, 'image/png')}
        alt={item.label ?? 'Uiua image'}
        class="max-w-full"
      />
    {:else if item.type === 'gif'}
      <img
        src={createBlobUrl(item.data, 'image/gif')}
        alt={item.label ?? 'Uiua animation'}
        class="max-w-full"
      />
    {:else if item.type === 'audio'}
      <audio controls src={createBlobUrl(item.data, 'audio/wav')} class="w-full h-8" />
    {:else if item.type === 'svg'}
      {@html item.svg}
    {/if}
  {/each}
</div>

<!-- Inlets (unchanged from current implementation) -->
<StandardHandle port="inlet" type="message" title="Hot inlet ($1)" index={0} total={1} />

<!-- Dynamic outlets -->
<StandardHandle port="outlet" type="message" title="Text/arrays" index={0} total={outletCount} />
{#if node.data.enableAudioOutlet}
  <StandardHandle port="outlet" type="audio" title="Audio (WAV)" index={1} total={outletCount} />
{/if}
{#if node.data.enableVideoOutlet}
  <StandardHandle
    port="outlet"
    type="video"
    title="Video (ImageData)"
    index={node.data.enableAudioOutlet ? 2 : 1}
    total={outletCount}
  />
{/if}
```

### UX Flow Examples

**Text-only user:**

1. Creates uiua node → sees code editor + text output area
2. Writes `+1 2` → sees `3` in output
3. No audio/video outlets visible

**Visual artist:**

1. Creates uiua node
2. Writes code that generates a 200×200 image
3. Sees image rendered inline in the node
4. Checks "Video out" → video outlet appears
5. Connects outlet to Hydra node → image flows into video chain

**Sound designer:**

1. Creates uiua node
2. Writes code that generates audio samples
3. Hears audio play inline (via `<audio>` element)
4. Checks "Audio out" → audio outlet appears
5. Connects outlet to `dac~` or audio processing chain

## Performance Considerations

| Approach       | Size Overhead | Memory Copies     | Encoding Time |
| -------------- | ------------- | ----------------- | ------------- |
| Base64 + JSON  | +33%          | 2 (encode+decode) | ~1ms/100KB    |
| **Uint8Array** | **None**      | **1**             | **Zero**      |

Using native `Uint8Array` via `serde-wasm-bindgen`:

- Zero encoding overhead (no base64)
- Single memory copy from WASM to JS
- Direct use with Blob API

The media encoding (WAV/PNG/GIF) still happens in Rust, which is fast.

## Build Process

```bash
cd packages/uiua
./build.sh

# build.sh contents:
#!/bin/bash
set -e
wasm-pack build --target web --release --out-name uiua_wasm
cp pkg/uiua_wasm.js pkg/uiua_wasm_bg.wasm pkg/uiua_wasm.d.ts ../../ui/src/assets/uiua/
echo "Build complete!"
```

## Dependencies

```toml
# Cargo.toml
[package]
name = "uiua_wasm"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["cdylib"]

[dependencies]
uiua = { git = "https://github.com/uiua-lang/uiua", default-features = false, features = ["batteries", "web"] }
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"
js-sys = "0.3"
getrandom = { version = "0.3", features = ["wasm_js"] }
web-sys = { version = "0.3", features = ["Performance", "Window"] }

[profile.release]
opt-level = "s"
lto = true
```

The `batteries` feature enables:

- `image` - PNG encoding
- `audio_encode` - WAV encoding
- `gif` - GIF encoding
- `apng` - APNG encoding

## Migration

1. Create `packages/uiua/` with proper Rust project structure
2. Implement SmartOutput integration with serde-wasm-bindgen
3. Update TypeScript types in `ui/src/lib/uiua/`
4. Update UiuaNode.svelte with media rendering + toggleable outlets
5. Update defaultNodeData.ts with new outlet toggle fields
6. Build new WASM and replace existing assets

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

- `ui/src/lib/uiua/UiuaService.ts` - new OutputItem types, remove JSON.parse
- `ui/src/lib/uiua/uiua-wasm.d.ts` - updated declarations
- `ui/src/lib/components/nodes/UiuaNode.svelte` - media rendering, toggleable outlets
- `ui/src/lib/nodes/defaultNodeData.ts` - add `enableAudioOutlet`, `enableVideoOutlet`
- `ui/src/assets/uiua/uiua_wasm.js` - rebuilt
- `ui/src/assets/uiua/uiua_wasm_bg.wasm` - rebuilt
- `ui/src/assets/uiua/uiua_wasm.d.ts` - rebuilt (auto-generated)

## References

- [serde-wasm-bindgen](https://docs.rs/serde-wasm-bindgen/latest/serde_wasm_bindgen/) - Rust↔JS serialization
- [Uiua SmartOutput](https://github.com/uiua-lang/uiua/blob/main/src/algorithm/media.rs)
- [Array Box WASM build](https://github.com/codereport/array-box/blob/main/scripts/update-uiua-wasm.sh)
- [Uiua pad/editor WebBackend](https://github.com/uiua-lang/uiua/blob/main/pad/editor/src/backend.rs)
