# Edits

AI Edits creates or changes objects from a natural-language prompt.

![AI hearts demo](/content/images/patchies-ai-hearts-demo.png)

> ✨ [Try this patch](/?demo=ai-hearts) — Generate a starfield shader graph with hearts.

Press `Ctrl/Cmd + I` to open the AI object prompt. Describe what you want. AI Edits generates or modifies the appropriate objects.

## Modes

The prompt mode depends on your selection. Use the mode dropdown in the header or press `Ctrl/Cmd + I` again to cycle through modes.

### No Object Selected

- **Single** — Create one object at the cursor position.
- **Multi** — Create multiple connected objects, such as a slider that controls oscillator frequency.

### Object Selected

- **Edit** — Change the selected object code from your description.
- **Turn Into** — Replace the selected object with another type and keep its connected edges.
- **Fix** — Fix selected-object errors. AI Edits reads console errors and includes them as context.
- **Split** — Split the selected object into multiple focused connected objects.
- **Fork** — Create a new object from the selected object, such as "as a canvas object" or "draw triangles instead".

## Setup

1. Create a separate API key with strict budget limits.
2. Press `Ctrl/Cmd + I`.
3. Enter the API key.
4. Select `Save & Continue`.
5. To generate, press `Ctrl/Cmd + I` or select the sparkles button in the lower-right corner.

AI Edits uses the `gemini-3-flash-preview` model to interpret the prompt and generate object configuration.

## See Also

- [Enabling AI](/docs/enabling-ai) — Enable AI features and protect your API key.
- [Chat](/docs/ai-chat) — Ask an AI assistant about a patch.
- [Patch to App](/docs/ai-patch-to-app) — Convert a patch into a standalone HTML app.
