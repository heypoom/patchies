# Patchies Context Map

Patchies is a visual programming environment with distinct editor, runtime,
rendering, audio, storage, and server domains. Context glossaries are added
lazily as work resolves their domain language.

## Contexts

- [Remote Control](./docs/contexts/remote-control/CONTEXT.md) — lets a local
  client control one live browser patch through a server-mediated session.
- [Patch Representation](./docs/contexts/patch-representation/CONTEXT.md) —
  projects code-bearing objects into a local filesystem for a Remote Control
  Session.
- [CLI Delivery](./docs/contexts/cli-delivery/CONTEXT.md) — packages and
  distributes the local Patchies command-line client.

## Relationships

- **Remote Control → Editor and Patch Runtime**: Remote Control requests a
  browser-authoritative mutation; the editor and runtime apply it through the
  patch's normal history path.
- **Remote Control → Patch Representation**: Remote Control makes the current
  Patch Representation available to the Mutating Client.
- **CLI Delivery → Remote Control**: The Patchies CLI joins a Remote Control
  Session as its Mutating Client.
