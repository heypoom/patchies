# P5 compatibility TypeScript migration

## Objective

Move the preload, shapes, and data addons from static scripts into app-bundled TypeScript modules.

## Key Challenges & Solutions

- The installed p5 typings describe v1. Define the v2 APIs used by each addon locally and keep the constructor assertion at registration.
- Register addons synchronously after importing p5 and before constructing sketches. The existing once-only flag now protects registration without an asynchronous script-loading gap.
- Import the shape addon directly in its regression tests. Cover array copying, dictionaries, touch movement, preload placeholders, and lifecycle callbacks through addon behavior.

## What Could Be Better

The preload addon retains its existing global preload hook and shared promise collection. This migration does not redesign sketch lifecycle ownership.

## Action Items

- Replace the local v2 API contracts when the project adopts p5 v2 typings.
