# 66. Object virtual filesystem mount and local edits

## Motivation

I love editing TypeScript code on real code editors like Neovim and Cursor, because there are so much niceties, like TypeScript Language Server, Intellisense, and ergonomic keybindings that you don't get with using Patchies' CodeMirror Editor.

## Core Idea

What if we let people edit their object code in whatever editor of choice they want? We run a local agent that syncs files bidirectionally between the filesystem and the browser via WebSocket.

## Architecture

```txt
┌─────────────────────────────────────────────────────────┐
│  Browser (Patchies)                                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │  WebSocket Client                               │    │
│  │  - Receives file changes → updates nodes        │    │
│  │  - Sends code edits → agent writes files        │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ ws://localhost:9999
                          ▼
┌─────────────────────────────────────────────────────────┐
│  patchies-agent (Go)                                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  File Sync (fsnotify)                            │   │
│  │  - Watches directory for changes                 │   │
│  │  - Writes files when browser sends updates       │   │
│  │  - Writes patchies.d.ts (sent from browser)      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Why Not File System Access API?

We considered using the browser's File System Access API, but:

- No file watching - would require manual push/pull or polling
- Manual sync risks conflicts between patcher and local editor
- Requires re-granting permissions each session

The local agent approach gives us:

- **Instant sync** via fsnotify file watching
- **No conflict resolution needed** - last-write-wins with timestamps
- **Cross-browser support** - works in Firefox/Safari too
- **Single binary distribution** - no runtime dependencies, just download and run
- **Low memory footprint** - Go is efficient for background processes
- **Extensible** - future plans include OSC, ArtNet/DMX, local code execution, and more

## Implementation

### Project Structure

The agent lives in the patchies monorepo at `/modules/agent` (alongside `/modules/vasm`).

### Initial Sync

On WebSocket connect, **browser is the source of truth**. Browser sends `sync:full` with all node code, and the agent writes files to disk. This ensures the patcher state is canonical.

### CLI Usage

The agent is written in Go and distributed as a single binary.

```bash
# Basic usage - syncs to ./obj directory
patchies-agent

# Custom port and directory
patchies-agent --port 9999 --dir ./my-patch-code
```

Installation:

```bash
# One-liner install (recommended)
curl -fsSL https://patchies.app/install-agent.sh | bash
```

### Build & Release

GitHub Actions workflow builds binaries for all platforms on each release tag:

- `patchies-agent-darwin-arm64` (Mac Apple Silicon)
- `patchies-agent-darwin-amd64` (Mac Intel)
- `patchies-agent-linux-amd64`
- `patchies-agent-linux-arm64`
- `patchies-agent-windows-amd64.exe`

The install script detects OS/arch and downloads the correct binary to `/usr/local/bin` (or `~/.local/bin` if no sudo).

### Sync Protocol

```typescript
// Agent → Browser (file changed on disk)
{ type: "file:changed", path: "js-20.ts", content: "...", mtime: 1234567890 }
{ type: "file:deleted", path: "js-20.ts" }

// Browser → Agent (node edited in patcher)
{ type: "node:updated", nodeId: "js-20", code: "...", ext: "ts" }
{ type: "node:deleted", nodeId: "js-20" }

// Initial sync on connect (browser → agent, browser is source of truth)
{ type: "sync:full", nodes: [{ id: "js-20", code: "...", ext: "ts" }, ...] }

// Type definitions (browser → agent, keeps IDE support in sync)
{ type: "types:update", content: "declare function inlet..." }
```

### Conflict Resolution

Simple last-write-wins with ~100ms debounce. When both sides write within the debounce window, the agent (external editor) wins since that's the source of truth when actively editing.

### File Structure

We represent each node's code as a file using the `obj://` VFS protocol:

```txt
obj/
  js-20.ts
  glsl-4.glsl
  patchies.d.ts   # Auto-generated type definitions
```

## Objects with their own filesystem

[Some objects have more complex filesystem](/docs/design-docs/specs/53-virtual-filesystem-object-integrations.md), such as `chuck~` (ChucK), `elem~` (Elementary Audio) and `csound~` (Csound), and we can represent them using folders with files inside:

```txt
obj/
  chuck~-24/
    hello.ck
    world.ck
  elem~-36/
    sample0.wav
    sample1.wav
```

## Discovering which node belongs to which object id

- We should have a "focus/inspect" button on the right of the "Object" root namespace entry. This makes it so that when the user selects a node, its entry e.g. `obj://js-20.js` is **highlighted** in the file tree.

- We should also have the reverse: a button in each file entry that highlights the node that is associated with that file, albeit this is more complex as it has to be added to every visual object.

## Type Definition

The **browser sends type definitions** to the agent (via `types:update` message), which writes `patchies.d.ts` to disk. This keeps IDE autocompletion in sync as the Patchies API evolves. Types are sent on initial sync and whenever they change.

```typescript
// patchies.d.ts (auto-generated)
declare function inlet(callback: (message: any) => void): void;
declare function outlet(message: any): void;
declare function send(target: string, message: any): void;
declare function recv(name: string, callback: (message: any) => void): void;
declare function flash(): void;
declare function fft(): { bass: number; mid: number; high: number };
// ... etc
```

We can also add `/// <reference path="patchies.d.ts" />` comments at the top of generated files for better IDE integration.

## Browser UI

The browser should show connection status in the UI:

- **Disconnected** - No agent running, show "Run `patchies-agent` to enable local editing"
- **Connected** - Show green indicator, maybe file count being synced
- **Syncing** - Brief indicator when files are being written

## Open Questions

- Should we support multiple patches connecting to the same agent? Probably not for v1.
- How to handle binary files in complex objects (e.g., `elem~` samples)? Probably just copy them without watching.
- Should the agent auto-open the directory in the user's preferred editor? (`code .` / `cursor .` / `nvim .`)
