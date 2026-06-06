# 159. Patchbay Virtual Audio Expressions

## Status

Prototype extension for the text patchbay object. Implement after the initial text patchbay
object is stable.

## Problem

The text patchbay can describe static audio routes, but common audio routing often needs small gain or shaping processors between channels:

```text
Feed -> Gain -> Reverb
```

Today this requires placing and wiring a visible `expr~` object. For quick patchbay edits, it would be useful to create virtual `expr~` processors directly inside the `[Audio]` section.

## Goals

- Add compact virtual `expr~` processors to audio patchbay routes.
- Keep the syntax parallel with object aliases, using `Name = expr~ ...`.
- Support a shorthand for simple one-source expressions. This is the main prototype workflow.
- Reuse existing `expr~` expression semantics and audio processing where possible.
- Keep virtual expressions scoped to `[Audio]`.
- Avoid changing message and video routing semantics.

## Non-Goals

- Do not support virtual audio processors outside `[Audio]`.
- Do not add message or video expression processors.
- Do not invent a new audio expression language.
- Do not expose a visible `expr~` node on the canvas.
- Do not require users to declare simple inline expressions before use.
- Do not support multi-input binding syntax in the prototype.
- Do not support selecting multiple outlets from a virtual expression in the prototype.

## DSL

Virtual audio expressions are declared with an alias name, `=`, the `expr~` keyword, and an expression:

```text
[Audio]

Gain = expr~ s * 0.45
Feed -> Gain -> Reverb
```

The alias resolves as a virtual audio processor, not as a channel. In a route chain, the signal flows through the virtual `expr~` processor and then continues to the next endpoint.

Additional examples:

```text
Mute = expr~ 0
Invert = expr~ -s
SoftClip = expr~ tanh(s * 2)

Feed -> SoftClip -> Out
```

## Expression Inputs

The symbol `s` means the first signal entering the virtual expression processor.

In the prototype, the virtual expression has one signal inlet. Multiple upstream connections to
the same virtual expression are mixed by the Web Audio graph and exposed as `s`.

If multi-input virtual expressions are supported later, later signals should be available as
`s2`, `s3`, and so on, following the existing `expr~` signal naming style. That later version
needs explicit inlet-binding syntax; resolved route order should not decide which source becomes
`s`, `s2`, or `s3`.

## Shorthand

Simple one-source expressions can be written inline:

```text
Feed * 0.45 -> Reverb
```

This is sugar for an anonymous virtual expression between `Feed` and `Reverb`:

```text
Feed -> expr~ s * 0.45 -> Reverb
```

The left endpoint is the source signal. The inline expression operates on that source as `s`.

Shorthand is required in the prototype because it is the fastest path for common patchbay
edits:

```text
Mic * 0.5 -> Out
Feed / 2 -> Out
Feed + 0.1 -> Out
```

The prototype should keep shorthand conservative. It should support simple binary expressions
where the first token is a valid audio route source and the rest of the left side becomes an
`expr~` body using that source as `s`.

For example:

```text
Mic * 0.5 -> Out
```

normalizes to:

```text
Mic -> <anonymous expr~ "s * 0.5"> -> Out
```

More complex processors should use the explicit alias form:

```text
SoftClip = expr~ tanh(s * 2)
Mic -> SoftClip -> Out
```

The prototype should not support full inline `expr~` segments such as:

```text
Mic -> expr~ s * 0.5 -> Out
```

That form is harder to parse clearly because route splitting sees `->` before expression
boundaries. Keep it reserved for a later pass.

## Name Resolution

Within `[Audio]`, bare names in route chains resolve in this order:

1. Virtual audio expression alias.
2. Object alias.
3. Channel.

This mirrors the way object aliases are already resolved before channels. Duplicate aliases or declarations in the same audio section should be reported as errors.

`expr~` is only active syntax in `[Audio]`. In `[Message]` and `[Video]`, `expr~` should produce a diagnostic if used as a declaration or route segment.

## Runtime Semantics

Each virtual expression alias compiles to a hidden audio processor equivalent to a configured `expr~` object.

For:

```text
Gain = expr~ s * 0.45
Feed -> Gain -> Reverb
```

the runtime behaves conceptually like:

```text
recv~ Feed -> expr~ "s * 0.45" -> send~ Reverb
```

The virtual processor should not appear as a visible canvas node. It should be owned by the patchbay object and cleaned up when the patchbay code changes or the patchbay node is destroyed.

Generated virtual processor ids should be stable across applies:

- Named aliases use `${patchbayNodeId}:audio-expr:${aliasName}`.
- Anonymous shorthand expressions use a stable route-local id derived from the normalized
  route segment, for example `${patchbayNodeId}:audio-expr:inline:${hash(normalizedSegment)}`.

The expression text can change without changing the node id. This lets the runtime update the
existing hidden `expr~` node where possible instead of tearing down the whole route.

For a channel-to-channel virtual expression:

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

The patchbay runtime needs an explicit hidden-audio-node contract, not only edge
registration. `PatchbayObject` should be able to create or update a hidden `expr~` node, register
the edges around it, and destroy the hidden node when it is no longer referenced.

Implementation can add this contract to the patchbay audio runtime, for example:

```ts
registerVirtualExpr(routeId, { nodeId, expression })
unregisterVirtualExpr(routeId)
```

or an equivalent API on `AudioService` / `PatchbayAudioIntegration`. The important behavior is
that hidden `expr~` nodes share the same audio graph update path as visible audio nodes.

Audio routes that do not involve virtual expressions should keep using the existing patchbay
audio route behavior.

## Parser Requirements

The parser needs to recognize:

- `Name = expr~ <expression>` declarations in `[Audio]`.
- Shorthand expressions of the form `<source> <operator/expression> -> <target>`.

Route splitting must avoid treating expression content as endpoints too early. Shorthand parsing should happen before ordinary endpoint validation so `Feed * 0.45` can be normalized into `Feed -> <anonymous expr~>`.

The prototype can limit shorthand to simple binary expressions where the first token is a valid
source endpoint and the remainder is an expression using that source as `s`.

The parser/analyzer should expose virtual expressions as structured data, not only as rewritten
channel strings. A useful shape is:

```ts
type PatchbayVirtualAudioExpression = {
  id: string;
  name?: string;
  expression: string;
  line: number;
  anonymous: boolean;
};
```

Audio routes can then reference a virtual expression endpoint, or the analyzer can emit an
expanded audio-route graph plus the virtual expression table. Prefer the shape that keeps
diagnostics line-aware and avoids re-parsing route strings in the runtime. The runtime must be
able to deterministically create the hidden node and register both surrounding edges.

## Editor Requirements

The editor should distinguish:

- `expr~` as an audio processor keyword.
- Virtual expression alias names as a distinct audio symbol.
- Expression bodies using the same visual treatment as existing `expr~` expressions when practical.
- Invalid uses of `expr~` outside `[Audio]`.

The shorthand form should make the inferred virtual expression easy to understand through hover hints. For example, hovering `* 0.45` could explain that it is treated as `expr~ s * 0.45`.

## Diagnostics

The parser or runtime should report errors for:

- `expr~` declarations outside `[Audio]`.
- Duplicate virtual expression aliases.
- Expression aliases that collide with `chan` declarations or object aliases.
- Invalid `expr~` expressions.
- Shorthand expressions that cannot be normalized safely.
- Virtual expression aliases used in invalid source or target positions.
- Full inline `expr~` route segments in the prototype.
- Virtual expressions that produce multiple outlets.

Expression compile errors should point to the `expr~` declaration or shorthand expression that caused them.

Because the existing `expr~` worklet reports compile failures on the audio thread, the
prototype should also validate expression syntax on the main thread before applying routes.
Use the same expression parser semantics as `expr~` where practical. If validation succeeds on
the main thread but the worklet still fails, surface a runtime diagnostic tied to the virtual
expression line instead of only logging to the console.

## Open Questions

- Should multi-input virtual expressions get explicit inlet-binding syntax later?
- Should virtual `expr~` support multiple outlets, or should one alias always represent one output for patchbay clarity?
- Should inline full syntax be allowed later, such as `Feed -> expr~ s * 0.45 -> Reverb`, or should all named/full expressions require aliases?

## Prototype Slice

Implement explicit aliases and simple shorthand:

```text
[Audio]

Gain = expr~ s * 0.45
Feed -> Gain -> Reverb

Mic * 0.5 -> Out
```

Defer full inline `expr~` route segments, explicit multi-input binding, and multi-outlet
selection until virtual expression lifecycle cleanup, expression diagnostics, and route
resolution are solid.

Prototype rules:

- Named virtual expressions resolve before object aliases and channels in `[Audio]`.
- Simple shorthand normalizes into an anonymous virtual expression between the parsed source and
  target.
- The first source signal is available as `s`; multiple incoming sources are mixed by the Web
  Audio connection model and still appear as `s`.
- Virtual expressions expose one outlet in the patchbay prototype. If the expression body would
  produce multiple outlets, reject it with a diagnostic.
- Hidden virtual `expr~` nodes are owned by the patchbay node and destroyed when removed from the
  applied patchbay program or when the patchbay node is destroyed.

## Testing

Parser/analyzer tests should cover:

- Explicit `Name = expr~ ...` declarations in `[Audio]`.
- Shorthand normalization for `Mic * 0.5 -> Out`.
- Shorthand with object endpoints where practical, such as `obj mic-1 * 0.5 -> Out`.
- Diagnostics for `expr~` declarations outside `[Audio]`.
- Diagnostics for duplicate virtual expression aliases and alias/channel collisions.
- Diagnostics for invalid expression syntax.
- Diagnostics for unsupported full inline `expr~` route segments.

Runtime tests should cover:

- A channel-to-channel shorthand expression registers a hidden `expr~` node and two audio edges.
- A named virtual expression reuses its stable hidden node id across expression updates.
- Removed virtual expressions unregister edges and destroy hidden nodes.
- Last valid routes stay active when edited code has virtual-expression diagnostics.
