# 91. Sample Search Sidebar Panel

## Summary

A sidebar panel for searching and previewing audio samples from curated online repositories (GitHub-hosted sample packs). Users search across all sources at once, preview samples inline, and drag-drop them onto the canvas as `soundfile~` nodes. Samples are referenced by URL by default, with an option to save locally to VFS.

## Motivation

Finding and importing audio samples currently requires leaving Patchies — downloading files externally, then dragging them in or using the VFS file picker. A built-in sample search panel removes this friction, especially for common creative-coding sample sources like tidal-drum-machines and dough-samples.

## Design Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Repository config | Curated built-in list only | Zero config. User-configurable repos can come later. |
| Freesound support | Not in v1 | Requires API key setup. GitHub repos work with no auth. |
| GitHub discovery | Per-repo adapter | Repos have different structures (JSON index vs directory tree). Custom adapters preserve metadata. |
| Preview playback | Inline play button | Lightweight — temporary `Audio()` element, no VFS involvement. |
| Import target | Always `soundfile~` | Simplest default. Users can drop onto existing `sampler~`/`table` nodes via VFS after saving locally. |
| Caching | URL reference + optional local save | Keeps patches lightweight. User can explicitly save to VFS for offline use. |
| UI model | Search only (no folder browsing) | Simpler UI. Flat results list with search bar. |
| Search scope | All repos at once | Unified results with source badge per row. No repo picker needed. |
| Index loading | Lazy fetch on first search | No upfront cost. Indexes cached in memory for the session. |
| Result metadata | Name, duration, source badge | Minimal clutter. Enough info to pick the right sample. |

## Provider System

### SampleProvider Interface

```typescript
interface SampleResult {
  id: string;               // unique within provider
  name: string;             // display name (e.g. "kick.wav")
  url: string;              // direct URL to the audio file
  duration?: number;        // seconds, if known from index
  format?: string;          // "wav", "mp3", etc.
  provider: string;         // provider id for source badge
  category?: string;        // e.g. "TR-808", "ambient" — from index metadata
}

interface SampleProvider {
  id: string;               // e.g. "tidal-drum-machines"
  name: string;             // display name, e.g. "Tidal Drum Machines"
  icon?: string;            // optional icon identifier

  /** Lazily load the sample index. Called once on first search. */
  loadIndex(): Promise<void>;

  /** Return true if loadIndex() has completed. */
  isLoaded(): boolean;

  /** Search the index. Returns matching results. */
  search(query: string): SampleResult[];
}
```

### Built-in Providers (v1)

#### tidal-drum-machines

- **Source**: `github.com/geikha/tidal-drum-machines`
- **Index strategy**: The repo contains a JSON file listing all drum machines and their samples. The adapter fetches this JSON via raw.githubusercontent.com.
- **Search**: Matches against sample name, machine name, and category (e.g. searching "808 kick" matches TR-808 kick samples).

#### dough-samples

- **Source**: `github.com/felixroos/dough-samples`
- **Index strategy**: Uses GitHub's Tree API (`GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`) to list all audio files. Filters by extension (`.wav`, `.mp3`, `.ogg`, `.flac`).
- **Search**: Matches against the file path segments (folder names act as categories).

### Adding Providers Later

New providers implement `SampleProvider` and are added to a registry array. The interface is designed so Freesound (API-based, async search) or user-configurable GitHub repos can be added without changing the search UI.

For Freesound specifically, `search()` would become async and return a `Promise<SampleResult[]>`, so the interface should account for that from the start:

```typescript
interface SampleProvider {
  // ...
  search(query: string): SampleResult[] | Promise<SampleResult[]>;
}
```

## UI

### Sidebar Registration

- Add `'samples'` to `SidebarView` union in `ui.store.ts`
- Add entry to `baseViews` in `SidebarPanel.svelte` with `AudioLines` icon from lucide
- Create `SampleSearchView.svelte` in `src/lib/components/sidebar/`

### Panel Layout

```
┌─────────────────────────┐
│ 🔍 Search samples...    │  ← search input, auto-focus
├─────────────────────────┤
│ Loading indexes...      │  ← shown on first search while fetching
├─────────────────────────┤
│ ▶ kick-808.wav    0.4s  │  ← play btn, name, duration
│   tidal-drum-machines   │  ← source badge (muted text)
│ ▶ kick-soft.wav   0.3s  │
│   dough-samples         │
│ ▶ kick-vinyl.wav  0.5s  │
│   tidal-drum-machines   │
│         ...             │
├─────────────────────────┤
│ 42 results              │  ← result count footer
└─────────────────────────┘
```

### Result Row

Each result row contains:

- **Play/stop button** — small toggle button (play triangle / stop square icon). Clicking plays the sample via a temporary `Audio()` element. Only one sample plays at a time (clicking play on another stops the current).
- **Sample name** — the filename, truncated with ellipsis if too long.
- **Duration badge** — right-aligned, `text-xs text-zinc-500`, formatted as seconds (e.g. "0.4s", "1.2s"). Shown only if the provider supplies duration.
- **Source badge** — second line, `text-xs text-zinc-600`, the provider display name.

Rows are draggable. The entire row is the drag handle.

### Search Behavior

- Debounced input (300ms) to avoid excessive filtering.
- Search is client-side against the in-memory index (all providers loaded).
- Empty query shows nothing (not all samples — indexes can be large).
- Results are ordered by relevance: exact name match > name starts with query > name contains query. Within each tier, results are grouped by provider.
- Cap results at a reasonable limit (e.g. 100) to keep the list performant.

### Preview Playback

```typescript
// Singleton preview player
let currentAudio: HTMLAudioElement | null = null;
let currentId: string | null = null;

function togglePreview(result: SampleResult) {
  if (currentId === result.id) {
    currentAudio?.pause();
    currentAudio = null;
    currentId = null;
    return;
  }
  currentAudio?.pause();
  currentAudio = new Audio(result.url);
  currentAudio.play();
  currentId = result.id;
  currentAudio.onended = () => { currentId = null; };
}
```

The playing state is tracked reactively so the play button icon updates (play vs stop).

## Drag-Drop & Import

### Drag from Sidebar

When a result row is dragged:

```typescript
function handleDragStart(event: DragEvent, result: SampleResult) {
  // Use the existing VFS/URL pattern that CanvasDragDropManager understands
  event.dataTransfer?.setData('application/x-sample-url', JSON.stringify({
    url: result.url,
    name: result.name,
  }));
  event.dataTransfer?.setData('text/plain', result.url);
  event.dataTransfer!.effectAllowed = 'copy';
}
```

### Canvas Drop Handling

Add a new check in `CanvasDragDropManager.onDrop()` for `application/x-sample-url`:

```typescript
const sampleData = event.dataTransfer?.getData('application/x-sample-url');
if (sampleData) {
  const { url, name } = JSON.parse(sampleData);
  const nodeData = {
    ...getDefaultNodeData('soundfile~'),
    _initialUrl: url,
    fileName: name,
  };
  createNode('soundfile~', position, nodeData);
  return;
}
```

This leverages `soundfile~`'s existing `_initialUrl` support — on node creation, it loads the URL directly into the audio element.

### Drop onto Existing Nodes

Dropping a sample onto an existing `soundfile~` node should load the URL into that node. This is handled by checking if the drop target is an existing node before creating a new one (same pattern as VFS file drops on existing nodes).

### Mobile Insert

For touch devices, add a tap action on result rows that dispatches an event via `PatchiesEventBus`:

```typescript
// New event type
insertSampleToCanvas: { url: string; name: string }
```

`FlowCanvasInner` listens for this event and calls `getDragDropManager()` to create a `soundfile~` at viewport center, matching the existing mobile insert pattern.

## Save to VFS (Optional Local Cache)

Each result row has a secondary action (e.g. a small download/save icon, or via right-click context menu) that:

1. Fetches the audio file from the URL
2. Stores it in VFS via `vfs.storeFile(file)` under `user://samples/{name}`
3. Shows a brief confirmation (toast or icon change)

Once saved to VFS, the sample appears in the Files sidebar panel and can be used offline. If the user drags a VFS-saved sample onto the canvas, it uses `vfsPath` instead of `_initialUrl`.

This is a "nice to have" for v1 — the core flow works without it since `soundfile~` handles URLs directly.

## State Management

### SampleSearchStore

```typescript
// src/lib/sample-search/sample-search-store.svelte.ts

class SampleSearchStore {
  query = $state('');
  results = $state<SampleResult[]>([]);
  isLoading = $state(false);
  playingId = $state<string | null>(null);
  indexesLoaded = $state(false);

  private providers: SampleProvider[] = [
    new TidalDrumMachinesProvider(),
    new DoughSamplesProvider(),
  ];

  async search(query: string): Promise<void> {
    if (!this.indexesLoaded) {
      this.isLoading = true;
      await Promise.all(this.providers.map(p => p.loadIndex()));
      this.indexesLoaded = true;
    }
    this.isLoading = false;

    const allResults = this.providers.flatMap(p => p.search(query));
    this.results = rankAndCap(allResults, query, 100);
  }
}

export const sampleSearchStore = new SampleSearchStore();
```

## Implementation Plan

### Phase 1: Provider System

1. Define `SampleProvider` and `SampleResult` types in `src/lib/sample-search/types.ts`
2. Implement `TidalDrumMachinesProvider` — fetch JSON index, implement search
3. Implement `DoughSamplesProvider` — fetch GitHub tree API, filter audio files, implement search

### Phase 2: Sidebar Panel

4. Add `'samples'` to `SidebarView` in `ui.store.ts`
5. Create `SampleSearchView.svelte` with search input, results list, and preview playback
6. Register panel in `SidebarPanel.svelte` with `AudioLines` icon

### Phase 3: Drag-Drop Integration

7. Add drag handlers to result rows in `SampleSearchView.svelte`
8. Add `application/x-sample-url` handling in `CanvasDragDropManager.onDrop()`
9. Add mobile insert support via `PatchiesEventBus`

### Phase 4: Polish

10. Add "Save to VFS" action on result rows
11. Handle drop onto existing `soundfile~` nodes
12. Error handling — network failures, CORS issues, invalid audio files
13. Loading states and empty states

## File Locations

| File | Purpose |
| --- | --- |
| `src/lib/sample-search/types.ts` | `SampleProvider`, `SampleResult` interfaces |
| `src/lib/sample-search/providers/tidal-drum-machines.ts` | Tidal drum machines adapter |
| `src/lib/sample-search/providers/dough-samples.ts` | Dough samples adapter |
| `src/lib/sample-search/providers/index.ts` | Provider registry |
| `src/lib/sample-search/sample-search-store.svelte.ts` | Reactive search state |
| `src/lib/components/sidebar/SampleSearchView.svelte` | Sidebar panel component |

## Edge Cases

- **CORS**: GitHub raw.githubusercontent.com URLs should work for both fetching indexes and playing audio via `Audio()`. If a provider's audio URLs have CORS issues, the preview will fail silently (no crash — the `Audio` element handles this gracefully).
- **Large indexes**: tidal-drum-machines may have thousands of entries. Client-side search with a 100-result cap keeps the UI responsive. If needed, a simple substring index can be built at load time.
- **Network offline**: If indexes fail to load, show an error state in the panel ("Could not load sample indexes. Check your connection."). Previously loaded indexes remain cached in memory.
- **Duplicate names**: Results from different providers may have the same filename. The source badge disambiguates them visually, and `SampleResult.id` includes the provider prefix.

## Future Extensions

- **Freesound provider**: API-based search with OAuth. Requires API key settings UI (could use the dynamic settings API from spec 90).
- **User-configurable repos**: Settings panel to add custom GitHub repos with configurable index strategy.
- **Browse mode**: Optional tree view for navigating repo folder structure alongside search.
- **Richer metadata**: Tags, waveform thumbnails, sample rate, channel count.
- **Batch import**: Select multiple results and import them all at once.
- **Import as sampler~/table**: Context menu or modifier key to choose import target node type.
