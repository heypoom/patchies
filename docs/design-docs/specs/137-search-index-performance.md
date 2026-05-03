# 137. Search Index Performance

**Status**: Draft

## Problem

Preset and object search are getting sluggish as the built-in preset catalog grows.

The same preset/object data is currently searched or indexed in multiple UI surfaces:

- Preset sidebar search (`Search presets...`)
- ObjectNode autocomplete / Quick Insert
- Object Browser modal

The current approach is still simple enough to understand, but it does too much repeated work:

- The preset sidebar recursively walks nested preset folders on every search keystroke.
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

`PresetTreeView.svelte` searches by recursively walking every library and folder:

```ts
for (const library of $presetLibraryStore) {
  collectPresets(library.id, library, library.presets, []);
}
```

This runs inside a reactive search result calculation, so each keystroke traverses the nested preset
tree again.

### ObjectNode Autocomplete

Each `ObjectNode.svelte` instance derives:

- `presetLookup`
- `allSearchableItems`
- `allItemsFuse`

This duplicates the same object/preset index work for every ObjectNode in the patch. Large patches
with many ObjectNodes pay the indexing cost many times even though autocomplete data is global for
the current extension state.

### Object Browser

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
| ObjectNode autocomplete | 50              | Dropdown should stay small and fast                   |
| Object Browser search   | 100             | Modal has more room but should remain responsive      |
| Preset sidebar search   | 100             | Prevent huge flat result lists from causing DOM churn |

Fuse supports a search limit via `fuse.search(query, { limit })`; use it when fuzzy search runs.

## Implementation Plan

### Phase 1: Measure

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

Replace recursive per-query traversal with the existing `flattenedPresets` derived store.

Add a derived `presetSearchRecords` list that precomputes:

- lowercase name
- lowercase description
- formatted location
- readonly/library metadata

Search `presetSearchRecords` directly and cap results before rendering.

This is the smallest high-confidence improvement.

### Phase 3: Share ObjectNode Search Index

Move ObjectNode's global autocomplete data out of each node instance.

The shared index should derive from:

- object definitions
- visual node names
- object shorthands
- `flattenedPresets`
- enabled object/preset stores
- patch object types
- AI feature visibility

ObjectNode should keep node-local state (`expr`, `isEditing`) but call shared query helpers for
suggestions.

### Phase 4: Reuse In Object Browser

Adapt Object Browser to consume the same shared records.

Object Browser can still group results into categories for display, but filtering and ranking should
come from shared search helpers instead of a modal-local index.

### Phase 5: Optional Fuse Index Improvements

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
3. Type object names and preset names into ObjectNode autocomplete.
4. Verify disabled objects are still suggested only when no enabled result matches.
5. Verify built-in presets still respect enabled preset packs.
6. Verify user presets still appear and take precedence where duplicate names exist.
7. Verify Object Browser search still finds objects by name, description, and category.

Automated checks:

- Unit test ranking helpers with prefix, substring, fuzzy, boosted preset, and low-priority cases.
- Unit test preset visibility for enabled/disabled object and preset packs.
- Unit test duplicate preset names so user libraries retain precedence.

## Success Criteria

- Preset sidebar search no longer walks nested preset folders per keystroke.
- ObjectNode no longer creates a Fuse index per node instance.
- Search result rendering is capped in all three surfaces.
- Existing search behavior is preserved or intentionally documented where changed.
- Measured search/index timings improve with large preset packs enabled.
