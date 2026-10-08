Generate images from text prompts with Gemini or OpenRouter.

## Setup

Choose your provider and set its API key in AI settings. The node uses that
provider's default image model. Open **model settings** in the prompt editor to
set a model for this node.

- Connect the video output to other visual objects to use the generated image as a texture.
- Connect an image or video source to the video inlet to guide generation or edit
an image with either provider. Each generation captures the source's current
frame. With OpenRouter, choose a model that supports reference images.

## Preview Size

Select the node and drag its resize handles to change the preview size.
Right-click and choose **Disable resizing** to lock it, or **Enable
resizing** to unlock it. The preview fits the image without stretching. Resizing
does not change the generated image's dimensions.

## Generation Settings

Open **generation settings** above **model settings** in the prompt editor.
Empty fields use the provider's defaults. Settings are saved separately for each
provider and support undo/redo.

| Provider | Controls |
| -------- | -------- |
| Gemini | Aspect ratio, resolution, temperature, top P, top K, seed |
| OpenRouter | Aspect ratio, resolution, pixel dimensions, quality, format, background, compression, seed |

Support varies by model. Gemini resolution choices depend on the model: 2.5
Flash Image has a fixed resolution, Flash Lite Image supports 1K, and 3.1 Flash
Image also supports 512. Other Gemini 3 image models offer 1K, 2K, and 4K.

For OpenRouter, pixel dimensions such as `1536x1024` override aspect ratio and
resolution. Compression applies to JPEG and WebP; transparent backgrounds require
PNG or WebP. The dedicated image endpoint does not expose temperature.

See [Gemini image generation](https://ai.google.dev/gemini-api/docs/generate-content/image-generation)
and [OpenRouter image generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)
for model capabilities.

## See Also

- [ai.txt](/docs/objects/ai.txt) - AI text generation
- [ai.music](/docs/objects/ai.music) - AI music generation
