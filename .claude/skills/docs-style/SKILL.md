---
name: docs-style
description: Patchies documentation style guide. Load when writing or editing topic docs in ui/static/content/topics/ or ui/static/content/objects/. Describes the voice, structure, and formatting conventions for all Patchies docs.
paths: "ui/static/content/**/*.md"
---

# Patchies Documentation Style Guide

Use this guide whenever writing or editing documentation in `ui/static/content/`.

## Voice & Tone

- **Friendly but concise** — welcoming like P5.js docs, not terse like a man page
- Write for someone who knows how to code but is new to Patchies
- Lead with the concept ("what it is and why you'd use it"), then the how
- Use "you" to address the reader directly
- Avoid filler phrases: "Note that", "It's worth mentioning", "Simply", "Just"

## Page Structure (Topic Docs)

Follow this order — omit sections that don't apply:

1. **H1 title** — one sentence intro explaining what this topic is and why it matters
2. **Screenshot or image** (if available) — with a caption or context sentence below
3. **✨ Try-it link** — `> ✨ [Try this patch](/?id=...) — brief description.`
4. **`---` horizontal rule**
5. **How It Works** — the mental model first, before any API or steps. Use analogies (e.g. "like a hardware signal chain")
6. **`---` horizontal rule**
7. **Try It** — hands-on exercises. Use `###` sub-headings per exercise.
8. **`---` horizontal rule**
9. **Feature sections** — one `##` section per major concept, separated by `---`
10. **See Also** — links with one-line descriptions

## Formatting Rules

### Headings

- Use `##` for major sections
- Use `###` for sub-sections and exercises
- **Never use bold text as a heading** — always use a proper `#` heading

```markdown
<!-- WRONG -->
**Exercise — Simple tone**

<!-- RIGHT -->
### Exercise — Simple tone
```

### Horizontal Rules

Separate every major `##` section with a `---` rule. This aids scannability.

### Callouts

Use blockquote callouts for tips, warnings, and try-it links:

```markdown
> ✨ [Try this patch](/?id=abc123) — brief description.

> **Tip**: Use the `logger.js` preset to inspect messages.

> **Note**: Objects like `expr` use hot and cold inlets.

> **Important**: Always connect to `out~` to hear audio.
```

### Code Examples

- Every API function must have a runnable example, not just a signature
- Add inline comments explaining *why*, not just what
- Show realistic values (use `440` not `n`, use `0.3` not `value`)

```javascript
// WRONG — too abstract
setInterval(callback, ms);

// RIGHT — copy-pasteable and clear
setInterval(() => {
  send({ type: "bang" });
}, 500);
```

### Tables

Always include a spaced separator row:

```markdown
| Column A | Column B | Column C |
| --- | --- | --- |
| value | value | value |
```

### Lists

Prefer numbered lists for sequential steps, bullets for unordered options. Keep bullets short — one line each when possible.

### Code Diagrams

Use plain text for signal flow — it's clear and universal:

```text
[osc~ 440] → [gain~ 0.5] → [out~]
```

## Content Principles

### Concept Before API

Always explain the mental model before listing functions:

```markdown
<!-- WRONG — starts with API -->
Use `setPortCount(inletCount, outletCount)` to set inlets.

<!-- RIGHT — concept first -->
Each js object starts with one inlet and one outlet.
Use `setPortCount()` to add more when your logic needs them:
```

### Avoid Duplication

- If a concept is fully covered in another doc, link to it — don't repeat it
- A brief one-example intro + "See [X] for the full API" is the right pattern
- `message-passing.md` owns message concepts; `javascript-runner.md` owns the JS API

### Exercises

Every topic doc should have at least one hands-on exercise. Format:

```markdown
### Exercise — Descriptive name

1. Create a `foo` object (`Enter` → type `foo`)
2. Connect it to a `bar` object
3. Do something — you should see/hear the result
```

### See Also

End every topic doc with a See Also section. Format:

```markdown
## See Also

- [Page Title](/docs/slug) — one-line description of what it covers
- [Object Name](/docs/objects/name) — what the object does
```

## File Locations

- **Topic docs**: `ui/static/content/topics/<slug>.md`
- **Object docs**: `ui/static/content/objects/<name>.md`
- Register new topic docs in `ui/src/routes/docs/docs-nav.ts`
