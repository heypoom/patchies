# 205. Agent Integration

Status: Exploration. Nothing in this spec is implemented beyond the draft pull
request it builds on. This file keeps the context of a design conversation. It is
not a committed plan.

## Vision

Coding agents can drive Patchies. People build integrations on that:

- a Patchies CLI that controls a patch, such as adding objects and wiring them;
- a mount that projects a patch onto the filesystem, so a coding agent edits files;
- MCP and skill files, so Claude, Codex, pi, and other agents can build things in
  Patchies when asked.

Setup should be as easy as a skill file: it runs Patchies locally from a Go binary
or a Docker image, or uses an existing Patchies instance, and connects the agent
to it.

## Two Modes

- **No direct implementation.** Patchies exposes primitives, such as filesystem
  mounts, a CLI, and an API, and agents use them like any other tool.
- **Direct implementation.** An MCP server built into Patchies, such as an
  `/api/patchies-mcp` endpoint.

The modes do not compete. One operations protocol has several front-ends:

| Front-end     | Best for                                                       |
| ------------- | -------------------------------------------------------------- |
| Files (mount) | editing object code in the agent's own editor or tools         |
| CLI           | scripts, and agents with a shell                               |
| MCP           | agents without shell access, as a thin layer over the protocol |

The protocol is the core, and "no direct implementation" stays the primary mode.
MCP is cheap to add on top instead of being a second system.

## What Exists: Pull Request 272

[heypoom/patchies#272](https://github.com/heypoom/patchies/pull/272), "Patch
remote control and local mount", is an open draft: one commit (`cc685f95`), 69 files,
+9,159 and −30. Its design is spec 182,
`docs/design-docs/specs/182-remote-control-local-patch-mount.md` on branch
`patch-remote-control-and-local-mount`, not yet on `main`.

### Workflow

1. Enable Remote Control in the browser.
2. Run `patchies mount --token <connection string> --path <empty folder>`.
3. Saving a file updates the patch and runs the object. Browser edits, undo and
   redo, and graph changes flow back to disk.
4. Revoke access from the browser when done.

The browser stays open and is the source of truth.

### Architecture

```
agent or editor ──files──► patchies mount (Go CLI) ──HTTP POST──► Go relay ──SSE──► browser
                ◄─files── (watcher, local socket)  ◄──SSE──────  (patchies-server) ◄─POST── (applies, owns state)
```

- The browser owns patch state, history, and execution. The Go relay in
  `patchies-server` only orders and replays messages. Sessions live in relay
  memory, are bound to one patch ID, and store only a hash of the token.
- Transport is HTTP POST plus Server-Sent Events, with sequence IDs and replay.
  Plain HTTP is allowed only for loopback.
- A save travels as an operation from the CLI, through the relay to the browser,
  which applies it as a normal undoable change and posts back a commit that the CLI
  writes to disk.
- Browser-side changes are coalesced for 150 ms and sent as whole-file replacements
  or deletions.

### Mount Layout

- `objects/<nodeId>/<file>`, such as `objects/glsl-24/shader.glsl`.
- `patch/...` for the patch's shared text files, up to 256 KiB per file and 1 MiB total.
- Read-only `graph.json` (nodes with ports and readiness, and edges) and
  `references/` (object docs and prompts).
- An editable `connections.txt`, one wire per line, such as `a:h -> b:h`. A save is
  validated as a whole and applied as one undo step, or rejected.
- Only edits to existing files sync. New local files are not imported.

### CLI

`mount` (with `--resume` for offline edits), `graph`, `node inspect`, `node create`,
`node delete`, and `wire connect` and `wire disconnect`. Graph commands go through
the running mount's local Unix socket, output JSON, and every change is undoable.
On timeout a command reports `outcome_unknown`. The CLI is Unix-only for now.

### Agents

- Two skills are installed into every mount: editing a Patchies patch (graph and
  wiring commands, reading `graph.json` before rewiring) and writing Patchies object
  code (pointing at the reference docs and prompts).
- There is no MCP server and no MCP endpoint. Spec 182 defers MCP and capability
  discovery.

### Concurrency

One mutating client per session, and local edits win until their operation
resolves. Sync sends whole files, so the last writer wins per file. Nothing handles
several browsers or several people on one session.

### Review Findings to Fix

From the automated review on the pull request:

- The relay has no session expiry, and a crashed client can keep a session locked.
- The connection string is visible in the process list when passed with `--token`.
- The file watcher can silently drop an edit when its queue overflows, and watches
  are not removed when an object is deleted.
- Object IDs are not checked as single path segments before being joined into paths.
- Remote Control is not rebound when the active patch changes.

## Fit With Patchies V2

What carries over: the Go relay and protocol, the CLI and mount, the snapshot and
commit format, `connections.ts`, and the VFS mount tree.
`RemoteControlGraphService` already takes injected ports, history, node creation,
and settling, so a headless host can supply its own.

What is tied to today's editor, and what replaces it:

| Tied to today's editor                                                               | In V2                                                                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Wired into `FlowCanvasInner.svelte` (+140 lines)                                     | A registered editor feature module, not entry-point code (spec 203)                                                            |
| Ports read from XYFlow's measured DOM handles, so a node is not ready until rendered | Ports from object schemas ([100](100-schema-driven-handles.md)) and the headless runtime ([40](40-headless-patcher-system.md)) |
| Culling turned off while Remote Control is on, so ports do not vanish                | Ports no longer depend on rendering, so culling and remote control coexist                                                     |
| Node creation through the editor's registries, placed at the viewport center         | Commands on the runtime, with positions chosen by the caller                                                                   |
| The browser must stay open                                                           | The native host runs patches without a browser ([201](201-rust-native-host.md))                                                |

### The Native Host

The CLI can talk to `patchies_core` ([202](202-patchies-core.md)) directly over a
local socket, with no relay. That makes running patches without a browser possible,
which pull request 272 leaves out of scope, and fits the skill-file setup: a Go
binary or Docker image runs Patchies headless, and the agent connects to it.

### Multiplayer

With multiplayer ([204](204-multiplayer.md)), an agent is another peer in the room:

- its edits are CRDT updates instead of whole-file last-writer-wins;
- its presence shows, such as "Claude is editing `glsl-24`";
- the one-mutating-client rule is replaced by the shared document.

Join equals trust applies to agents too: an agent in a room runs code on everyone's
machine, like any other peer.

## The Operations Protocol

The protocol is pull request 272's command set, versioned, plus what spec 182
deferred:

- **Commands:** graph query, create and delete nodes, connect and disconnect wires,
  and read and write object files, each as a versioned, idempotent operation with an
  outcome.
- **A capability catalog:** generated from the object registry and schemas, so
  agents discover which objects exist, their ports, their settings, and which host
  can run them ([201](201-rust-native-host.md) capability tags).
- **References:** object docs and prompts, as the mount already provides.

Every front-end, whether files, CLI, or MCP, uses this protocol.

## Open Questions

- Does MCP live in the Go server, proxying to the browser through the relay, or in
  `patchies_core` for headless runs, or both?
- Should new local files in a mount create objects, or stay ignored?
- How is the capability catalog generated and versioned with the object registry?
- How does an agent learn whether a change worked, such as a shader compile error
  or an audio object failing, beyond the operation's outcome?

## Related Specs

- Spec 182, Remote Control and Local Patch Mount, on the pull request branch.
- [40. Headless Patcher System](40-headless-patcher-system.md).
- [100. Schema-Driven Handles](100-schema-driven-handles.md).
- [170. Agent-Extensible Patchies Vision](170-agent-extensible-patchies-vision.md).
- [201. Rust Native Host](201-rust-native-host.md) and [202. patchies_core](202-patchies-core.md).
- [203. Patchies V2 Roadmap](203-patchies-v2-roadmap.md).
- [204. Multiplayer](204-multiplayer.md).

## Suggested Order

1. Fix the review findings in pull request 272 and bring it onto the `patchies-v2`
   branch. `main` is frozen until V2 is finished (spec 203), so it does not land there.
2. Add the capability catalog to the protocol.
3. In the V2 editor, rebuild remote control as a registered feature module, with
   ports from schemas instead of DOM handles.
4. Add an MCP front-end over the same protocol.
5. Connect the CLI to `patchies_core` for headless runs without a browser.
