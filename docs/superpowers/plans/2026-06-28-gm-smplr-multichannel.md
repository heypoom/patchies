# GM Smplr Multichannel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `gm~`, a multi-channel sampled MIDI renderer for `midi.file` and other channel-aware MIDI message sources.

**Architecture:** `gm~` is a dedicated Audio V2 node and Svelte wrapper, separate from descriptor-driven single-instrument smplr nodes. It keeps per-channel program state, lazy-loads one smplr instrument per active channel/program, and routes note/CC/stop messages by 1-based MIDI channel.

**Tech Stack:** SvelteKit + Svelte 5, TypeScript, Audio V2, smplr `Soundfont`/`Soundfont2`, `soundfont2`, Vitest.

---

## Task 1: Channel Routing Helpers

**Files:**
- Create: `ui/src/objects/smplr/gm-channel-state.ts`
- Create: `ui/src/objects/smplr/gm-channel-state.test.ts`

- [ ] **Step 1: Write failing tests**

Run: `cd ui && bun run test:unit src/objects/smplr/gm-channel-state.test.ts`

Expected: FAIL because `gm-channel-state.ts` does not exist.

- [ ] **Step 2: Implement helpers**

Create helpers that normalize channels to `1..16`, store per-channel program
numbers, map built-in soundfont programs through `getGeneralMidiProgramName`,
and map SF2 programs through ordered instrument names.

- [ ] **Step 3: Verify green**

Run: `cd ui && bun run test:unit src/objects/smplr/gm-channel-state.test.ts`

Expected: PASS.

## Task 2: GM Audio Runtime

**Files:**
- Create: `ui/src/objects/smplr/GmAudioNode.ts`
- Create: `ui/src/objects/smplr/GmAudioNode.test.ts`
- Modify: `ui/src/objects/smplr/audio-nodes.ts`

- [ ] **Step 1: Write failing runtime tests**

Run: `cd ui && bun run test:unit src/objects/smplr/GmAudioNode.test.ts`

Expected: FAIL because `GmAudioNode` does not exist.

- [ ] **Step 2: Implement runtime**

Implement an Audio V2 node with:
- static type `gm~`;
- one message inlet and one audio outlet;
- lazy `import("smplr")`;
- settings source `soundfont` or `soundfont2`;
- per-channel program cache;
- queued note/CC commands while channel instruments load;
- disposal of all loaded channel instruments on destroy or source reload.

- [ ] **Step 3: Verify green**

Run: `cd ui && bun run test:unit src/objects/smplr/GmAudioNode.test.ts src/objects/smplr/gm-channel-state.test.ts`

Expected: PASS.

## Task 3: Svelte Node And Registration

**Files:**
- Create: `ui/src/objects/smplr/GmNode.svelte`
- Modify: `ui/src/lib/nodes/node-types.ts`
- Modify: `ui/src/lib/nodes/defaultNodeData.ts`
- Modify: `ui/src/lib/extensions/object-packs.ts`
- Modify: `ui/src/lib/objects/schemas/index.ts`
- Modify: `ui/src/objects/smplr/schema.ts`

- [ ] **Step 1: Add component and registrations**

Reuse the shared smplr layout pattern where practical, but use GM-specific
settings/status if needed.

- [ ] **Step 2: Regenerate schemas**

Run: `cd ui && bun run generate:schemas`

Expected: generated schema includes `gm~`.

## Task 4: Docs And AI Metadata

**Files:**
- Create: `ui/static/content/objects/gm~.md`
- Modify: `ui/src/objects/smplr/prompt.ts`
- Modify: `ui/src/lib/ai/object-prompts/index.ts`
- Modify: `ui/src/lib/ai/object-descriptions-types.ts`

- [ ] **Step 1: Document the object**

Document that `gm~` is the recommended target for multi-channel `midi.file`
patches, while `soundfont~` remains a single-instrument object.

- [ ] **Step 2: Update AI metadata**

Add `gm~` to object lists and map it to the smplr prompt.

## Task 5: Final Verification

- [ ] **Step 1: Run focused tests**

Run: `cd ui && bun run test:unit src/objects/smplr`

Expected: PASS.

- [ ] **Step 2: Run type check**

Run: `cd ui && bun run check`

Expected: Existing unrelated CodeEditor/ObjectPreview handler errors may remain; no `gm~` or smplr diagnostics.

- [ ] **Step 3: Check formatting whitespace**

Run: `git diff --check`

Expected: PASS.
