---
name: patchies-frontend
description: Use when editing Patchies Svelte components, UI state, styling, buttons, persistence, or frontend implementation patterns.
---

# Patchies Frontend

## Code Patterns

- Use TypeScript for all code.
- Use Svelte 5 runes: `$state`, `$props`, `$effect`, `$derived`.
- Use event attributes such as `onclick`, not `on:click`.
- Separate UI from business logic with manager/system objects when behavior is non-trivial.
- Prefer shared named functions when the same logic appears in multiple places, such as a message handler and context menu item.
- Prefer existing files and local patterns over new abstractions.

## `ts-pattern`

Use `ts-pattern` when it improves clarity:

- Exhaustive branching on discriminated unions, enums, or mode/state values.
- Matching data shapes where destructuring in branches is useful.
- Replacing switch statements that duplicate fallthrough/default logic.

Avoid `ts-pattern` when direct control flow is clearer:

- Simple null checks.
- Early returns in effects, event handlers, setup, or cleanup.
- Hot paths such as render loops, audio processing, worker messages, pointer handlers, or animation handlers.
- Sequential guards with side effects.

## Persistence

Never put localStorage keys or persistence logic directly in components.

Create a dedicated store in `src/stores/`; use `preset-library.store.ts` or `help-view.store.ts` as patterns.

## Styling

- Prefer Tailwind utilities for DOM the component owns directly.
- Use small scoped `<style>` blocks when styling generated or third-party DOM, CodeMirror `.cm-*`, canvas/library internals, long descendant selectors, or local library overrides.
- Keep local CSS minimal and scoped. Avoid broad globals and `!important` unless a library override requires it.
- Do not remove focus indicators without replacing them with an accessible visible focus style.
- Use the Zinc dark theme.
- Support a `class` prop for component extension when appropriate.
- Use `@lucide/svelte` for icons.

## Buttons

All buttons must include `cursor-pointer`.
Buttons with a disabled state must include `disabled:cursor-not-allowed`.

Where possible, use shadcn-svelte `Tooltip` and not the native `title` attribute:

```svelte
<Tooltip.Root>
  <Tooltip.Trigger>
    <button class="cursor-pointer disabled:cursor-not-allowed ..." disabled={!canSave} onclick={handleSave}>
      <Save class="h-4 w-4" />
    </button>
  </Tooltip.Trigger>
  
  <Tooltip.Content>
    Save Changes
  </Tooltip.Content>
</Tooltip.Root>
```
