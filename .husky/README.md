# Git Hooks

This directory contains Git hooks managed by Husky.

## Pre-commit Hook

Automatically runs Prettier on staged files before each commit.

- Only formats files that are staged for commit
- Runs `prettier --write` on: `.js`, `.ts`, `.svelte`, `.json`, `.md`, `.css` files
- Configuration in `ui/package.json` under `"lint-staged"`

## Setup

If the hook isn't working, ensure Git is configured to use this hooks directory:

```bash
git config core.hooksPath .husky
```

This is automatically done by the `prepare` script in `ui/package.json` when you run `bun install`.
