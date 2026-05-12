export const floatTexPrompt = `## float.tex Object Instructions

float.tex turns Float32Array data into a video texture for GLSL/Hydra/visual pipelines.

Use it when the user wants to sample data in a shader, visualize audio/control buffers, or make a TouchDesigner CHOP-to-TOP style patch.

Connections:
- Send Float32Array or Float32Array[] messages into message-in-0.
- Connect video-out-0 to a sampler2D inlet on glsl/hydra or directly to bg.out.

Data:
- A single Float32Array becomes one row of red channel data.
- Float32Array[] is interpreted by channel order, not names.
- Data format is inferred from channel count: [r] -> r, [r, g] -> rg, [r, g, b] -> rgb, [r, g, b, a] and longer arrays -> rgba.
- Wrapped Float32Array channel rows can be sent as { type: "wrapped", channels: Float32Array | Float32Array[], width, format? }; each channel group starts on a new row and wraps by width.
- Wrapped SharedArrayBuffer channel rows can be sent as { type: "wrapped", channels: SharedArrayBuffer | SharedArrayBuffer[], width, version, format? }; bump version after writing new samples so repeated messages can be skipped.
- Square Float32Array channel textures can be sent as { type: "square", channels: Float32Array | Float32Array[], format? }; channel groups append into an approximately square texture.
- Square SharedArrayBuffer channel textures can be sent as { type: "square", channels: SharedArrayBuffer | SharedArrayBuffer[], version, format? }; bump version after writing new samples so repeated messages can be skipped.
- Object-shaped messages may include textureFormat: "rgba32f" | "rgba16f" | "rgba8"; default is "rgba32f". Use "rgba8" only when clamped normalized output is acceptable.
- Already-interleaved pixel data can be sent as { data: Float32Array, width, height, type: "r" | "rg" | "rgb" | "rgba", textureFormat? }; data.length must equal width * height * componentCount. "rgba" skips repacking, while "r", "rg", and "rgb" expand to RGBA internally.
- Shared interleaved pixel data can be sent as { buffer: SharedArrayBuffer, width, height, type: "r" | "rg" | "rgb" | "rgba", version, textureFormat? }; buffer.byteLength must equal width * height * componentCount * 4 and repeated messages with the same buffer/version are skipped.`;
