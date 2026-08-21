# Remote-Control Mount Transport Research (2026-08-21)

## Question

What server transport should relay a local `patchies mount` CLI and a live
browser patch, including browser reloads, while keeping the browser the only
authority that applies patch mutations?

## Recommendation

Use an application-owned, versioned HTTP relay in the embedded Go server:

1. The browser keeps one authenticated **SSE command stream** open to receive
   CLI requests. It applies a request only when its `patchId` and
   `browserGeneration` match its currently loaded patch instance, through the same
   undoable command path used by the editor.
2. The browser sends an ordinary HTTP acknowledgement for every command. The
   acknowledgement includes the CLI-created `operationId`, the resulting
   monotonically increasing `patchRevision`, and an outcome (`applied`,
   `conflict`, or `rejected`). The server never mutates the patch itself.
3. The CLI uses ordinary authenticated HTTP for requests and an SSE event
   stream for changes/snapshots produced by the browser. It persists the last
   processed event ID and reconnects with it. Its local watcher writes a
   uniquely identified `write-file` operation; retrying that ID is idempotent.

This is deliberately a relay protocol, not a PocketBase-record subscription
and not a WebSocket. PocketBase's built-in realtime endpoint is SSE and
record-subscription-oriented, with a five-minute idle timeout and a 30-minute
maximum connection duration, so it is not the persistent session broker this
feature needs. The custom relay keeps the initial implementation in Go's
existing HTTP surface, provides a natural request/response/error model for the
CLI, and leaves a versioned operation envelope for imminent CLI and MCP
operations.

## Proposed wire invariants

Every envelope must include these values, even for the initial snapshot:

```json
{
  "protocolVersion": 1,
  "sessionId": "opaque-session-id",
  "patchId": "browser-declared-stable-patch-id",
  "browserGeneration": "uuid-regenerated-at-each-load",
  "operationId": "uuid-created-by-cli-or-browser",
  "patchRevision": 42
}
```

- `patchId` names the only patch that the session can control. Today that is a
  client-side identifier, not proof of a PocketBase record, so the browser
  binds it to the server-issued session when enabling Remote control. The
  browser rejects a command if it is not its loaded patch instance; the server
  also rejects commands that do not match the session's bound identifier.
- `browserGeneration` changes after every page load. A new browser instance
  reclaims the session and sends a canonical snapshot before it can acknowledge
  writes. This prevents an old stream from applying to a newly loaded patch.
- `operationId` is globally unique and recorded with its terminal result by the
  relay. Retrying a save after a timeout returns the original result rather
  than applying it twice.
- `patchRevision` advances only after the browser has applied an operation. A
  CLI write carries the revision from which it was made. If it is stale, the
  browser returns a conflict/current representation; policy can then implement
  the product decision that the most recent local save wins without confusing
  two patch identities.
- Server-to-client SSE event IDs are relay sequence IDs, not patch revisions.
  They allow the client to resume delivery; payload revision remains the
  authoritative patch-content ordering mechanism.

The connection token is a high-entropy bearer credential for the whole remote
control session and may therefore authorize future explicit operations. It is
not a substitute for the identity checks above. Keep it out of URLs when the
CLI can send an `Authorization: Bearer` header; a browser `EventSource` cannot
set arbitrary headers, so the browser should first register using a normal
same-origin authenticated request and receive a separate, single-purpose
stream capability. Redact either credential from server logs.

## Why SSE plus HTTP

The HTML standard defines EventSource as a server-to-client event stream. It
automatically reconnects after a broken connection, and supplies the last
event ID in `Last-Event-ID` when reconnecting. That directly covers frequent
Patchies page reloads when the relay retains a bounded event buffer and the
browser reclaims its still-live session. The stream uses
`Content-Type: text/event-stream` and event IDs; send periodic comment
heartbeats and call Go's `http.NewResponseController(w).Flush()` after each
event so intermediaries do not buffer the stream.

SSE is intentionally only the downstream lane. HTTP `POST` gives both browser
and CLI a clear acknowledgement and lets the CLI attach bearer authentication,
request bodies, timeouts, and idempotency IDs using ordinary Go standard
library clients. A WebSocket would require reconnect, resume, acknowledgements
and request correlation to be designed anyway, but does not make file-sync
mutations simpler. It remains a future transport implementation option behind
the operation envelope, rather than being the v1 protocol.

## Repository evidence

- The embedded server already registers custom routes in `app.OnServe()` and
  serves the frontend from the same Go process in
  [`server/main.go`](../../server/main.go). PocketBase documents that this
  router is built on Go's standard `net/http.ServeMux` and that custom routes
  are registered through `OnServe`.
- `server/go.mod` already targets Go 1.26, so the standard
  `http.ResponseController.Flush` API is available; no streaming or WebSocket
  dependency is required for SSE.
- `HistoryManager.record()` deliberately records a command after an externally
  applied state update, and `UpdateNodeDataCommand` supplies reversible code
  field updates. See
  [`ui/src/lib/history/HistoryManager.ts`](../../ui/src/lib/history/HistoryManager.ts),
  [`ui/src/lib/history/commands/update-node-data.command.ts`](../../ui/src/lib/history/commands/update-node-data.command.ts),
  and the existing code-commit event bridge in
  [`ui/src/lib/components/FlowCanvasInner.svelte`](../../ui/src/lib/components/FlowCanvasInner.svelte).
  A remote write can therefore be applied by the browser and immediately
  recorded as one normal undo entry, rather than having the server alter stored
  patch data out of band.
- Current `currentPatchId` and autosaved graph state are browser/local-storage
  state, not server authority. See
  [`ui/src/stores/ui.store.ts`](../../ui/src/stores/ui.store.ts) and
  [`ui/src/lib/services/PatchManager.ts`](../../ui/src/lib/services/PatchManager.ts).
  The session/reclaim handshake is therefore required even for a mounted local
  patch: it re-establishes that the live browser is authoritative before the
  server releases a queued write.

## Primary sources

- [PocketBase Go routing](https://pocketbase.io/docs/go-routing/) — custom
  routes use the `OnServe` router, which is based on the standard Go mux.
- [WHATWG HTML: Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
  — EventSource reconnection, `Last-Event-ID`, and the event-stream format.
- [Go `net/http` package](https://pkg.go.dev/net/http#ResponseController.Flush)
  — `ResponseController.Flush` flushes buffered response data to the client.
- [PocketBase JavaScript HTTP requests](https://pocketbase.io/docs/js-sending-http-requests/)
  — PocketBase's JavaScript helper does not support streamed/SSE responses;
  custom streaming therefore belongs in the Go server endpoint rather than the
  frontend SDK.
- [PocketBase realtime source](https://github.com/pocketbase/pocketbase/blob/master/apis/realtime.go)
  — PocketBase's built-in realtime channel is SSE with finite idle and maximum
  connection lifetimes; use a dedicated broker rather than its record
  subscription API.

## Rejected alternatives for v1

- **Browser reload ends the mount:** conflicts with the required persistent
  developer workflow. Reclaiming a session with a new browser generation keeps
  the mount alive while preserving a guard against stale tabs.
- **CLI writes directly to PocketBase patch records:** bypasses the loaded
  browser's undo tracker and can overwrite a patch the browser no longer has
  loaded.
- **WebSocket as the protocol contract:** useful later if bidirectional binary
  transfer becomes necessary, but it would still need the same session,
  generation, revision, idempotency, and resume rules.
