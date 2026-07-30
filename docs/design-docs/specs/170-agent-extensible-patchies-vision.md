# 170. Agent-Extensible Patchies Vision

## Poom's Vision

This vision complements [Build Your Own Patcher](169-build-your-own-patcher-vision.md).
External agent tools, such as Codex, Claude Code, OpenCode, and Pi, can create
Patchies objects and presets and change a patch graph.

For example:

- Vibe-code objects with the Patchies headless API.
- Vibe-code presets and preset packs.
- Create an extension or bundle for objects, presets, and preset packs.
- Vibe-code a patch graph through an MCP-like API. The API can resemble
  [edge-tool-handlers.ts](ui/src/lib/ai/chat/edge-tool-handlers.ts) and
  [canvas-tools.ts](ui/src/lib/ai/chat/canvas-tools.ts).
  - Current tools support the internal AI loop, not external agent tools.

This resembles Raycast Extensions, Obsidian Plugins, and Grist's
[Vibe View widget](https://support.getgrist.com/newsletters/2026-03/#community-highlights).
People create custom objects with Patchies as the engine.

These two visions are complementary and should work together:

- Build or vibe-code objects that run in Patchies.
- Build or vibe-code apps that use the Patchies runtime.

Then, Patchies is split into core and shell:

- a **stable core**: the engine and maintained built-in objects.
- an **experimental shell**: vibe-coded objects, presets, and host apps that can break.
  - Use sandboxing where possible, so failures do not crash the host.

## Product Direction

Patchies should let agents and developers create two complementary things:

```text
Extensions and patches     objects, presets, packs, and bundles that run in Patchies
Host applications          custom patchers and creative tools that use Patchies
```

The [Build Your Own Patcher Vision](169-build-your-own-patcher-vision.md)
describes the second path. This vision describes the first path, and the public
authoring surface that connects them.

This is not an AI feature added to the default editor. Patchies is a creative
engine that people and external agent tools can extend.

An object or preset created through an agent should be a normal Patchies
artifact: it can be inspected, tested, shared, installed, and used by both the
default editor and custom host patchers.

## One Authoring Model, Multiple Clients

The public contract should describe what may be authored: patch graphs, object
definitions, presets, preset packs, and extension bundles.

Codex, Claude Code, the Patchies app, a CLI, and future tools are
consumers of that same contract.

MCP is a useful interaction adapter for external tools. It is not the only or
defining interface. People, local tools, automated tests, and the default editor
use the authoring model without an agent vendor or chat protocol.

This extends the internal AI loop to external agent tools. Internal tools can
inform the public contract. The contract does not expose internal editor state
or chat workflows as its permanent API.

## Core And Shell

The product should make the distinction between reliable foundation and
experimentation visible:

- **Core** is the stable engine, its public contracts, and built-in objects that
  Patchies maintains as compatible, reliable and dependable.
- **Shell** is the place for user- and agent-authored objects, presets, packs,
  extensions, and custom hosts. It encourages experimentation and accepts that
  an artifact may be unfinished or break.

This is a product promise as much as a technical division. Users should be able
to try an experimental extension without confusing it with the Patchies runtime
itself, and without losing their ability to keep working when that extension
fails.

## Trust And Fault Containment

The goal is to contain failure and make trust explicit wherever possible:

- Patch graphs and presets should remain declarative, inspectable artifacts.
- Code-bearing objects and UI extensions should declare what kinds of
  host capability they need.
- A host should be able to allow, deny, or limit those capabilities.
- An extension failure should produce clear diagnostics and preserve the core
  runtime and the rest of the patch whenever possible.
- Trusted, locally developed, and externally obtained extensions may have
  different expectations and warnings.

The exact isolation mechanisms, permissions, and resource limits are future
design work. This vision only establishes the desired user-facing outcome:
creative experimentation should be powerful without making the host fragile.

## What This Enables

- A user asks an external agent to create a focused synth object, test it,
  and add it to a local object pack.
- A user asks an agent to assemble a preset pack for a performance or workshop.
- A user asks an agent to compose a patch graph from the installed object
  ecosystem.
- A user builds a custom creative tool that consumes that same object pack and
  graph through the headless runtime.
- A community shares a useful extension that remains legible as Patchies
  artifacts rather than an opaque, app-specific integration.

## Product Questions

- What is the smallest useful extension artifact that demonstrates this vision
  without becoming a general plugin marketplace?
- Which artifacts should be purely declarative, and which legitimately need to
  carry code?
- How should Patchies communicate the difference between core, trusted local,
  and experimental artifacts?
- What authoring feedback does an external agent need in order to create good
  objects and patches without depending on the private editor implementation?
- How should custom host apps declare the object packs and capabilities needed
  to run their patches?
