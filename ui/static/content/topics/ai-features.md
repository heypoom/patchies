# AI Create & Edit

> **Caution**: These features are experimental and have a _very high_ chance of corrupting and destroying your code and patches without any way to restore it. Try it on an empty patch or backup your objects.

## Create and Edit Objects with AI

![AI hearts demo](/content/images/patchies-ai-hearts-demo.png)

> ✨ [Try this patch](/?id=rza2o6eoa7338rh&readonly=true) where AI generates a shader graph of starfield with hearts!

Press `Ctrl/Cmd + I` to open the object insert/edit prompt. Describe what you want to create in natural language, and the AI will generate or edit the appropriate objects with code for you.

## Modes

When the AI object insert prompt is open, press `Ctrl/Cmd + I` again to switch between modes:

- **Single Insert Mode** (no object selected): Create a single object at your cursor position
- **Multi Insert Mode** (no object selected): Create multiple connected objects at your cursor position
- **Edit Mode** (object selected): Modify the selected object's code based on your description

## Setup

1. Create a separate API key that has strict budget limits
2. Press `Ctrl/Cmd + I`
3. Enter your API Key and hit `Save & Continue`
4. Use `Ctrl/Cmd + I` or the _sparkles_ button on the bottom right to generate

This feature uses the `gemini-3-flash-preview` model to understand your prompt and generate the object configuration.

## Opting Out

AI is 100% optional and _opt-in_ with Patchies. Dislike AI? Hit `Ctrl/Cmd + K` then `Toggle AI Features`. This _permanently_ turns all AI-based nodes and AI generation features off.

## Security Note

API keys are stored in localStorage as `gemini-api-key` and there is a risk of your API keys being stolen by malicious patches you open.

## See Also

- [Adding Objects](/docs/adding-objects)
- [Getting Started](/docs/getting-started)
