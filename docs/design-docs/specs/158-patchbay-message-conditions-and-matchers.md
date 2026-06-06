# 158. Patchbay Message Conditions and Matchers

## Status

Proposed future extension. Do not implement as part of the initial text patchbay object.

## Problem

The text patchbay can compactly describe static message, audio, and video routes, but message patches often need small routing decisions:

- Send note-on messages to one destination and note-off messages to another.
- Drop messages that do not match a predicate.
- Route one source into a small conditional fan-out without adding a separate JavaScript object.

This spec explores message-only conditions and matchers as a future extension to `# 157. Text Patchbay Object`.

## Goals

- Add compact conditional message routing inside the patchbay DSL.
- Keep conditions message-only. Audio and video routing remain static graph routes.
- Let conditions use JavaScript predicate bodies for expressive matching.
- Support both inline use in route chains and named matcher aliases.
- Keep unmatched messages predictable: they are dropped unless an explicit `else` branch handles them.
- Preserve patchbay ergonomics: routes should still read like a quick wiring plan.

## Non-Goals

- Do not add JavaScript transforms that modify message payloads.
- Do not support async predicates in the first version.
- Do not support conditions in `[Audio]` or `[Video]`.
- Do not make condition names resolve to channels.
- Do not replace full JavaScript nodes for complex logic.

## DSL

Conditions are declared in `[Message]` sections with `cond`, a name, function parameters, an arrow, and a JavaScript predicate body. The body continues until an `end` line.

```text
[Message]

cond NoteOn d =>
  d.type === 'noteOn'
end

cond NoteOff (d, { inlet }) =>
  d.type === 'noteOff'
end
```

The parameter form should accept either a single identifier:

```text
cond NoteOn d =>
  d.type === 'noteOn'
end
```

or a parenthesized parameter list:

```text
cond FromMainInlet (d, { inlet }) =>
  inlet === 0
end
```

The predicate is compiled as a JavaScript function. It receives the message data and optional metadata. A truthy return value passes the message through; a falsy return value drops it for that branch.

### Filter Segments

A condition name can appear as a filter segment inside a message route:

```text
Foo -> NoteOn -> Bar
Foo -> not NoteOn -> Baz
```

This means:

- Subscribe to `Foo`.
- For messages where `NoteOn(message, meta)` is truthy, forward to `Bar`.
- For messages where `NoteOn(message, meta)` is falsy, forward to `Baz`.

`not` only applies to the next condition segment.

### Match Blocks

A `match` block branches one incoming message into the first matching route.

```text
Foo -> match {
  NoteOn -> Bar
  NoteOff -> Baz
  else -> Baal
}
```

Branches are evaluated in order. The first branch whose condition passes receives the message. The `else` branch is optional and receives unmatched messages when present.

Commas are optional line separators inside a `match` block:

```text
Foo -> match {
  NoteOn -> Bar,
  NoteOff -> Baz,
  else -> Baal
}
```

### Match Aliases

Matchers can be assigned to a section-local alias:

```text
Quux = match {
  NoteOn -> Bar
  NoteOff -> Baz
  else -> Baal
}

Foo -> Quux
```

Aliases keep larger patchbay programs tidy. A match alias resolves as a message routing segment, not as a channel.

## Name Resolution

Within `[Message]`, bare names in route chains resolve in this order:

1. Condition or matcher alias.
2. Object alias.
3. Channel.

This keeps `Foo -> NoteOn -> Bar` useful without requiring punctuation around common filter names. It also means a condition name shadows a channel name in the same section. Duplicate declarations should be reported as errors.

In `[Audio]` and `[Video]`, `cond`, `match`, and `not` are reserved for future compatibility but should produce an error if used as active syntax.

## Runtime Semantics

Conditions and matchers compile into message-only routing plans. Static audio and video routes are unaffected.

For a route like:

```text
Foo -> NoteOn -> Bar
```

the patchbay subscribes to `Foo`. On each message, it evaluates `NoteOn(message, meta)`. If the predicate passes, the original message is forwarded to `Bar`.

For a route like:

```text
Foo -> not NoteOn -> Baz
```

the same predicate is evaluated and negated before forwarding.

For a `match` block, branches are evaluated in order and only the first passing branch forwards the message. If no branch matches and no `else` exists, the message is dropped.

Predicates should be pure and synchronous. Predicate exceptions should not crash the patch. They should produce a visible diagnostic or runtime error entry associated with the condition name and patchbay node.

## JavaScript Predicate Environment

The JavaScript function body should have access to:

- The declared parameters, such as `d` or `(d, meta)`.
- A metadata object with message routing context when available.
- Standard JavaScript syntax.

The first version should not expose Patchies mutation APIs from conditions. Conditions should answer "does this message pass?" rather than mutate graph state or send their own messages.

## Parser Requirements

This feature requires the patchbay parser to understand block syntax instead of treating every non-comment line as a declaration or route.

The parser needs states for:

- Normal patchbay statements.
- `cond ... =>` JavaScript bodies until `end`.
- Inline `match { ... }` blocks.
- Assigned `Name = match { ... }` blocks.

Route splitting cannot be a simple `raw.split('->')` when `match` blocks are present, because arrows inside a match block belong to match branches.

## Editor Requirements

The editor should distinguish:

- `cond`, `match`, `not`, `else`, and `end` as patchbay keywords.
- Condition names and matcher aliases as message routing symbols.
- JavaScript bodies inside `cond` blocks using JavaScript syntax highlighting.
- Unknown condition/matcher/channel names with existing inline diagnostics.

Nested JavaScript highlighting is the riskiest editor piece. A minimal version can highlight the surrounding `cond` block as patchbay syntax and leave the JavaScript body as plain text. A polished version should move the patchbay language from a simple stream parser toward a mixed-language parser that can mount JavaScript highlighting inside `cond` bodies.

## Diagnostics

The parser should report errors for:

- `cond` outside `[Message]`.
- Duplicate condition, matcher, channel, or object alias names in the same message section.
- `not` followed by a non-condition.
- `match` branches that reference unknown conditions.
- `match` blocks without any branches.
- Unterminated `cond` or `match` blocks.
- JavaScript predicate compile errors.
- Runtime predicate exceptions.

## Open Questions

- Should condition names shadow channels, or should ambiguous names require an explicit prefix later?
- Should `match` be first-match only, or should it support fan-out to every passing branch?
- Should predicate metadata include the source channel, patchbay node id, and original sender node id?
- Should conditions support a concise expression-only form without `end` later?

## Recommended First Slice

Implement only message filter segments first:

```text
[Message]

cond NoteOn d =>
  d.type === 'noteOn'
end

Foo -> NoteOn -> Bar
Foo -> not NoteOn -> Baz
```

Defer `match` blocks and matcher aliases until condition parsing, compilation, diagnostics, and runtime forwarding are proven.
