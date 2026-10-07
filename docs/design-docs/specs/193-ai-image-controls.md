# 193. AI Image Controls

`ai.img` should let users resize its preview and configure image generation without changing global AI settings.

## Preview

- Enable resizing by default, with selection handles and a minimum size.
- Add a Display context-menu action to disable or enable resizing. Persist and track the toggle through undo/redo.
- Retain the current preview dimensions when resizing is disabled.
- Node dimensions control only the preview. Keep the generated bitmap at its native dimensions and fit it inside the preview without stretching.

## Generation settings

Add a collapsed **generation settings** section above **model settings** in the prompt editor. Persist settings separately for Gemini and OpenRouter so switching providers does not send the other provider's options. Dropdowns commit immediately; text and number edits commit on blur. Empty fields omit parameters and use upstream defaults.

Gemini's `generateContent` API accepts `imageConfig.aspectRatio`, `imageConfig.imageSize`, and generation sampling controls (`temperature`, `topP`, `topK`, `seed`). Expose these controls; resolution support depends on the selected model (2.5 Flash Image has fixed resolution, Flash Lite Image supports 1K, 3.1 Flash Image adds 512, and other Gemini 3 image models support 1K/2K/4K).

OpenRouter's dedicated `/api/v1/images` API accepts top-level `aspect_ratio`, `resolution`, `size`, `quality`, `output_format`, `background`, `output_compression`, and `seed`. Temperature is not documented for this endpoint and must not be sent. Expose these options with a model-support note. An explicit pixel size overrides the ratio/resolution controls; omit those fields to avoid conflicting dimensions. Compression is sent only for JPEG/WebP. Do not expose SVG because this node consumes raster bitmaps, or image count because it has one image output.

The installed Google SDK does not yet expose `imageConfig` in its serializer. Send it through the supported `httpOptions.extraBody.generationConfig` field and verify the resulting HTTP body with a mocked request.

The model override remains optional and uses the global provider-specific image model by default. Existing prompt and message generation triggers all use these settings.

## Research

Verified against official documentation on 2026-10-08:

- [Gemini image generation](https://ai.google.dev/gemini-api/docs/generate-content/image-generation): ratio/resolution controls and model-specific output sizes.
- [Gemini generation config](https://ai.google.dev/api/generate-content): temperature 0–2, top-P, top-K, seed, and image config.
- [OpenRouter image generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation): dedicated image endpoint fields, capability discovery, size conflicts, and output format constraints. Chat-completion image settings are a separate API contract.

## Verification

Test provider request mapping, omission of unset and foreign parameters, preservation of zero-valued controls, explicit dimensions, and compression constraints. Run Svelte analysis, scoped formatting/lint, and project typecheck. Live image generation requires configured keys and incurs provider usage.
