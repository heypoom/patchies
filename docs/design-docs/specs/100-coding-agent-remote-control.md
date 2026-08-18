# 100. Coding Agent Remote Control

> **Status: PROTOTYPE**

## Goal

Let a coding harness inspect and edit the currently running Patchies editor without
requiring the in-app chat UI. The prototype reuses the editor's existing chat-tool
validation and canvas callbacks rather than introducing a separate mutation path.

## Scope

The editor accepts authenticated P2P RPC requests on a dedicated channel while
Remote Control is explicitly enabled. A session capability is generated in memory
for each enablement and is never persisted. The initial surface supports graph,
viewport, object data, and object errors/logs, plus direct canvas tools:
`insert_object`, `insert_objects`, `update_object_data`, `replace_object`,
`delete_objects`, `move_objects`, `connect_edges`, and `disconnect_edges`.
It also exposes the in-app chat's read-only object instructions, documentation,
and virtual filesystem lookup handlers.

The UI shows the capability in Network settings so a human can give it to the
public `skills/patchies-remote-control` bridge. The skill includes the agent-facing
workflow, bundled bridge-tool declarations, and a repo-local CLI.

The public skill packages its pinned Trystero runtime and `werift` as its Node/Bun
`RTCPeerConnection` polyfill. Bun does not provide WebRTC globally.

## Architecture

```
P2P request → RemoteControlManager → RemoteChatToolAdapter
                                      ↓
                           existing chat tool resolvers
                                      ↓
                            existing canvas callbacks
```

`RemoteChatToolAdapter` is the seam between the wire protocol and the editor. It
accepts the same tool names and argument shapes as chat direct tools, resolves and
validates them with the existing handlers, then applies the resulting `ChatAction`
through the same callbacks used by chat action cards.

## Security and lifecycle

- Remote Control is off by default and reset when the editor reloads.
- Enabling it generates a fresh 256-bit capability.
- Requests must present that exact capability; all other messages are ignored.
- Responses are addressed to the requesting peer rather than broadcast.
- The capability is intentionally not account authentication; it is a short-lived,
  user-mediated pairing secret for this prototype.

## Follow-ups

- Add request revisions/idempotency and an atomic multi-operation transaction.
- Add explicit per-peer approval, read-only sessions, expiry, and a connected-peer UI.
- Consider a stable MCP wrapper once the CLI surface has proved useful.
