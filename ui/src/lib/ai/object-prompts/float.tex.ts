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
- Already-interleaved RGBA pixel data can be sent as { data: Float32Array, width, height, type: "rgba" }; data.length must equal width * height * 4 and skips repacking.`;
