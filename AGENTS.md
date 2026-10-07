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

- Use blank lines to separate logical steps: setup, configuration, control flow, side effects, and final returns after computation.
- Keep short, closely related statements together. A lookup and its trivial early return, a task declaration and its `await`, or a mock rejection and its assertion can form one step.
- Give multiline declarations, calls, and assertions breathing room: separate them from neighboring statements with a blank line. Keep related one-line calls/assertions together; separate groups that verify different behavior.
- Prefer braced, multiline `if`/`else` and loop bodies, especially for throws and side effects. A trivial early return such as `if (!pending) return;` can stay compact.
- Reduce line density with named conditions, intermediate values for nested calls, and named interfaces for large inline object types.
- Expand configuration and payload objects across lines when their fields deserve individual attention, even when they fit on one line.
- Follow `ui/.prettierrc` for mechanical formatting. Its print width is a wrapping guideline, not a target to fill; choose readable structure and blank lines that survive Prettier.
- If a function only returns a value without interim computation, use an arrow function with an expression body: `const foo = () => bar()`.

See [patchies-workflow formatting](.agents/skills/patchies-workflow/SKILL.md#formatting) for examples and the Prettier workflow.

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
