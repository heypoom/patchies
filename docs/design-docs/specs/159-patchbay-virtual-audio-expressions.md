# 159. Patchbay Virtual Audio Nodes

## Status

Prototype extension for the text patchbay object. The initial slice supported virtual `expr~`;
this revision broadens the same mechanism to a small explicit whitelist of virtual audio sources
and effects.

## Problem

The text patchbay can describe static audio routes, but common audio routing often needs small gain,
filter, or shaping processors between channels:

```text
Feed -> Gain -> Reverb
```

Today this requires placing and wiring visible audio objects. For quick patchbay edits, it should be
possible to create simple virtual audio processors directly inside the `[Audio]` section.

## Goals

- Add compact virtual audio nodes to audio patchbay routes.
- Keep the syntax parallel with object aliases, using `Name = <audio-node> ...`.
- Keep shorthand math as `expr~` sugar only.
- Reuse existing audio node creation, object parameter parsing, and connection semantics where possible.
- Keep virtual processors scoped to `[Audio]`.
- Avoid changing message and video routing semantics.

## Non-Goals

- Do not support virtual audio processors outside `[Audio]`.
- Do not add message or video expression processors.
- Do not invent a new audio expression language.
- Do not expose visible processor nodes on the canvas.
- Do not require users to declare simple inline expressions before use.
- Do not support multi-input binding syntax in the prototype.
- Do not support selecting multiple outlets from a virtual processor in the prototype.
- Do not support destination, channel, resource-loading, or UI-managed audio nodes as virtual nodes.
- Do not infer support from every object in the Audio Effects pack; support only the explicit whitelist below.

## DSL

Virtual audio nodes are declared with an alias name, `=`, a supported audio node type, and
creation arguments:

```text
[Audio]

Gain = expr~ s * 0.45
Feed -> Gain -> Reverb

Smooth = fexpr~ x1 * 0.5 + x1[-1] * 0.5
Mic -> Smooth -> Out

Filter = lowpass~ 1000 1
Mic -> Filter -> Out

Osc = osc~ 440 sine 0
Osc -> Out
```

The alias resolves as a virtual audio node, not as a channel. In a route chain, the signal flows
through the hidden node and then continues to the next endpoint.

The prototype supports this explicit whitelist only:

```text
expr~
fexpr~
osc~
gain~
lowpass~
highpass~
bandpass~
notch~
allpass~
lowshelf~
highshelf~
peaking~
compressor~
delay~
```

Other audio nodes, including `mic~`, `out~`, `send~`, `recv~`, `soundfile~`, `sampler~`,
`csound~`, `convolver~`, and `waveshaper~`, should be rejected as unsupported virtual audio
nodes.

## Expression Inputs

For virtual `expr~`, the symbol `s` means the first signal entering the virtual expression
processor.

For virtual `fexpr~`, the same explicit declaration and inline route forms are supported, but the
expression uses `fexpr~` history syntax such as `x1[-1]`, `s[-1]`, and `y1[-1]`.

In the prototype, a virtual processor has one main signal inlet and one signal outlet. Multiple
upstream connections to the same virtual `expr~` are mixed by the Web Audio graph and exposed as
`s`.

If multi-input virtual expressions are supported later, later signals should be available as `s2`,
`s3`, and so on, following the existing `expr~` signal naming style. That later version needs
explicit inlet-binding syntax; resolved route order should not decide which source becomes `s`,
`s2`, or `s3`.

## Shorthand

Simple one-source expressions can be written inline:

```text
Feed * 0.45 -> Reverb
```

This is sugar for an anonymous virtual `expr~` between `Feed` and `Reverb`:

```text
Feed -> expr~ s * 0.45 -> Reverb
```

The left endpoint is the source signal. The inline expression operates on that source as `s`.
Shorthand is required in the prototype because it is the fastest path for common patchbay edits:

```text
Mic * 0.5 -> Out
Feed / 2 -> Out
Feed + 0.1 -> Out
```

Shorthand applies only to `expr~`. Generic audio nodes require either a named declaration or
an explicit route segment:

```text
Gain = gain~ 0.5
Mic -> Gain -> Out

Mic -> lowpass~ 1000 1 -> Out
Mic -> expr~ s * 0.5 -> Out
Mic -> fexpr~ x1 * 0.5 + x1[-1] * 0.5 -> Out
osc~ 440 sine 0 -> Out
```

Inline `expr~` and `fexpr~` route segments are supported when the expression body does not contain
`->`. Expressions that need more complex route-like syntax should use a named declaration.

## Name Resolution

Within `[Audio]`, bare names in route chains resolve in this order:

1. Virtual audio processor alias.
2. Object alias.
3. Channel.

This mirrors the way object aliases are already resolved before channels. Duplicate aliases or
declarations in the same audio section should be reported as errors.

Virtual audio processor declarations are only active syntax in `[Audio]`. In `[Message]` and
`[Video]`, supported virtual audio processor declarations should produce diagnostics.

## Runtime Semantics

Each virtual audio node compiles to a hidden audio node equivalent to a configured audio object.

For:

```text
Osc = osc~ 440 sine 0
Osc -> Out
```

the runtime behaves conceptually like:

```text
osc~ 440 sine 0 -> send~ Out
```

For:

```text
Gain = expr~ s * 0.45
Feed -> Gain -> Reverb
```

the runtime behaves conceptually like:

```text
recv~ Feed -> expr~ "s * 0.45" -> send~ Reverb
```

For:

```text
Filter = lowpass~ 1000 1
Feed -> Filter -> Reverb
```

the runtime behaves conceptually like:

```text
recv~ Feed -> lowpass~ 1000 1 -> send~ Reverb
```

Virtual audio node params should use the same object argument parser as `ObjectNode`, so creation
args match visible object behavior.

The virtual audio node should not appear as a visible canvas node. It should be owned by the
patchbay object and cleaned up when the patchbay code changes or the patchbay node is destroyed.

Generated virtual processor ids should be stable across applies:

- Named aliases use `${patchbayNodeId}:audio-virtual:${aliasName}`.
- Anonymous shorthand expressions use a stable route-local id derived from the normalized route
  segment, for example `${patchbayNodeId}:audio-virtual:inline:${hash(normalizedSegment)}`.

The node type and params can change without changing the alias id. The runtime may update an
existing compatible hidden node where possible, or recreate it when the node type changes.

For a channel-to-channel shorthand expression:

```text
Mic * 0.5 -> Out
```

the runtime should expand to hidden audio edges equivalent to:

```text
recv~ Mic -> expr~ "s * 0.5" -> send~ Out
```

For object endpoints, the same virtual processor sits between the resolved source and target:

```text
obj mic-1 -> Gain -> obj out-2
```

expands conceptually to:

```text
obj mic-1 -> expr~ "s * 0.45" -> obj out-2
```

The patchbay runtime needs an explicit hidden-audio-node contract, not only edge registration.
`PatchbayObject` should be able to create or update a hidden audio node, register the edges around
it, and destroy the hidden node when it is no longer referenced.

Implementation can add this contract to the patchbay audio runtime, for example:

```ts
registerVirtualAudioNode(routeId, { nodeId, type, params });
unregisterVirtualAudioNode(routeId);
```

or an equivalent API on `AudioService` / `PatchbayAudioIntegration`. The important behavior is that
hidden virtual audio nodes share the same audio graph update path as visible audio nodes.

Audio routes that do not involve virtual processors should keep using the existing patchbay audio
route behavior.

## Parser Requirements

The parser needs to recognize:

- `Name = expr~ <expression>` declarations in `[Audio]`.
- `Name = <whitelisted-audio-node> <args...>` declarations in `[Audio]`.
- Inline explicit whitelisted node route segments such as `Mic -> lowpass~ 1000 1 -> Out`.
- Inline explicit whitelisted source route segments such as `osc~ 440 sine 0 -> Out`.
- Shorthand expressions of the form `<source> <operator/expression> -> <target>`.

Route splitting must avoid treating expression content as endpoints too early. Shorthand parsing
should happen before ordinary endpoint validation so `Feed * 0.45` can be normalized into
`Feed -> <anonymous expr~>`.

The prototype can limit shorthand to simple binary expressions where the first token is a valid
source endpoint and the remainder is an expression using that source as `s`.

The parser/analyzer should expose virtual audio nodes as structured data, not only as rewritten
channel strings. A useful shape is:

```ts
type PatchbayVirtualAudioNode = {
  id: string;
  name?: string;
  type: string;
  rawArgs: string[];
  params: unknown[];
  expression?: string;
  line: number;
  anonymous: boolean;
};
```

Audio routes can then reference a virtual audio node endpoint, or the analyzer can emit an expanded
audio-route graph plus the virtual node table. Prefer the shape that keeps diagnostics line-aware
and avoids re-parsing route strings in the runtime. The runtime must be able to deterministically
create the hidden node and register both surrounding edges.

## Editor Requirements

The editor should distinguish:

- `expr~` as an audio processor keyword.
- Whitelisted virtual audio node names as audio keywords.
- Virtual audio node alias names as a distinct audio symbol.
- Expression bodies using the same visual treatment as existing `expr~` expressions when practical.
- Invalid uses of virtual processor syntax outside `[Audio]`.

The shorthand form should make the inferred virtual expression easy to understand through hover
hints. For example, hovering `* 0.45` could explain that it is treated as `expr~ s * 0.45`.

## Diagnostics

The parser or runtime should report errors for:

- Virtual audio node declarations outside `[Audio]`.
- Unsupported virtual audio node declarations or route segments.
- Duplicate virtual audio node aliases.
- Processor aliases that collide with `chan` declarations or object aliases.
- Invalid `expr~` expressions.
- Shorthand expressions that cannot be normalized safely.
- Virtual processor aliases used in invalid source or target positions.
- Full inline `expr~` route segments in the prototype.
- Virtual processors that produce multiple outlets.

Expression compile errors should point to the `expr~` declaration or shorthand expression that
caused them.

Because the existing `expr~` worklet reports compile failures on the audio thread, the prototype
should also validate expression syntax on the main thread before applying routes. Use the same
expression parser semantics as `expr~` where practical. If validation succeeds on the main thread
but the worklet still fails, surface a runtime diagnostic tied to the virtual expression line
instead of only logging to the console.

## Open Questions

- Should multi-input virtual expressions get explicit inlet-binding syntax later?
- Should virtual `expr~` support multiple outlets, or should one alias always represent one output for patchbay clarity?
- Should additional Audio Effects nodes be added after checking their port and side-effect behavior?

## Prototype Slice

Implement explicit virtual audio nodes and simple `expr~` shorthand:

```text
[Audio]

Gain = expr~ s * 0.45
Feed -> Gain -> Reverb

Osc = osc~ 440 sine 0
Osc -> Out

Filter = lowpass~ 1000 1
Feed -> Filter -> Reverb
osc~ 220 square 0 -> gain~ 0.5 -> Out
Feed -> gain~ 0.5 -> Out
Feed -> expr~ s * 0.5 -> Out

Mic * 0.5 -> Out
```

Defer explicit multi-input binding, multi-outlet selection, and unlisted audio nodes until virtual
node lifecycle cleanup, diagnostics, and route resolution are solid.

Prototype rules:

- Named virtual audio nodes resolve before object aliases and channels in `[Audio]`.
- Named virtual audio nodes use only the explicit whitelist.
- Explicit inline virtual audio nodes use only the explicit whitelist.
- Explicit inline `expr~` route segments are allowed.
- Simple shorthand normalizes into an anonymous virtual `expr~` between the parsed source and target.
- Shorthand remains `expr~`-only.
- The first source signal is available as `s`; multiple incoming sources are mixed by the Web Audio
  connection model and still appear as `s`.
- Virtual audio nodes expose one outlet in the patchbay prototype.
- Hidden virtual audio nodes are owned by the patchbay node and destroyed when removed from the
  applied patchbay program or when the patchbay node is destroyed.

## Testing

Parser/analyzer tests should cover:

- Explicit `Name = expr~ ...` declarations in `[Audio]`.
- Explicit `Name = lowpass~ 1000 1` declarations in `[Audio]`.
- Explicit `Name = osc~ 440 sine 0` declarations in `[Audio]`.
- Inline explicit processor route segments such as `Mic -> gain~ 0.5 -> Out`.
- Inline explicit source route segments such as `osc~ 440 sine 0 -> Out`.
- Inline explicit expression route segments such as `Mic -> expr~ s * 0.5 -> Out`.
- Diagnostics for unsupported audio nodes such as `convolver~`.
- Shorthand normalization for `Mic * 0.5 -> Out`.
- Shorthand with object endpoints where practical, such as `obj mic-1 * 0.5 -> Out`.
- Diagnostics for virtual processor declarations outside `[Audio]`.
- Diagnostics for duplicate virtual processor aliases and alias/channel collisions.
- Diagnostics for invalid expression syntax.

Runtime tests should cover:

- A channel-to-channel shorthand expression registers a hidden `expr~` node and two audio edges.
- A named virtual audio node registers a hidden whitelisted audio node with parsed params.
- A named virtual expression reuses its stable hidden node id across expression updates.
- Removed virtual processors unregister edges and destroy hidden nodes.
- Last valid routes stay active when edited code has virtual processor diagnostics.
