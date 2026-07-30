# Chat

Chat is an AI assistant that reads your patch, explains it, and queues canvas changes for you to review.

Open the sidebar. Select **Chat**. Ask a question, describe a change, or ask Chat to build something on the canvas.

## How It Works

Chat acts like a collaborator beside your patch. It inspects the canvas, reads selected object data, checks errors, and searches the documentation.

Chat also reads object instructions before it proposes a change. When you ask Chat to change the canvas, it creates an action card.

Nothing changes until you select **Apply**. If a suggestion is not right, select **Dismiss** and ask for another version.

## Try It

### Ask About the Selected Object

1. Select an object on the canvas.
2. Open **Chat**.
3. Ask:

```text
What does this object do?
```

Chat includes the selected object type, data, and recent errors as context.

### Make a Small Edit

1. Select a code object.
2. Ask:

```text
Make this animation slower and use warmer colors.
```

Chat reads the current object data, changes the related fields, and queues an edit card for you to apply.

### Build From a Preset

Ask Chat:

```text
Find texture presets that would work well for a soft background.
```

Chat searches built-in and user presets, reads the complete preset, and inserts a preset by name. For a request in the current view, Chat reads your viewport and places the preset there.

## What Chat Can Do

Chat queues these canvas actions:

- Create one object from generated data.
- Create multiple connected objects.
- Insert an existing preset.
- Edit object data or code.
- Replace an object with another type.
- Delete objects.
- Move objects on the canvas.
- Connect objects with edges.
- Disconnect existing edges.

For a large creative request, Chat may generate content before it queues the canvas change. For example, a request for a kick and snare patch can generate an object graph.

Chat then shows one action card that adds the objects and connections.

## What Chat Can Read

Chat uses these context sources:

- The current canvas objects and edges.
- Your current viewport, zoom level, visible bounds, and canvas center.
- The complete data and connected edges for a specific object.
- Recent object errors and warnings.
- Object instructions, handles, inlets, and outlets.
- Topic documentation and object reference pages.
- Built-in object packs and preset packs.
- Preset search results and complete preset contents.
- Built-in sample libraries and Freesound, when configured.

This context helps Chat avoid assumptions. If a patch fails, ask Chat to check its errors before it changes the patch.

## Working With Action Cards

Action cards show proposed changes.

- **Apply** changes the canvas.
- **Dismiss** leaves the patch unchanged.
- Applied actions use Patchies history. You can undo them.

Enable auto-approve in the chat controls to make changes faster. Keep it off for broad changes or for a patch you care about.

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

Ask for clear changes that you can review. Some operations are easier to do yourself or with another prompt:

- Object code usually sets object titles, such as `setTitle`.
- Chat handles deep nested settings as normal object data edits.
- Chat can approximate duplicated objects, but it has no dedicated duplicate action.

## See Also

- [Enabling AI](/docs/enabling-ai) — Turn AI features on and set up an API key
- [AI Edits](/docs/ai-edits) — Use the inline AI prompt to create or edit objects
- [Presets](/docs/manage-presets) — Save and browse reusable object configurations
- [Patch to App](/docs/ai-patch-to-app) — Turn a patch into a standalone web app
