---
name: patchies-workflow
description: Use when working in Patchies on formatting, tests, specs, reflections, verification scope, or commits, especially before changing product behavior or when the user explicitly asks to commit.
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

## Formatting

Apply the [AGENTS.md code style](../../../AGENTS.md#code-style) when writing or reviewing code. Choose logical grouping and readable expression structure, then use `ui/.prettierrc` for mechanical formatting.

### Whitespace and grouping

- Separate independent multiline declarations, mock configurations, calls, and assertions with one blank line, including before and after a multiline statement beside short statements.
- Keep short statements together when they form one step. Setup/action/assertion labels alone do not require a blank line between every statement: setting a mock rejection and immediately asserting that rejection can stay together.
- Separate distinct phases and assertion groups, even if each statement is short. Apply the same grouping inside loops and callbacks.
- Prefer braced, multiline branches and loops for throws, assignments, callbacks, and yields. Separate consecutive independent `if` blocks with blank lines; keep `else` attached to its `if`. Trivial early returns can remain one-line guards next to their lookup.

```ts
const pending = this.pending.get(message.requestId);
if (!pending) return;

const handler = pending.handlers.get(message.name);

if (!handler) {
  throw new Error(`llm: unknown tool "${message.name}"`);
}
```

### Line density and Prettier

- Prefer fewer concepts and characters per line when it improves scanning, even below the configured print width. This is a structural preference, not a request to lower the formatter's width.
- Name a long compound condition before its `if`, using a meaningful name such as `hasInvalidToolDefinition`, and separate the declaration from the branch.
- Extract nested operations into meaningful intermediate values. Keep a simple task declaration next to its `await`; separate a multiline request construction from the operation that consumes it.
- Use a named interface when an inline object type makes a generic or signature difficult to read, as with `Map<string, LLMPendingSession>`.
- Expand configuration and payload objects with one property per line when that makes the fields easier to scan. Small, cohesive records can remain inline.
- Format chained calls one method per line when that makes the setup easier to scan and Prettier retains the layout.

```ts
const turn = provider.streamTurn(history, {
  tools: declarations,
  signal: options.abortSignal,
  systemPrompt: options.systemPrompt
});

const result = await awaitLLMOperation(turn, options.abortSignal);

expect(result.text).toBe('Done');
expect(result.toolCalls).toHaveLength(0);

expect(provider.streamTurn).toHaveBeenCalledWith(history, {
  tools: declarations,
  signal: options.abortSignal,
  systemPrompt: options.systemPrompt
});
```

Prettier preserves these statement-grouping blank lines and expanded object literals, but does not infer the logical boundaries, add braces, or extract meaningful names. A formatter check alone does not establish this style. Review grouping after formatting, and prefer structural simplification when Prettier collapses an arbitrary manual line break.

Run the local Prettier check on touched code from `ui/` (for example, `bun run prettier --check src/lib/ai/llm-js/llm-tools.ts`). Keep formatting scoped to the files being changed.

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
