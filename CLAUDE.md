# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Patchies** is a tool for creating and playing with simulations - a visual programming environment where users can create interactive "patches" (node-based programs) for exploration, learning, and artistic expression. The project emphasizes creating embeddable, shareable sandboxes for creative coding and algorithmic art.

## Coding Style Guide

- Use `ts-pattern` always instead of `switch` statements.

## Architecture

### Core Stack

- **SvelteKit 5** with TypeScript for the web application
- **@xyflow/svelte** for the visual node editor interface
- **p5.js** for creative coding and generative art
- **CodeMirror 6** for in-browser code editing
- **Tailwind CSS 4** with Zinc color scheme and dark theme
- **Bun** as package manager (use `bun install`, not `npm install`)

### Key Architectural Patterns

**Visual Programming**: The app centers around a flow-based editor where "patches" (nodes) can be connected to create interactive experiences. Each node type represents different capabilities (p5.js canvas, future node types).

**P5.js Integration**: The `P5Manager` class (`src/lib/p5/P5Manager.ts`) handles p5.js instance lifecycle and provides a curated API to user code using JavaScript's `with` statement for clean syntax.

**Component Separation**: UI components are separated from business logic. For example, `P5CanvasNode.svelte` handles UI while `P5Manager.ts` handles p5.js execution.

**Live Code Execution**: User-written JavaScript code is executed in real-time with proper error handling and context isolation.

## Development Commands

```bash
# Development (use these in the /ui directory)
bun run dev                 # Start development server
bun run build              # Production build
bun run preview            # Preview production build

# Code Quality
bun run format             # Format with Prettier
bun run lint               # Lint and format check
bun run check              # TypeScript and Svelte type check
bun run check:watch        # Continuous type checking

# Testing
bun run test:unit          # Run Vitest unit tests
bun run test:e2e           # Run Playwright E2E tests
bun run test               # Run all tests
```

## Project Structure

```
/ui/src/
├── lib/
│   ├── components/
│   │   ├── CodeEditor.svelte      # CodeMirror 6 integration
│   │   ├── FlowCanvas.svelte      # Main xyflow editor
│   │   ├── nodes/
│   │   │   └── P5CanvasNode.svelte # p5.js canvas node
│   │   └── ui/                    # shadcn-svelte components
│   ├── p5/
│   │   └── P5Manager.ts           # p5.js instance management
│   └── utils.ts
└── routes/                        # SvelteKit file-based routing
```

## Design Principles (from docs/design-docs/)

1. **Friendly UX** - Obvious what to do for first-time users
2. **Creation & Sharing** - Easy to create, remix, and share play spaces
3. **Live Collaboration** - Built for multiplayer experiences
4. **Embeddable** - Fast loading, incrementally loaded widgets
5. **Self-hostable** - Single binary deployment
6. **Flexible** - Support many behavior types
7. **LLM-ready** - Built with AI tool integration in mind

## Key Terminology

- **Players**: Users who interact with sandboxes
- **Playmakers**: Users who create sandboxes
- **Sandboxes**: Interactive play spaces with rules and behaviors
- **Objects**: Visual elements that can be created, updated, and interact
- **Patches**: Node-based programs (the core building blocks)
- **Connectors**: Visual connections between objects for message routing

## Code Editor Integration

The `CodeEditor.svelte` component uses CodeMirror 6 with:

- JavaScript syntax highlighting via `@codemirror/lang-javascript`
- One Dark theme with custom Zinc color overrides
- Real-time code execution for p5.js sketches
- Proper copy-paste handling and multi-line support

## P5.js Integration Notes

- p5.js code execution uses a curated API exposed via `with` statement
- The `P5Manager` class handles instance lifecycle and provides error isolation
- User code has access to common p5.js functions and constants without the full 600+ function API
- Canvas nodes support live code editing with immediate visual feedback

## Styling Standards

- Use Tailwind classes instead of custom CSS where possible
- Follow the Zinc color palette for dark theme consistency
- Components should support the `class` prop for Tailwind class extension
- Icons use either `@iconify/svelte` or `@lucide/svelte`

## Guidelines

- Prefer editing existing files over creating new ones
- Separate business logic into utility classes when complex
- Use TypeScript for all new code
- Follow the pattern of UI components importing and using utility classes
- We use Svelte 5.
  - Only use the Svelte 5's rune syntax (`$state`, `$props`, `$effect`, etc.) and do not use Svelte 4 syntax.
  - Read the `docs/llms/svelte-llms-small.txt` text file for how to use Svelte 5. LLMs often get confused with Svelte 4 syntax, so read this when unsure of the Svelte syntax.
- Before you start to implement, always update the spec file first with the details and the plan
- you must use ts-pattern instead of switch cases always
- write concise yet clear commit messages
- do not start the dev server to test issues
