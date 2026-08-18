---
name: patchies-remote-control
description: Connect to a running Patchies editor and inspect or edit its node graph through the paired P2P bridge. Use when a user asks to work on their live Patchies patch or canvas from an external coding harness.
---

# Patchies Remote Control

Patchies is a visual node-based programming environment for real-time audio-visual
creative coding. A running editor can expose a short-lived remote-control session
through Settings → Network → Coding agent remote control. The user must give you
the copied `room` and `capability`; treat the capability as a secret and do not
persist or echo it unnecessarily.

## Connect

Install the bridge dependencies once from this skill folder. This installs the
`werift` WebRTC polyfill required by Bun:

```sh
bun install
```

Then run the bundled bridge from this skill folder. Each invocation joins the
editor's P2P room, performs one request, prints JSON, and exits:

```sh
bun skills/patchies-remote-control/scripts/patchies-agent.ts request \
  --room '<room>' \
  --capability '<capability>' \
  --tool get_graph_nodes
```

Pass tool arguments as a JSON object:

```sh
bun skills/patchies-remote-control/scripts/patchies-agent.ts request \
  --room '<room>' \
  --capability '<capability>' \
  --tool update_object_data \
  --args '{"nodeId":"<node-id>","patch":{"frequency":440}}'
```

The command result is always JSON. Stop and report the error if it returns
`{"ok":false,...}` or the editor does not respond.

## Working model and tools

Before changing a canvas, read the bundled
[Patchies working context](references/chat-system-context.md). It contains the
applicable in-app-chat decision rules and bridge-specific limits.

Read the bundled [tool declarations](references/chat-tool-declarations.md) before
constructing a bridge request. It is the local source for supported tool names,
arguments, and validation constraints; no Patchies repository path is required.

## Limits of this prototype

There is no persistent identity, revision check, transaction batching, VFS access,
subtask generation, preset insertion, sample search, or pack management. Keep each
mutation narrow and verify it before issuing the next one.
