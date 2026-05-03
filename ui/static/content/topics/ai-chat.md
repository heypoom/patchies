# Chat

Chat is an AI assistant that can read your patch, explain what is happening, and queue safe canvas changes for you to review.

Open the sidebar and switch to **Chat**. Ask a question, describe a change, or ask it to build something on the canvas.

## How It Works

Chat works like a collaborator sitting next to your patch. It can inspect the canvas, read selected object data, check object errors, search the docs, and look up object-specific instructions before it suggests a change.

When you ask Chat to modify the canvas, it creates an action card. Nothing changes until you choose **Apply**. If the suggestion is not right, choose **Dismiss** and ask for a different version.

## Try It

### Ask About The Selected Object

1. Select an object on the canvas
2. Open **Chat**
3. Ask:

```text
What does this object do?
```

Chat includes the selected object's type, data, and recent errors as context.

### Make A Small Edit

Select a code object and ask:

```text
Make this animation slower and use warmer colors.
```

Chat can read the current object data, rewrite the relevant fields, and queue an edit card for you to apply.

### Build From A Preset

Ask:

```text
Find texture presets that would work well for a soft background.
```

Chat can search built-in and user presets, read the full contents of a preset, and insert a preset by name. If you ask for something in the current view, Chat can read your viewport and place the preset where you are looking.

## What Chat Can Do

Chat can queue these canvas actions:

- Create one object from generated data
- Create multiple connected objects
- Insert an existing preset
- Edit an object's data or code
- Replace an object with another type
- Delete objects
- Move objects around the canvas
- Connect objects with edges
- Disconnect existing edges

For bigger creative requests, Chat may use a generation step first, then queue the final canvas change. For example, "make a kick and snare patch" can become a generated object graph, followed by one action card that inserts the objects and connections.

## What Chat Can Read

Chat can use context tools behind the scenes:

- The current canvas objects and edges
- Your current viewport, zoom level, visible bounds, and canvas center
- A specific object's full data and connected edges
- Recent object errors and warnings
- Object-specific instructions, handles, inlets, and outlets
- Topic docs and object reference pages
- Built-in object packs and preset packs
- Preset search results and full preset contents
- Built-in sample libraries, plus Freesound when configured

This context helps Chat avoid guessing. If something is failing, ask it to check the errors before changing the patch.

## Working With Action Cards

Action cards are proposed changes.

- **Apply** runs the change on your canvas
- **Dismiss** leaves your patch unchanged
- Applied actions use Patchies history, so you can undo them

You can also enable auto-approve in the chat controls when you want faster iteration. Keep it off when you are asking for broad changes or working in a patch you care about.

## Useful Prompts

```text
What objects are on this canvas, and how are they connected?
```

```text
Fix the selected shader error.
```

```text
Create a p5 object that draws bouncing circles.
```

```text
Search for presets in the Texture Filters pack.
```

```text
Insert the Blur preset.
```

```text
Insert the Blur preset in the current view.
```

```text
Move these three objects into a cleaner layout.
```

```text
Connect the slider to the oscillator frequency.
```

## Current Limits

Chat is strongest when you ask for concrete, reviewable changes. A few operations are still easier to do manually or with a follow-up prompt:

- Object titles are usually set through object code, such as `setTitle`
- Deep nested settings edits are handled as normal object data edits
- Duplicating objects can be approximated, but there is no dedicated duplicate action yet

## See Also

- [Enabling AI](/docs/enabling-ai) — Turn AI features on and set up an API key
- [AI Edits](/docs/ai-edits) — Use the inline AI prompt to create or edit objects
- [Presets](/docs/manage-presets) — Save and browse reusable object configurations
- [Patch to App](/docs/ai-patch-to-app) — Turn a patch into a standalone web app
