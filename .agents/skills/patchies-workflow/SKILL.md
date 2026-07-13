---
name: patchies-workflow
description: Use when working in Patchies on tests, specs, reflections, verification scope, or commits, especially before changing product behavior or when the user explicitly asks to commit.
---

# Patchies Workflow

## Specs

- Before non-trivial feature, architecture, behavior, or product design changes, update the relevant file in `docs/design-docs/specs/`.
- Specs must be numbered in both filename and title, for example `50-foo-bar.md` and `# 50. Foo Bar`.
- Do not create or update a spec for trivial localized changes such as spacing, typo fixes, or aligning a single node with an existing pattern.

## Testing

- Test observable behavior through public APIs, rendered UI, store state, emitted events, tool results, or user-visible outcomes.
- Do not test source text, imports, prompts, declarations, or implementation shape unless that exact wording or shape is user-visible product behavior.
- Do not add guardrail tests that only lock code structure.
- If behavior is embedded in a prompt, component, or declaration object, prefer extracting real decision logic and testing its inputs and outputs.
- For declaration-only changes such as preset code strings, static metadata, prompts, or config tables, prefer careful review plus targeted typecheck or lint over brittle tests.

## Verification

- Run the narrowest useful command first. Broaden only when the touched surface warrants it.
- Use `git diff --check` for patch hygiene after edits.
- Report noisy, blocked, or partial checks honestly.

## Commits

Never commit or push unless the user explicitly asks.

When asked to commit, use short imperative messages:

```text
scope: description
type(scope): description
type(scope)!: description
type: description
```

Common types: `fix`, `feat`, `refactor`, `docs`, `spec`, `add`, `chore`.

Use the object name as the scope when changes are object-specific. Use the module name when changes are module-specific.

Examples:

```text
transport: make transport panel beat indicator zero-indexed
feat(clock)!: use absolute time by default in parameter automation messages
fix(transport): reset lastPlayState on unsubscribe
refactor(orca): extract settings component into OrcaSettings
docs: shorten time signature docs
add beat object
```

Rules:

- Lowercase the first word after the colon.
- Do not add a period.
- Keep under about 72 characters.
- Use imperative mood.

## Reflections

After significant refactors, create `docs/reflections/YYYY-MM-DD-topic.md` with:

- Objective
- Key Challenges & Solutions
- What Could Be Better
- Action Items

Consult existing reflections before similar work.
