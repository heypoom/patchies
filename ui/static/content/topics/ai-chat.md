# Chat

Open the sidebar and switch to the **Chat** tab to chat with an AI assistant about your patch.

- Ask questions about Patchies, get help debugging, or brainstorm ideas
- When a object is selected, its type and data are automatically included as context so the AI understands what you're working on
- Press `Enter` to send, `Shift+Enter` for a newline
- Use the trash icon to clear the conversation history

## Canvas Tools

The assistant can act on your canvas directly when you ask it to. It will present proposed changes as action cards that you can **apply** or **dismiss** before anything is modified.

- **Insert**: Create new objects on the canvas
- **Edit**: Modify an existing object's code or settings
- **Turn Into**: Replace an object with a different type
- **Fix**: Fix errors using console output
- **Split**: Break an object into multiple connected objects
- **Fork**: Derive a new object from an existing one
- **Connect**: Wire objects together with edges
- **Disconnect**: Remove edges between objects

## Context Tools

The assistant automatically uses these behind the scenes to understand your patch before acting:

- **Get Graph Objects** — Lists all objects and edges on the canvas so it knows what exists and how things are connected
- **Get Object Data** — Fetches the full data of a specific object (code, settings, connected edges)
- **Get Object Instructions** — Looks up the API reference for a specific object type (e.g., handle IDs, inlet/outlet specs)
- **Search Docs** — Searches topic guides and object reference pages by keyword
- **Get Object Errors** — Fetches recent error and warning logs for any object, useful for diagnosing issues across the patch
- **Get Doc Content** — Fetches the full content of a documentation page

## See Also

- [Enabling AI](/docs/enabling-ai)
- [AI Edits](/docs/ai-edits)
- [Patch to App](/docs/ai-patch-to-app)
