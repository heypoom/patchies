# 171. Graph Systems And Composable Code Representations

## Poom's Vision

In Patchies, for code-heavy objects like Three.js, GLSL or Strudel, the code tends to be jammed into one huge object with thousands of lines of code.

This defeats the purpose of Patchies, where we want people to write small and self-contained objects and compose them together. The idea is they can "break down" large programs into smaller composable ones.

One idea is to do something similar to [Strudel Flow](https://xyflow.com/labs/strudel-flow), where instead of long blocks of Strudel code, they can write smaller blocks of code plus visual representations (e.g. pads, visual arpeggiators, beats) that wires together.

In general, the ideal is to let people create visual representations or many small code snippets that ultimately compiles to one giant code block and executed together.

For Three.js, I can imagine people writing separate "scene objects", or shaders being individual objects in TSL (Three.js Shading Language), and compose it together.

For GLSL, today each GLSL node is its own FBO node in the render graph. For some use cases, simply "stitching together" code could be cheaper.

People can make "visual DSLs" with this approach too, i.e. custom interfaces where people can declare data, settings or code fragments that can be interpreted by the system.

## Goal

Let people make visual DSLs and small code fragments that compose into larger
programs. Let Patchies and users define graph systems that read those fragments
and emit derived messages.

The first target use cases are GLSL functions, Three.js Shading Language (TSL)
snippets, and Strudel patterns. Existing code objects such as `glsl`, `three`,
and `strudel` remain the execution boundary.

## Context

Patchies asks people to create compact programs and connect them as a visible
composition. Long code blocks in one object work against this product goal.

Existing code objects already accept a `setCode` message. A graph system can
generate source and send that message through its ordinary output cables. This
work adds an authoring layer before code runtimes. It does not replace them.

## Product Direction

Patchies should support this flow:

```text
Visual representation edits
-> Composable program data in the patch graph
-> Graph system
-> Generated source message
-> Existing code object and runtime
```

The same composed program can have more than one representation. The default
Patchies graph is one representation. A pad grid, visual arpeggiator, scene
editor, or spatial model can be another representation.

The representation owns its layout, controls, and interaction rules. The
runtime owns the executable graph and object lifecycle.

## Tags

Every persisted object can store user tags in `data.tags`. Tags let a graph
system find objects without a container, parent object, or canvas region.

User tags can use namespaces. For example:

```ts
data.tags = ["shader/foo/function", "shader/foo/noise"];
```

Patchies also derives reserved core tags. A user or custom object must not add
or replace a `core/*` tag.

```text
core/audio
core/video
core/ui
```

An object can have more than one core tag. For example, the `video` object can
have `core/audio`, `core/video`, and `core/ui`.

An effective tag set combines user tags, object-definition metadata tags, and
derived core tags. Graph systems receive one merged `tags` array. They do not
need to know where a tag came from.

## `setTags`

Every user-authored persisted object that executes through `JSRunner` should
provide this function:

```js
setTags(["shader/foo/function", "shader/foo/noise"]);
```

`setTags` replaces the object's complete user tag list. It does not change its
derived core tags. User tags remain until code calls `setTags([])`.

This lets `js`, `canvas.dom`, `dom`, `vue`, `p5`, audio code objects, and other
JSRunner objects advertise their role to a graph system. Worker-backed objects
use a bridge to persist the same `data.tags` change in the main runtime.

## Graph Systems

A graph system is runtime-owned behavior that reads a selected graph subset and
emits derived messages. A compiler is one type of graph system.

In the first slice, only the standard `js` object provides `onGraphChange`. Its
runtime instance owns the subscription. The subscription continues when the
Svelte view unmounts. A future custom object can use the same runtime API.

The first API is:

```js
const unsubscribe = onGraphChange(
  { tags: ["shader/foo/*"] },
  ({ nodes, edges }) => {
    send(compile(nodes, edges));
  },
);
```

`nodes` are headless runtime objects. They are not XYFlow nodes. Each node has
`id`, `type`, `data`, and its effective `tags`. Each edge has `id`, `source`,
`outlet`, `target`, and `inlet`.

The callback receives these items:

- Every node that matches a supplied tag pattern in the patch.
- Every edge with matching source and target nodes.
- The complete current snapshot of those nodes and edges.

The callback gives edges their DSL-specific meaning. An edge can mean a function
input, pattern order, scene relationship, or another authored relation.

## Tag Matching

The first API accepts exact tags and a trailing `/*` namespace wildcard.

```js
onGraphChange({ tags: ["shader/foo/*"] }, compile);
```

When a query provides multiple patterns, a node matches when any pattern matches
one of its tags. Authors can apply additional filtering inside the callback.

The first API does not provide `allTags` or a filter predicate. Future APIs can
add field dependencies, `filter`, and `includePosition` after real use cases
need them.

## Subscription Lifecycle

The callback runs immediately when the current graph has matching nodes. It
also runs when matching node data changes or internal edges change. It does not
run when no nodes match, including after all matching nodes disappear.

Patchies coalesces rapid edits into one callback for a settled graph update.
It does not include editor position in the first API.

`PatchRuntime` supplies changed object IDs and connection endpoints to the
subscription kernel. A subscription re-evaluates only when those changes could
affect its previous or current matching subgraph.

Each subscription reconciles independently. A slow compiler must not delay an
unrelated graph system. If a callback is asynchronous, only its latest snapshot
may emit a result. A stale callback must not overwrite a newer result.

`onGraphChange` returns an unsubscribe function. Patchies also removes remaining
subscriptions when the owning runtime object reruns or is destroyed.

If a callback fails, Patchies keeps its last successful output. It reports the
error on the owning object and retries after the next matching graph change.

## Outputs And Feedback

Graph systems do not change the authored graph in the first slice. They emit
normal Patchies messages.

By default, `send` fans out through visible output cables. A system can use a
named channel when its author explicitly chooses that path.

A compiler can send a `setCode` message to one or more compatible code objects.
The system author controls whether it also sends `run`. Patchies does not add a
run message automatically.

Authors must avoid observing their own output target. A compiler should tag its
source fragments, not its `glsl`, `three`, or `strudel` target. Patchies can add
feedback-loop diagnostics later.

## Compiler Systems

A compiler system composes program fragments. It must not concatenate arbitrary
strings without structure.

Each DSL defines small fragment roles that its compiler understands. For example,
a GLSL DSL can define imports, uniforms, functions, expressions, and output
contributions. A Strudel DSL can define patterns, transformations, arrangements,
and controls.

The compiler owns global source concerns:

- Fragment order.
- Imports and shared declarations.
- Generated names and name conflicts.
- Target entry points and wrappers.
- Source formatting.
- Diagnostics that point back to source fragments.

People own fragments and their composition. The compiler owns generated source.
Generated source must remain inspectable. Patchies must not keep two silent
sources of truth when a person edits generated source.

## Initial Scope

The first implementation has these boundaries:

- `setTags` is available to `js`, `canvas.dom`, `three.dom`, `dom`, and `vue`.
- `onGraphChange` is available only in the standard `js` object.
- The `js` runtime owns execution and subscriptions outside `JSBlockNode.svelte`.
- The graph query uses tags, nodes, and internal edges only.
- The graph query does not include position or a filter predicate.
- The callback can read all matching node data.
- The callback emits messages but does not change the authored graph.
- Existing audio and video reconcilers do not move to graph systems yet.

The initial end-to-end proof uses a `js` object that watches `shader/foo/*`,
compiles fragment nodes, and sends generated source to a `glsl` object.

## Future Direction

Later work can add these features:

- `filter` predicates and field dependencies.
- `includePosition` through a host-provided layout API.
- Graph systems in custom runtime objects.
- Dormant headless systems that run without an authored owner object.
- Feedback-loop diagnostics and explicit graph transformations.
- Migration of audio, video, and other reconcilers to the shared query kernel.

The layout API must remain separate from `PatchRuntime`. A host owns positions,
selection, and visual representation. The headless runtime must run without
XYFlow or Svelte.

## Relationship To Existing Architecture

This design extends [40. Headless Patcher System](40-headless-patcher-system.md)
and [168. Runtime Object And Editor Representations](168-runtime-object-editor-representations.md).

`PatchRuntime` owns graph changes and runtime lifecycle. `JSRunner` supplies
the JavaScript execution context. It must receive a graph-subscription function
from the owning runtime object. `JSRunner` must not own one global graph.

The default editor is a runtime client. It projects editor objects and edges into
the runtime graph. It does not own graph-system subscriptions.

## Non-Goals

- Replace existing `glsl`, `three`, or `strudel` runtimes.
- Require a container, group, or spatial region for composition membership.
- Treat ordinary runtime messages as code-composition edges.
- Define one universal intermediate language for all code targets.
- Add `filter` or `includePosition` in the first API.
- Allow reactive callbacks to change the authored graph.
- Migrate existing audio or video reconcilers in the first implementation.
