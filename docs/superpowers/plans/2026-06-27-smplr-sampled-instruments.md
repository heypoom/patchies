# Smplr Sampled Instruments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lazy-loaded smplr sampled-instrument objects that consume Patchies MIDI and sampler-like trigger messages.

**Architecture:** Implement one shared `src/objects/smplr/` module with descriptor-driven instrument wrappers. Each visible node renders the same `SmplrNodeLayout` with a descriptor, while one shared Audio V2 node handles lazy imports, loading, MIDI routing, scheduled playback, SettingsPanel changes, and cleanup.

**Tech Stack:** Svelte 5, TypeScript, Audio V2, TypeBox schemas, Vitest, Bun, `smplr`, lazy `soundfont2`.

---

### Task 1: Dependencies And Spec Baseline

**Files:**

- Modify: `ui/package.json`
- Modify: `ui/bun.lock`
- Existing spec: `docs/design-docs/specs/165-smplr-sampled-instruments.md`

- [ ] **Step 1: Add package dependencies**

Run from `ui/`:

```bash
bun add smplr soundfont2
```

Expected: `package.json` and `bun.lock` include `smplr` and `soundfont2`.

- [ ] **Step 2: Verify lockfile install**

Run:

```bash
bun install --frozen-lockfile
```

Expected: install succeeds with no dependency mismatch.

### Task 2: Shared Message Mapping

**Files:**

- Create: `ui/src/objects/smplr/messages.ts`
- Create: `ui/src/objects/smplr/messages.test.ts`

- [ ] **Step 1: Write failing tests**

Test these behaviors:

```ts
describe("smplr message mapping", () => {
  it("maps noteOn to a start event with note velocity time and duration", () => {});
  it("maps velocity zero noteOn to a stop event", () => {});
  it("maps noteOff to a stop event with stopId and time", () => {});
  it("maps bang value to default note velocity and scheduled time", () => {});
  it("maps numbers to default note velocity", () => {});
  it("maps controlChange and set messages to runtime commands", () => {});
});
```

Run:

```bash
bun run test:unit src/objects/smplr/messages.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement message helpers**

Create pure helpers:

- `normalizeSmplrMessage(message, descriptor)`
- `normalizeVelocity(value, fallback)`
- `parseDefaultNote(value)`

Return discriminated commands such as `start`, `stop`, `cc`, `program`, `volume`, `detune`, `reverse`, `stopAll`, `ignored`.

- [ ] **Step 3: Verify tests pass**

Run:

```bash
bun run test:unit src/objects/smplr/messages.test.ts
```

Expected: PASS.

### Task 3: Descriptors And Program Mapping

**Files:**

- Create: `ui/src/objects/smplr/descriptors.ts`
- Create: `ui/src/objects/smplr/programs.ts`
- Create: `ui/src/objects/smplr/descriptors.test.ts`

- [ ] **Step 1: Write failing tests**

Test these behaviors:

```ts
describe("smplr descriptors", () => {
  it("exports descriptors for every v1 object type", () => {});
  it("maps GM program changes for soundfont~", () => {});
  it("maps soundfont2 program changes from parsed instrument names", () => {});
  it("marks heavyweight runtime imports as lazy loader functions", () => {});
});
```

Run:

```bash
bun run test:unit src/objects/smplr/descriptors.test.ts
```

Expected: FAIL because descriptor modules do not exist.

- [ ] **Step 2: Implement descriptors**

Add descriptors for:

- `soundfont~`
- `soundfont2~`
- `piano~`
- `epiano~`
- `drums~`
- `mallet~`
- `mellotron~`
- `versilian~`
- `smolken~`

Each descriptor includes settings defaults, SettingsPanel schema, reload keys, default bang note, and a lazy `loadInstrument` callback.

- [ ] **Step 3: Verify descriptor tests pass**

Run:

```bash
bun run test:unit src/objects/smplr/descriptors.test.ts
```

Expected: PASS.

### Task 4: Shared Audio Runtime

**Files:**

- Create: `ui/src/objects/smplr/SmplrInstrumentAudioNode.ts`
- Create: `ui/src/objects/smplr/SmplrInstrumentAudioNode.test.ts`
- Modify: `ui/src/lib/audio/v2/nodes/index.ts`

- [ ] **Step 1: Write failing tests**

Test with fake descriptors and fake instruments:

```ts
describe("SmplrInstrumentAudioNode", () => {
  it("creates a stable output before the instrument loads", () => {});
  it("forwards normalized start stop cc and live settings to the instrument", () => {});
  it("reloads only for descriptor reload settings", () => {});
  it("ignores stale async loads when a newer load wins", () => {});
  it("disposes the active instrument on destroy", () => {});
});
```

Run:

```bash
bun run test:unit src/objects/smplr/SmplrInstrumentAudioNode.test.ts
```

Expected: FAIL because the runtime does not exist.

- [ ] **Step 2: Implement shared runtime**

Implement an Audio V2 class/factory that:

- creates a `GainNode` output immediately;
- lazy-loads the descriptor instrument;
- sends normalized commands to smplr;
- handles settings updates through `send('settings', settings)`;
- prevents stale load commits with a token;
- calls `dispose()` or `disconnect()` on cleanup.

- [ ] **Step 3: Register runtime classes**

Expose one generated Audio V2 class per descriptor or one reusable class factory in `ui/src/lib/audio/v2/nodes/index.ts`.

- [ ] **Step 4: Verify runtime tests pass**

Run:

```bash
bun run test:unit src/objects/smplr/SmplrInstrumentAudioNode.test.ts
```

Expected: PASS.

### Task 5: Shared Svelte Layout And Node Components

**Files:**

- Create: `ui/src/objects/smplr/SmplrNodeLayout.svelte`
- Create: one tiny Svelte component per descriptor or one exported wrapper file
- Modify: `ui/src/lib/nodes/node-types.ts`
- Modify: `ui/src/lib/nodes/defaultNodeData.ts`

- [ ] **Step 1: Implement shared layout**

Render a compact dark audio node with:

- one message inlet;
- one audio outlet;
- object title;
- selected instrument/status text;
- loading/error status;
- standard SettingsPanel controls.

- [ ] **Step 2: Add tiny wrappers**

Each visible object passes its descriptor to the layout. Avoid object-specific message/audio logic in Svelte wrappers.

- [ ] **Step 3: Register node components and defaults**

Add all v1 object types to `node-types.ts` and default settings in `defaultNodeData.ts`.

- [ ] **Step 4: Run Svelte/type check**

Run:

```bash
bun run check
```

Expected: PASS or only unrelated existing failures.

### Task 6: Schemas, Packs, Docs, And AI Prompts

**Files:**

- Create: `ui/src/objects/smplr/schema.ts`
- Create: `ui/src/objects/smplr/prompt.ts`
- Modify: `ui/src/lib/objects/schemas/index.ts`
- Modify: `ui/src/lib/extensions/object-packs.ts`
- Modify: `ui/src/lib/ai/object-descriptions-types.ts`
- Modify: `ui/src/lib/ai/object-prompts/index.ts`
- Create: `ui/static/content/objects/{soundfont~,soundfont2~,piano~,epiano~,drums~,mallet~,mellotron~,versilian~,smolken~}.md`

- [ ] **Step 1: Add schemas**

Create schemas for the common smplr message contract and one schema per object type.

- [ ] **Step 2: Register object packs**

Add smplr objects to Music, MIDI, or Audio Samples packs according to the spec.

- [ ] **Step 3: Add prompts and descriptions**

Teach AI generation that these are MIDI-consuming sampled instruments.

- [ ] **Step 4: Add object docs**

Document message shapes, settings, and example wiring.

- [ ] **Step 5: Run focused checks**

Run:

```bash
bun run test:unit src/objects/smplr
bun run check
```

Expected: PASS or only unrelated existing failures.

### Task 7: Final Verification

**Files:**

- All touched files

- [ ] **Step 1: Run unit tests for smplr module**

```bash
bun run test:unit src/objects/smplr
```

- [ ] **Step 2: Run type/Svelte check**

```bash
bun run check
```

- [ ] **Step 3: Run package build if check passes**

```bash
bun run build
```

- [ ] **Step 4: Inspect diff**

```bash
git diff --stat
git diff --check
```

Expected: no whitespace errors, no unintended broad changes.
