# 159. Patchbay Virtual Audio Expressions

## Status

Proposed future extension. Do not implement as part of the initial text patchbay object.

## Problem

The text patchbay can describe static audio routes, but common audio routing often needs small gain or shaping processors between channels:

```text
Feed -> Gain -> Reverb
```

Today this requires placing and wiring a visible `expr~` object. For quick patchbay edits, it would be useful to create virtual `expr~` processors directly inside the `[Audio]` section.

## Goals

- Add compact virtual `expr~` processors to audio patchbay routes.
- Keep the syntax parallel with object aliases, using `Name = expr~ ...`.
- Support a shorthand for simple one-source expressions.
- Reuse existing `expr~` expression semantics and audio processing where possible.
- Keep virtual expressions scoped to `[Audio]`.
- Avoid changing message and video routing semantics.

## Non-Goals

- Do not support virtual audio processors outside `[Audio]`.
- Do not add message or video expression processors.
- Do not invent a new audio expression language.
- Do not expose a visible `expr~` node on the canvas.
- Do not require users to declare simple inline expressions before use.

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

If multi-input virtual expressions are supported, later signals should be available as `s2`, `s3`, and so on, following the existing `expr~` signal naming style.

When multiple upstream routes feed the same virtual expression, `s` binds to the first compatible source signal according to the resolved route order. This keeps shorthand predictable enough for live patching while avoiding a new explicit inlet-binding syntax in the first version.

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

Shorthand should stay conservative in the first version. It is best for simple scalar expressions:

```text
Feed * 0.45 -> Reverb
Feed / 2 -> Out
Feed + 0.1 -> Out
```

More complex processors should use the explicit alias form.

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

Generated virtual processor ids should be stable across applies when the source code has not meaningfully changed. This avoids unnecessary audio graph churn while editing unrelated lines.

## Parser Requirements

The parser needs to recognize:

- `Name = expr~ <expression>` declarations in `[Audio]`.
- Inline `expr~ <expression>` route segments if full inline syntax is supported.
- Shorthand expressions of the form `<source> <operator/expression> -> <target>`.

Route splitting must avoid treating expression content as endpoints too early. Shorthand parsing should happen before ordinary endpoint validation so `Feed * 0.45` can be normalized into `Feed -> <anonymous expr~>`.

The first version can limit shorthand to simple binary expressions where the first token is a valid source endpoint and the remainder is an expression using that source as `s`.

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

Expression compile errors should point to the `expr~` declaration or shorthand expression that caused them.

## Open Questions

- Should shorthand support only simple binary operations, or any expression after the first endpoint?
- Should multi-input virtual expressions get explicit inlet-binding syntax later?
- Should virtual `expr~` support multiple outlets, or should one alias always represent one output for patchbay clarity?
- Should inline full syntax be allowed, such as `Feed -> expr~ s * 0.45 -> Reverb`, or should all named/full expressions require aliases?

## Recommended First Slice

Implement explicit aliases only:

```text
[Audio]

Gain = expr~ s * 0.45
Feed -> Gain -> Reverb
```

Defer shorthand until virtual expression aliases, lifecycle cleanup, expression diagnostics, and route resolution are solid.
