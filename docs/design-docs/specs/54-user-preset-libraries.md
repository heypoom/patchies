# 54. User Preset Libraries

I'm looking to build a "user presets library" / "user snippets library" type of thing, where users can make their own node presets.

## Requirements

- One user can have multiple preset libraries loaded.

  - Presets are _always_ namespaced by preset library.
  - A preset library can contain multiple preset objects.
  - By default, there is a _user_ preset library.
  - User can create more preset libraries and rename it.

- Preset libraries should have basic metadata that are empty by default.

  - Description
  - Author

- Presets can be _nested in folders_ within preset libraries for easier organization, e.g.

  - `user > visual > "Color Picker"`

- We should migrate the built-in presets system we have in `lib/presets`.

  - There should be a "built-in" preset library by default.
  - The built-in presets would be stored in the same system as any other user presets.
  - To avoid too much code change, there should be an API that simply loads our existing `lib/presets` format with `Record<ObjectName, {type, data}>` into the new preset system.
  - These built-in presets should be "restorable" back to a pristine state.
  - We should remove/replace the old presets system.

- You can save any object as a new preset.

  - select an object
  - `Ctrl/Cmd+K` > `Save Selected Object as Preset`
    - highlights the item to save on the sidebar
  - or `Sidebar` > `Save Selected Object as Preset`

- Object snippets library are independent of the patch. You can take your presets to any patches you visit.

- You should be able to import/export preset libraries as JSON.
  - In the future, you should be able to share links to your preset libraries, just like how you can share links to patches.

## Format of presets

See `lib/presets` for inspiration. Each preset should have:

```ts
interface Preset {
  // A name, e.g. `Color Picker`
  name: string;

  // A brief description what that preset does.
  description?: string;

  // The object type, e.g. "glsl"
  type: string;

  // The data of the object.
  data: unknown;
}
```

## Where presets are shown

Presets are displayed in 3 places:

- In the "Enter" quick insert menu.
  - This lets them quickly insert presets by name.
- In the object browser, where the old presets used to be.
  - This is read-only but let them browse the presets they have.
- In the sidebar, where they can manage libraries and presets.

## Presets sidebar

- Presets are shown in a "file tree" type of view, with libraries as namespaces.
- The sidebar should now have clear icon buttons on the top for switching between "files" and "presets".
- It should look similar to `FileTreeView.svelte`
- The sidebar will no longer be for just files, its also for presets.
- The user should be able to _drag out presets_ onto the canvas. This inserts the object.

## Populating text object default parameters

When inserting `object` nodes (text objects), make sure to always populate the default parameters. Inserting `osc~` must populate `osc~ 440 sine 0` in its expression.

## Refactoring

We should have shared utilities for presets, considering it can be displayed in 3 places.

---

## Technical Decisions

1. **Built-in library is read-only** - users cannot edit built-in presets directly. They can duplicate to their own library if they want to modify.

2. **Sidebar view switcher** - icon toggle buttons (like Cursor's UI) for compact switching between files/presets views. Allows adding more views later.

3. **Import/Export format** - JSON with structure:

   ```ts
   interface PresetLibraryExport {
     name: string;
     description?: string;
     author?: string;
     presets: PresetFolder;
   }

   // Nested folder structure
   type PresetFolder = {
     [key: string]: Preset | PresetFolder;
   };
   ```

## Data Model

```ts
// A single preset
interface Preset {
  name: string;
  description?: string;
  type: string; // node type, e.g. "glsl", "canvas.dom"
  data: unknown; // node data
}

// A folder can contain presets or nested folders
type PresetFolderEntry = Preset | PresetFolder;
interface PresetFolder {
  [key: string]: PresetFolderEntry;
}

// A library is the top-level container
interface PresetLibrary {
  id: string; // unique identifier
  name: string; // display name
  description?: string;
  author?: string;
  readonly: boolean; // true for built-in
  presets: PresetFolder;
}

// Type guard to distinguish presets from folders
function isPreset(entry: PresetFolderEntry): entry is Preset {
  return "type" in entry && "data" in entry;
}
```

## Implementation Plan

### Phase 1: Core Data Layer

**1.1 Create preset types** (`src/lib/presets/types.ts`)

- Define `Preset`, `PresetFolder`, `PresetLibrary` interfaces
- Add `isPreset()` type guard
- Add `PresetPath` type for addressing presets (e.g., `["built-in", "visual", "Color Picker"]`)

**1.2 Create preset store** (`src/stores/preset-library.store.ts`)

- Svelte store holding `PresetLibrary[]`
- Persist to localStorage (key: `patchies:preset-libraries`)
- Actions: `addLibrary`, `removeLibrary`, `renameLibrary`
- Actions: `addPreset`, `removePreset`, `movePreset`
- Actions: `createFolder`, `removeFolder`, `renameFolder`
- Getter: `getPresetByPath(path: PresetPath)`
- Getter: `getAllPresets()` - flattened list for search

**1.3 Migration utility** (`src/lib/presets/migrate-legacy.ts`)

- Function: `migrateLegacyPresets(legacy: Record<string, {type, data}>): PresetFolder`
- Converts flat `PRESETS` object to nested folder structure
- Groups by type (e.g., all GLSL presets under "glsl" folder)
- Called on first load to populate "built-in" library

**1.4 Built-in library initialization**

- On store init, check if "built-in" library exists
- If not, create it from legacy presets via migration
- Mark as `readonly: true`

### Phase 2: Sidebar UI

**2.1 Sidebar view switcher** (`src/lib/components/sidebar/SidebarPanel.svelte`)

- Add icon buttons row at top: Files (folder icon), Presets (puzzle/box icon)
- Track `activeView: 'files' | 'presets'` state
- Conditionally render `FileTreeView` or `PresetTreeView`

**2.2 Create PresetTreeView** (`src/lib/components/sidebar/PresetTreeView.svelte`)

- Similar structure to `FileTreeView`
- Tree hierarchy: Library > Folders > Presets
- Libraries are collapsible root nodes
- Show preset name + type icon
- Support folder creation/rename/delete (for non-readonly libraries)

**2.3 Library management UI**

- "+" button to create new library
- Right-click library > Rename, Delete, Export
- Right-click folder > New Folder, Rename, Delete
- Right-click preset > Rename, Delete, Duplicate to...

**2.4 Drag-out to canvas**

- Make presets draggable with `application/x-preset` MIME type
- Update `CanvasDragDropManager` to handle preset drops
- On drop: create node with preset's type and data

### Phase 3: Save Preset Flow

**3.1 Command palette integration** (`src/lib/components/CommandPalette.svelte`)

- Add "Save Selected Object as Preset" command
- Only enabled when a node is selected
- Triggers preset save dialog

**3.2 Preset save dialog** (`src/lib/components/presets/SavePresetDialog.svelte`)

- Modal with:
  - Name input (default: node's display name or type)
  - Description input (optional)
  - Library picker (dropdown, excludes readonly)
  - Folder picker (tree selector within library)
- On save: add to store, show in sidebar, optionally highlight

**3.3 Node context menu**

- Add "Save as Preset..." option to node right-click menu

### Phase 4: Integration Points

**4.1 Update Object Browser** (`src/lib/components/object-browser/`)

- Replace static `PRESETS` import with store subscription
- Group by library > folder path
- Keep search functionality working

**4.2 Update quick insert / ObjectNode suggestions**

- Subscribe to preset store for suggestions
- Include library prefix in display (e.g., "built-in > visual > Color Picker")

**4.3 Import/Export**

- Export: serialize library to JSON, trigger download
- Import: parse JSON, validate structure, add as new library
- Handle name conflicts (prompt to rename or overwrite)

### Phase 5: Cleanup

**5.1 Remove legacy preset system**

- Delete `src/lib/presets/*.ts` files (after migration verified)
- Update all imports to use new store
- Remove legacy preset display code from ObjectBrowser

---

## File Structure (New Files)

```txt
src/
├── lib/
│   ├── presets/
│   │   ├── types.ts              # Interfaces
│   │   ├── migrate-legacy.ts     # Migration utility
│   │   └── preset-utils.ts       # Shared helpers (isPreset, getByPath, flatten)
│   └── components/
│       ├── sidebar/
│       │   ├── SidebarPanel.svelte      # Updated with view switcher
│       │   └── PresetTreeView.svelte    # New tree view
│       └── presets/
│           └── SavePresetDialog.svelte  # Save dialog
└── stores/
    └── preset-library.store.ts   # Main store
└── builtin/                      # Built-in preset library current in `lib/presets`
```
