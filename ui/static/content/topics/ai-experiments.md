# AI Experiments

> **Security Warning**: API keys are stored in browser and can be stolen by malicious patches you open. Use a separate API key with strict budget limits. _Never load patches from strangers when an API key is set!_
>
> **Caution**: These features are experimental and may corrupt your patches. Try them on a new patch or backup your patches & objects.

## Hide AI Features

AI is 100% optional and _opt-in_ with Patchies. Dislike AI? Hit `Ctrl/Cmd + K` then `Toggle AI Features`. This _permanently_ turns all AI-based nodes and AI generation features off.

## Create and Edit Objects with AI

![AI hearts demo](/content/images/patchies-ai-hearts-demo.png)

> ✨ [Try this patch](/?id=rza2o6eoa7338rh) where AI generates a shader graph of starfield with hearts!

Press `Ctrl/Cmd + I` to open the AI object prompt. Describe what you want in natural language and the AI will generate or modify the appropriate objects.

### Modes

The prompt adapts based on context. Use the mode dropdown in the header or press `Ctrl/Cmd + I` again to cycle through available modes.

**No object selected:**

- **Single** — Create one object at your cursor position
- **Multi** — Create multiple connected objects at once (e.g., "slider controlling oscillator frequency")

**Object selected:**

- **Edit** — Modify the selected object's code based on your description
- **Replace** — Swap the selected object for a different type, preserving connected edges
- **Fix** — Fix errors in the selected object; automatically reads console errors and sends them as context
- **Decompose** — Split the selected object into multiple focused connected objects
- **Consumer** — Create a new object that consumes what the selected object produces
- **Producer** — Create a new object that produces what the selected object consumes

### Setup

1. Create a separate API key that has strict budget limits
2. Press `Ctrl/Cmd + I`
3. Enter your API Key and hit `Save & Continue`
4. Use `Ctrl/Cmd + I` or the _sparkles_ button on the bottom right to generate

This feature uses the `gemini-3-flash-preview` model to understand your prompt and generate the object configuration.

## AI Chat

Open the sidebar and switch to the **Chat** tab to talk to an AI assistant about your patch.

- Ask questions about Patchies, get help debugging, or brainstorm ideas
- When a node is selected, its type and data are automatically included as context so the AI understands what you're working on
- Press `Enter` to send, `Shift+Enter` for a newline
- Use the trash icon to clear the conversation history

## Patch to App

![Patch to App dialog](/content/images/patch-to-app.webp)

Convert your patch into a standalone HTML application. This feature analyzes your patch's nodes, connections, and code to generate a self-contained app.

### How to Use

1. Press `Ctrl/Cmd + K > Patch to App`. Alternatively, use the expand button on the sidebar and select "Patch to App"
2. Optionally describe what you want to build in the steering prompt (e.g., "Simple HTML page with sliders, dark theme")
3. Choose one of:
   - _Copy Spec_ - Copy the spec to use with other AI tools
   - _Generate App_ - Generate and the app directly in Patchies

### Refine with AI

Check the "Refine spec with AI" option for better results. This uses AI to improve the specification before generating, making the output more accurate (but slower).

### App Preview

After generating, the app appears in the sidebar preview tab where you can:

- View the live preview in an embedded iframe
- Describe changes in natural language (e.g., "Make the background gradient", "Add a reset button")
- Reload the preview
- Export the HTML or Markdown specification
- View the app full-screen

### Tips

- Use the 🎲 button to get random example prompts for inspiration
- Edit the generated spec manually before generating if needed
- The "Refine first" option is slower but produces better results
- You can iterate on the generated app using AI Edit without regenerating from scratch

## Objects using AI

These objects use AI to generate content within your patch:

- [ai.txt](/docs/objects/ai.txt) - Generate text using AI
- [ai.img](/docs/objects/ai.img) - Generate images using AI
- [ai.tts](/docs/objects/ai.tts) - Text-to-speech synthesis
- [ai.music](/docs/objects/ai.music) - Generate music using AI

## See Also

- [Adding Objects](/docs/adding-objects)
- [Demos](/docs/demos)
