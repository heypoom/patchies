# Enabling AI

## AI will always be optional

AI is optional with Patchies. By default, Patchies has no AI features enabled, and it has to be explicitly opted in.

AI features are hidden unless an API key is present. You can also use `Ctrl/Cmd + K` then `Toggle AI Features` to hide all AI-based objects and AI generation features. It will stay hidden until you turn it back on.

We believe in giving users the choice to use AI as a tool for code generation without forcing it on everyone.

## Be mindful about API key security

Your API keys are currently stored in your browser. We do not manage or have access to your keys in any way.

Therefore, they can be stolen by malicious patches you open. Use a separate API key with strict budget limits. Never load patches from strangers when an API key is set.

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
- **Turn Into** — Replace the selected object with a different type, preserving connected edges
- **Fix** — Fix errors in the selected object; automatically reads console errors and sends them as context
- **Split** — Split the selected object into multiple focused connected objects
- **Fork** — Create a new object derived from the selected one (e.g., "as a canvas object", "draw triangles instead")

### Setup

1. Create a separate API key that has strict budget limits
2. Press `Ctrl/Cmd + I`
3. Enter your API Key and hit `Save & Continue`
4. Use `Ctrl/Cmd + I` or the _sparkles_ button on the bottom right to generate

This feature uses the `gemini-3-flash-preview` model to understand your prompt and generate the object configuration.

## Chat

Open the sidebar and switch to the **Chat** tab to chat with an AI assistant about your patch.

- Ask questions about Patchies, get help debugging, or brainstorm ideas
- When a object is selected, its type and data are automatically included as context so the AI understands what you're working on
- Press `Enter` to send, `Shift+Enter` for a newline
- Use the trash icon to clear the conversation history

### Canvas Tools

The assistant can act on your canvas directly when you ask it to. It will present proposed changes as action cards that you can **apply** or **dismiss** before anything is modified.

- **Insert**: Create new objects on the canvas
- **Edit**: Modify an existing object's code or settings
- **Turn Into**: Replace an object with a different type
- **Fix**: Fix errors using console output
- **Split**: Break an object into multiple connected objects
- **Fork**: Derive a new object from an existing one
- **Connect**: Wire objects together with edges
- **Disconnect**: Remove edges between objects

### Context Tools

The assistant automatically uses these behind the scenes to understand your patch before acting:

- **Get Graph Objects** — Lists all objects and edges on the canvas so it knows what exists and how things are connected
- **Get Object Data** — Fetches the full data of a specific object (code, settings, connected edges)
- **Get Object Instructions** — Looks up the API reference for a specific object type (e.g., handle IDs, inlet/outlet specs)
- **Search Docs** — Searches topic guides and object reference pages by keyword
- **Get Object Errors** — Fetches recent error and warning logs for any object, useful for diagnosing issues across the patch
- **Get Doc Content** — Fetches the full content of a documentation page

## Patch to App

![Patch to App dialog](/content/images/patch-to-app.webp)

Convert your patch into a standalone HTML application. This feature analyzes your patch's objects, connections, and code to generate a self-contained app.

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
