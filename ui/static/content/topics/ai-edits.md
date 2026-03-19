# Edits

![AI hearts demo](/content/images/patchies-ai-hearts-demo.png)

> ✨ [Try this patch](/?id=rza2o6eoa7338rh) where AI generates a shader graph of starfield with hearts!

Press `Ctrl/Cmd + I` to open the AI object prompt. Describe what you want in natural language and the AI will generate or modify the appropriate objects.

## Modes

The prompt adapts based on context. Use the mode dropdown in the header or press `Ctrl/Cmd + I` again to cycle through available modes.

**No object selected:**

- **Single** — Create one object at your cursor position
- **Multi** — Create multiple connected objects at once (e.g., "slider controlling oscillator frequency")

**Object selected:**

- **Edit** — Modify the selected object's code based on your description
- **Turn Into** — Replace the selected object with a different type, preserving connected edges
- **Fix** — Fix errors in the selected object; automatically reads console errors and sends them as context
- **Split** — Split the selected object into multiple focused connected objects
- **Fork** — Create a new object derived from the selected one (e.g., "as a canvas object", "draw triangles instead")

## Setup

1. Create a separate API key that has strict budget limits
2. Press `Ctrl/Cmd + I`
3. Enter your API Key and hit `Save & Continue`
4. Use `Ctrl/Cmd + I` or the _sparkles_ button on the bottom right to generate

This feature uses the `gemini-3-flash-preview` model to understand your prompt and generate the object configuration.

## See Also

- [Enabling AI](/docs/enabling-ai)
- [Chat](/docs/ai-chat)
- [Patch to App](/docs/ai-patch-to-app)
