# AGENTS.md

Patchies is a visual programming environment for audio-visual patches.

## Workflow

- Read the relevant source, docs, and local skills before making non-trivial changes.
- Before non-trivial feature, architecture, behavior, or product design changes, update the relevant numbered spec in `docs/design-docs/specs/`.
- Do not create or update specs for trivial localized changes such as spacing, typo fixes, or aligning a single node with an existing pattern.
- Keep project guidance in local skills under `.agents/skills/` instead of growing this file.

## Stack

- Svelte 5 + TypeScript
- `@xyflow/svelte`
- Bun
- TailwindCSS 4
- CodeMirror 6

Run project commands from `ui/`:

```bash
bun run build
bun run check
bun run lint
bun run test
```

Do not run `bun run dev` unless Poom explicitly asks.

## Local Skills

Load these repo-local skills when the task matches:

- `patchies-workflow`: testing expectations, spec/reflection workflow, and commit message format.
- `patchies-frontend`: Svelte, Tailwind, button, persistence, and UI implementation patterns.
- `patchies-objects`: node/object creation, handles, undo tracking, object modules, schemas, AI prompts, preset packs, and file drag/drop.
- `patchies-audio`: Audio V2 and native DSP worklet object development.
- `patchies-rendering`: rendering pipeline, render graph, FBO, worker, and preview guidance.
- `patchies-assembly-module`: VASM Rust/WASM build and linked UI asset workflow.
- `docs-style`: topic and object documentation style for `ui/static/content/**/*.md`.
