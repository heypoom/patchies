# 137. Search Index Performance

**Status**: In Progress

## Progress

- Done: preset sidebar search now uses `flattenedPresets`, precomputed
  `PresetSearchRecord`s, and a 100-result cap.
- Done: large readonly built-in preset folders no longer mount disabled context-menu machinery for
  every row in `PresetTreeView.svelte`. This fixed the Greggman archive crash when expanding the
  built-in preset library.
- Done: ObjectNode autocomplete indexing now uses a shared store/module and caps ObjectNode
  suggestions at 100 results by default.
- Next: adapt Object Browser search to reuse the shared object/preset search layer.

## Problem

Preset and object search are getting sluggish as the built-in preset catalog grows.

The same preset/object data is currently searched or indexed in multiple UI surfaces:

- Preset sidebar search (`Search presets...`)
- ObjectNode autocomplete / Quick Insert
- Object Browser modal

The current approach is still simple enough to understand, but it does too much repeated work:

- The preset sidebar previously recursively walked nested preset folders on every search keystroke.
- ObjectNode builds searchable object/preset items and a Fuse index per ObjectNode instance.
- Object Browser builds its own preset categories and Fuse index separately.
- Search results are not consistently capped before rendering.

This is especially noticeable when users enable large preset packs such as Hydra demos or generated
archives.

## Goals

- Keep typing in preset and object search responsive with large preset libraries.
- Reuse one shared searchable representation across search surfaces.
- Preserve existing ranking behavior: objects before presets, prefix matches first, common objects
  boosted.
- Keep fuzzy search available without making every keystroke expensive.
- Make performance measurable before and after the change.

## Non-goals

- Replace Fuse everywhere.
- Change which presets or objects are visible.
- Change preset pack behavior or extension enablement rules.
- Add server-side search.
- Add search worker infrastructure unless main-thread indexing remains a proven bottleneck.

## Current Hotspots

### Preset Sidebar

Done. `PresetTreeView.svelte` used to search by recursively walking every library and folder:

```ts
for (const library of $presetLibraryStore) {
  collectPresets(library.id, library, library.presets, []);
}
```

That traversal has been replaced with the `flattenedPresets` derived store plus precomputed
`PresetSearchRecord`s in `preset-utils.ts`. Sidebar search now scans pre-normalized fields and caps
flat search results at 100.

The Greggman bytebeat archive also exposed a related rendering bottleneck: expanding a large readonly
built-in folder mounted disabled `ContextMenu.Root` / `ContextMenu.Trigger` instances for every
preset row. Readonly rows now render without context-menu wrappers; editable user-library rows keep
the context menu.

### ObjectNode Autocomplete

Done.

`ObjectNode.svelte` used to derive these global autocomplete structures in every node instance:

- `presetLookup`
- `allSearchableItems`
- `allItemsFuse`

That work now lives in `objectPresetSearchIndex`, backed by the pure
`object-preset-search.ts` helper. ObjectNode keeps node-local edit state and calls shared helpers for
default suggestions, fuzzy suggestions, and preset lookup. Default and fuzzy suggestions are capped
at 100 results.

### Object Browser

Still open.

`ObjectBrowserModal.svelte` builds preset categories, flattens categories into Fuse items, and
creates another Fuse index. This is less frequent than ObjectNode autocomplete, but it still repeats
logic that should be shared.

## Core Concept

Build a shared **search index layer** for objects and presets.

Search surfaces should render UI and call small query functions. They should not independently walk
preset trees, normalize strings, build Fuse indexes, or re-implement visibility rules.

```text
presetLibraryStore + extension stores + object metadata
  -> shared normalized search records
  -> shared indexes / query helpers
  -> PresetTreeView, ObjectNode, ObjectBrowserModal
```

## Data Model

### Preset Search Record

```ts
interface PresetSearchRecord {
  kind: "preset";
  name: string;
  nameLower: string;
  description: string;
  descriptionLower: string;
  type: string;
  libraryId: string;
  libraryName: string;
  readonly: boolean;
  path: PresetPath;
  location: string;
  locationLower: string;
  preset: Preset;
}
```

### Object Search Record

```ts
interface ObjectSearchRecord {
  kind: "object";
  name: string;
  nameLower: string;
  description: string;
  descriptionLower: string;
  priority: "normal" | "low";
  objectPriority: number;
}
```

### Combined Search Record

```ts
type SearchRecord = PresetSearchRecord | ObjectSearchRecord;
```

The important performance detail is that lowercased searchable strings are precomputed once when the
underlying data changes, not on every query.

## Shared Query APIs

Create a small search module or Svelte store, for example:

```text
ui/src/lib/search/object-preset-search.ts
```

or:

```text
ui/src/stores/object-preset-search.store.ts
```

Suggested API:

```ts
interface SearchOptions {
  limit?: number;
  includePresets?: boolean;
  includeObjects?: boolean;
  fuzzy?: boolean;
}

function searchPresets(
  query: string,
  options?: SearchOptions,
): PresetSearchRecord[];

function searchObjectSuggestions(
  query: string,
  options?: SearchOptions,
): SearchRecord[];

function getDefaultObjectSuggestions(options?: SearchOptions): SearchRecord[];

function getPresetByName(name: string): PresetSearchRecord | undefined;
```

## Search Strategy

Use a tiered search path:

1. Empty query: return pre-sorted defaults with a small limit.
2. Prefix query: scan pre-normalized `nameLower.startsWith(queryLower)`.
3. Substring query: scan pre-normalized `nameLower.includes(queryLower)` and optional
   `descriptionLower.includes(queryLower)`.
4. Fuzzy query: use Fuse only when needed.

Fuse remains useful for typo-tolerant search, but prefix and substring search should handle the
common case faster and with more predictable ranking.

## Ranking Rules

Keep existing user-facing ranking:

1. Enabled / normal priority entries before low-priority entries.
2. Prefix matches before substring/fuzzy matches.
3. Objects before presets in ObjectNode autocomplete.
4. Common objects boosted by `getObjectPriority()`.
5. Boosted presets from `BOOSTED_PRESETS` before other similarly scored presets.
6. User libraries before readonly built-in libraries in preset sidebar search.
7. Stable alphabetical fallback.

## Result Limits

All search surfaces should cap results before rendering:

| Surface                 | Suggested Limit | Reason                                                |
| ----------------------- | --------------- | ----------------------------------------------------- |
| ObjectNode autocomplete | 100             | Enough room for discovery while preventing DOM churn  |
| Object Browser search   | 100             | Modal has more room but should remain responsive      |
| Preset sidebar search   | 100             | Prevent huge flat result lists from causing DOM churn |

Fuse supports a search limit via `fuse.search(query, { limit })`; use it when fuzzy search runs.

## Implementation Plan

### Phase 1: Measure

Partially done through manual debugging around the Greggman archive. Add scoped timing before larger
search refactors when useful.

Add temporary debug timing around current search paths:

- Preset sidebar search calculation
- ObjectNode searchable item derivation
- ObjectNode Fuse index creation
- ObjectNode query execution
- Object Browser Fuse index creation
- Object Browser query execution

Use `performance.now()` or `console.time()` behind a local debug flag. Capture rough timings with a
large preset pack enabled.

### Phase 2: Optimize Preset Sidebar

Complete.

Replace recursive per-query traversal with the existing `flattenedPresets` derived store.

Add a derived `presetSearchRecords` list that precomputes:

- lowercase name
- lowercase description
- formatted location
- readonly/library metadata

Search `presetSearchRecords` directly and cap results before rendering.

This was the smallest high-confidence improvement and has landed.

Additional fix from this phase: do not mount disabled context-menu wrappers for readonly preset tree
rows. This prevents large generated preset folders from creating hundreds of unnecessary Svelte/Bits
UI effects when expanded.

### Phase 3: Share ObjectNode Search Index

Complete.

ObjectNode's global autocomplete data has moved out of each node instance.

The shared index should derive from:

- object definitions
- visual node names
- object shorthands
- `flattenedPresets`
- enabled object/preset stores
- patch object types
- AI feature visibility

ObjectNode keeps node-local state (`expr`, `isEditing`) but calls shared query helpers for
suggestions and preset lookup.

Implemented first API:

```ts
export const objectPresetSearchIndex = derived(
  [
    flattenedPresets,
    enabledObjects,
    enabledPresets,
    patchObjectTypes,
    isAiFeaturesVisible
  ],
  (...) => ({
    presetLookup,
    fuse,
    getDefaultObjectSuggestions({ limit: 100 }),
    searchObjectSuggestions(query, { limit: 100 }),
    getPresetByName(name)
  })
);
```

This first pass preserves the current Fuse-based ranking while deduplicating index creation and
adding limits. Tiered prefix/substring/fuzzy search can follow if profiling still shows query cost.

### Phase 4: Reuse In Object Browser

Open.

Adapt Object Browser to consume the same shared records.

Object Browser can still group results into categories for display, but filtering and ranking should
come from shared search helpers instead of a modal-local index.

### Phase 5: Optional Fuse Index Improvements

Open.

If profiling still shows Fuse index creation as expensive:

- Use `Fuse.createIndex()` when building the shared index.
- Reuse the parsed/prebuilt index until the underlying records change.
- Consider separate indexes for object-only and preset-only searches.

Do not add a search worker unless profiling shows main-thread indexing remains a real problem after
deduplication and result limits.

## Validation

Manual checks:

1. Enable large preset packs.
2. Type in `Search presets...` and verify keystrokes stay responsive.
3. Expand `Built-in` in the preset sidebar with the Greggman archive present and verify there is no
   Svelte update-depth crash.
4. Type object names and preset names into ObjectNode autocomplete.
5. Verify disabled objects are still suggested only when no enabled result matches.
6. Verify built-in presets still respect enabled preset packs.
7. Verify user presets still appear and take precedence where duplicate names exist.
8. Verify Object Browser search still finds objects by name, description, and category.

Automated checks:

- Unit test preset sidebar search records and 100-result limiting.
- Unit test ObjectNode shared search 100-result limiting.
- Unit test ranking helpers with prefix, substring, fuzzy, boosted preset, and low-priority cases.
- Unit test preset visibility for enabled/disabled object and preset packs.
- Unit test duplicate preset names so user libraries retain precedence.

## Success Criteria

- Done: preset sidebar search no longer walks nested preset folders per keystroke.
- Done: large readonly preset folders can be expanded without mounting per-row context menus.
- Done: ObjectNode no longer creates a Fuse index per node instance.
- Done: search result rendering is capped in ObjectNode.
- Open: Object Browser search reuses the shared search layer and caps rendering.
- Existing search behavior is preserved or intentionally documented where changed.
- Measured search/index timings improve with large preset packs enabled.
