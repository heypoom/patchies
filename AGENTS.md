# AGENTS.md

Patchies is a visual programming environment for audio-visual patches.

## Workflow

- Read the relevant source, docs, and local skills before making non-trivial changes.
- Before non-trivial feature, architecture, behavior, or product design changes, update the relevant numbered spec in `docs/design-docs/specs/`.
- Do not create or update specs for trivial localized changes such as spacing, typo fixes, or aligning a single node with an existing pattern.
- Keep project guidance in local skills under `.agents/skills/` instead of growing this file.
- ASK before making assumptions about backwards compatibility. Most of the time, the feature is still in development and DO NOT need backward compatibility. Prefer to ask over doing unnecessary backward compat migrations.

## Stack

- Svelte 5 + TypeScript
- `@xyflow/svelte`
- Bun
- TailwindCSS 4
- CodeMirror 6

## Code style

- Use blank lines to separate distinct steps in a function: declarations, guards, control-flow blocks, and returns.
- Keep declarations that form one setup step together; add a blank line before the next operation or branch, including a conditional that follows an operation inside a loop.
- Separate assertion blocks that verify distinct behavior with blank lines.
- If a function only returns a value without interim computation, use an arrow function with inline returns: `const foo = () => bar()`, don't use a block body with `return` or `function` keyword.

One-line calls/assertions on the same category stays together, this is correct:

```ts
expect(getCompletionLabels(nodeType, "onKeyD")).toContain("onKeyDown");
expect(getCompletionLabels(nodeType, "onKeyU")).toContain("onKeyUp");
```

If the calls/assertions are NOT one-line, they should be separated by blank lines, this is correct:

```ts
expect(
  foo({
    bar,
    baz,
  }),
).toContain("baz");

expect(
  baz({
    quuz,
    baz,
  }),
).toContain("bar");
```

## How to run

Run project commands from `ui/`:

```bash
bun run build
bun run check
bun run lint
bun run test
```

Do not run `bun run dev` unless Poom explicitly asks.

## Local skills

Load these repo-local skills when the task matches:

- `patchies-workflow`: testing expectations, spec/reflection workflow, and commit message format.
- `patchies-frontend`: Svelte, Tailwind, button, persistence, and UI implementation patterns.
- `patchies-objects`: node/object creation, handles, undo tracking, object modules, schemas, AI prompts, preset packs, and file drag/drop.
- `patchies-audio`: Audio V2 and native DSP worklet object development.
- `patchies-rendering`: rendering pipeline, render graph, FBO, worker, and preview guidance.
- `patchies-assembly-module`: VASM Rust/WASM build and linked UI asset workflow.
- `docs-style`: topic and object documentation style for `ui/static/content/**/*.md`.

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `heypoom/patchies`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context domain-doc layout. See `docs/agents/domain.md`.
