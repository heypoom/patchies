# OpenRouter reasoning streams

## Objective

Display streamed reasoning as continuous text, retain provider reasoning for tool continuations, and reject failed streams before applying generated results.

## Key Challenges & Solutions

- Stream boundaries differ from thought boundaries. Providers emit a generation event; AI Edit and the preview dialogs accumulate deltas into one block per generation.
- Reasoning can be plaintext, readable structured blocks, or encrypted blocks. Display uses one readable representation per chunk; opaque replay state retains block order, signatures, and encrypted data.
- HTTP 200 does not mean a generation succeeded. Both OpenRouter methods use a shared SSE reader that propagates API errors and callback failures, handles byte fragmentation, and stops at DONE.

## What Could Be Better

The Svelte autofixer needs access to svelte.dev and could not run in the restricted environment. Local typechecking and focused controller/provider tests cover the changed behavior, but a live Grok session would provide an additional UI check.

## Action Items

- Verify the reasoning display with a live OpenRouter model after the changes are loaded.
