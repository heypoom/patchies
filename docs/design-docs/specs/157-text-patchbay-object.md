# 157. Text Patchbay Object

## Problem

Large patches can become tedious to rewire when many distant objects need to be rerouted together. Patchies already supports wireless channels through `send`/`recv`, `send~`/`recv~`, and `send.vdo`/`recv.vdo`, but coordinating many routes still requires placing and editing many small objects.

We want a text-based patchbay object that lets users describe message, audio, and video channel routing in one compact configuration, while still using the existing wireless channel systems under the hood.

## Goals

- Provide a small DSL for routing named channels, not visual graph objects.
- Keep message, audio, and video routes separate so the same channel name can be reused safely across data types.
- Require patchbay-local virtual channels to be declared explicitly with `chan`.
- Allow routes to use existing wireless channels from the patch graph without redeclaring them.
- Highlight unknown channels in the editor and show clear hover diagnostics.
- Reuse existing routing systems rather than introducing a second graph runtime.

## Non-Goals

- Do not route by node title, node id, visual object label, inlet name, or outlet name.
- Do not create visible `send`/`recv` objects on the canvas.
- Do not support cross-type routing such as audio to video or message to audio.
- Do not add gain, transforms, filtering, or conditional routing in v1.
- Do not support arbitrary JavaScript execution inside the patchbay DSL.

## User Model

The patchbay object routes channels. Every name in a route must resolve to one of:

1. A channel declared with `chan` in the same patchbay section.
2. An existing wireless channel of the same type already present in the patch graph.

Names never resolve to graph object titles. This keeps the model simple: if a user wants an object to participate in the patchbay, they first expose it through `send`, `recv`, `send~`, `recv~`, `send.vdo`, or `recv.vdo`.

## DSL

Patchbay code is divided into type sections:

```text
[Video]
chan B
A -> B -> C

[Audio]
chan F
E -> F -> G

[Message]
chan H
I -> H
H -> J
```

Section names are case-insensitive and canonicalized as `Message`, `Audio`, and `Video`.

### Declarations

```text
chan Reverb
```

Declares a patchbay-local virtual channel in the current section. A declared channel is scoped to its section, so `Reverb` in `[Audio]` and `Reverb` in `[Video]` are separate channels.

Declarations may appear before or after routes in the same section. A route can use a declared channel even if the declaration appears later in the section.

### Routes

```text
Source -> Middle -> Destination
```

A route chain expands into pairwise forwarding:

```text
Source -> Middle
Middle -> Destination
```

For v1, every route segment means "receive from the left channel and forward to the right channel" within the current section's data type.

### Identifiers

V1 identifiers are unquoted channel names. They may contain letters, numbers, underscores, dashes, dots, slashes, and tildes. They may not contain whitespace or `->`.

Quoted channel names can be considered later if users need spaces or other punctuation.

## Channel Resolution

The patchbay object builds a known-channel set for each section:

- Local channels from `chan` declarations in that section.
- Existing message channels from `send <channel>` / `recv <channel>` and JS channel subscriptions.
- Existing audio channels from `send~ <channel>` / `recv~ <channel>`.
- Existing video channels from `send.vdo <channel>` / `recv.vdo <channel>`.

Resolution is type-specific. An audio section only sees audio channels, a video section only sees video channels, and a message section only sees message channels.

If a route references a name that is not declared locally and is not an existing wireless channel of that type, the name is unresolved.

## Runtime Semantics

### Message

For each message route:

```text
A -> B
```

the patchbay subscribes to message channel `A` and broadcasts received messages to message channel `B`.

Message routes preserve the original message payload. The forwarded message should include enough metadata for debugging to show that it was forwarded by the patchbay object, while avoiding infinite self-forwarding loops.

### Audio

For each audio route:

```text
A -> B
```

the patchbay creates an internal audio forwarding path from channel `A` to channel `B`.

Conceptually this behaves like:

```text
recv~ A -> send~ B
```

Multiple audio sources into the same channel follow the existing audio channel summing behavior.

### Video

For each video route:

```text
A -> B
```

the patchbay creates an internal video forwarding path from channel `A` to channel `B`.

Conceptually this behaves like:

```text
recv.vdo A -> send.vdo B
```

Multiple video sources into the same channel follow the existing video channel behavior. If the current video system keeps only the latest sender for a channel, the patchbay should report a warning when the DSL creates obvious multiple-source video fan-in.

## Cycles

V1 should reject cycles inside a section:

```text
[Message]
chan A
chan B
A -> B
B -> A
```

Cycles are especially dangerous for message routing and can also make audio/video routing difficult to reason about. The diagnostic should identify the involved channels and section.

Future versions can revisit explicit feedback routing if there is a clear user need.

## Editor UX

The patchbay object uses a CodeMirror editor with a small custom language mode.

Syntax highlighting:

- Section headers: type color per section.
- `chan`: keyword color.
- Declared local channels: accent color.
- Existing external wireless channels: normal resolved-channel color.
- Unknown channels: red highlight and diagnostic underline.
- Route arrows: muted operator color.

Hover hints:

```text
Reverb
Local audio channel declared on line 2
```

```text
DrumBus
Existing audio channel from send~ / recv~
```

```text
Compsite
Unknown video channel. Declare it with `chan Compsite` or create a matching send.vdo / recv.vdo object.
```

Diagnostics are shown inline through line highlighting, token underlines, and hover hints. The object should still render the editor when the DSL is invalid, but invalid routes should not be applied.

## Diagnostics

Errors:

- Unknown section name.
- Route outside a section.
- `chan` outside a section.
- Invalid identifier.
- Unknown channel.
- Duplicate `chan` declaration in the same section.
- Cycle in a section.
- Malformed route arrow or incomplete route.

Warnings:

- Declared channel is unused.
- Obvious multiple-source fan-in for video channels when the runtime would choose only one source.
- Repeated identical route in the same section.

## Object Behavior

The object should have no visible inlets or outlets in v1. It is a routing controller for named wireless channels.

On edit:

1. Parse the DSL.
2. Resolve channels against current local declarations and global wireless channel registries.
3. Produce syntax diagnostics.
4. If there are no errors, update the patchbay's active route registrations.
5. If there are errors, keep the last valid runtime routes active and show diagnostics for the current text.

On delete or unload, the patchbay unregisters all routes it owns.

The patchbay should also re-resolve when the surrounding patch graph's wireless channel set changes. For example, if `Reverb` is unresolved in `[Audio]` and the user later creates `send~ Reverb`, the diagnostic should clear and the route should become active without requiring a meaningless text edit.

## Architecture

Implement the feature as three separable pieces:

1. `patchbay` parser and analyzer
   - Pure TypeScript module.
   - Converts text into sections, declarations, routes, diagnostics, and resolved route graph.
   - Unit-tested without Svelte or runtime systems.

2. Patchbay runtime adapter
   - Owns registrations for one patchbay node instance.
   - Applies resolved message and audio routes to existing channel systems.
   - Leaves video route application for a later implementation phase.
   - Cleans up old registrations before applying new valid routes.

3. Patchbay editor component
   - Svelte node UI plus CodeMirror language support.
   - Displays syntax highlighting, hover hints, and diagnostics.
   - Uses existing code editor patterns where possible.

## Integration Points

- Message channels: existing message channel registry used by `send`/`recv` and JS `send(..., { channel })` / `recv(..., { channel })`.
- Audio channels: existing audio channel registry used by `send~`/`recv~`.
- Video channels: existing video channel registry used by `send.vdo`/`recv.vdo`.
- Object browser: add `patchbay` to a routing/control-oriented pack.
- Documentation: add object docs for `patchbay`.
- AI prompts: add `patchbay` to object descriptions and object prompt registry.
- CodeMirror: add a patchbay language mode or extension for highlighting, hovers, and diagnostics.

## Testing

Parser/analyzer tests:

- Parses three sections and multiple route chains.
- Treats section names case-insensitively.
- Allows the same channel name in different sections.
- Resolves declared local channels.
- Resolves provided external channels by section type.
- Reports unknown channels.
- Reports duplicate declarations.
- Reports cycles.
- Expands chains into pairwise routes.

Runtime tests:

- Message route forwards payloads from source channel to destination channel.
- Updating the DSL removes stale routes.
- Invalid edits keep the last valid active route set.
- Deleting the object unregisters its routes.
- Audio and video runtime adapters produce the expected forwarding registrations or virtual edges.

UI tests:

- Unknown channels are highlighted and listed in diagnostics.
- Hover hints distinguish local channels from existing external channels.
- Valid edits clear diagnostics and apply routes.

## Future Ideas

### Send Amounts

Audio route segments may later support gain:

```text
[Audio]
Drum * 0.4 -> Reverb
```

This would mean "send a 40% copy of `Drum` to `Reverb`" and should behave like an audio send, not like reducing the original channel's main level.

This is intentionally out of scope for v1 because it introduces gain staging, tap/send semantics, UI explanation, and possibly extra internal gain nodes.

### Explicit Prefixes

If channel resolution needs more precision later, the DSL can add optional prefixes without changing the v1 route model:

```text
local:Reverb -> external:Main
```

### Quoted Channel Names

If users need spaces or punctuation:

```text
chan "Main Reverb"
"Drum Bus" -> "Main Reverb"
```

### Patchbay Inspection

A future inspector could show the route graph generated by a patchbay object, including external wireless channel sources and destinations.
