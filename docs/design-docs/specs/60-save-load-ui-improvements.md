# 60. Save/Load UI Improvements

Improve the ergonomics of saving and loading patches by introducing a dedicated Saves sidebar view and unifying the save/load interactions across different entry points.

## Problem

Currently, save and load operations are hidden behind the Command Palette ("Save Patch", "Load Patch"). While functional, this has limitations:

- **Discoverability**: New users may not know these commands exist
- **Management**: No easy way to browse, rename, delete, or organize saves
- **Consistency**: The command palette has its own multi-stage UI for these operations, separate from other UI patterns

## Solution Overview

1. **Saves Sidebar View**: A dedicated sidebar panel for browsing and managing saved patches
2. **Quick Save Modal**: A lightweight modal for the save action with optional folder selection
3. **Unified Interactions**: All entry points (overflow menu, command palette, keyboard shortcuts) trigger the same UI patterns

## Unified Interaction Model

| Action     | Entry Points                            | Result                           |
| ---------- | --------------------------------------- | -------------------------------- |
| Save Patch | Overflow menu, Command Palette, `Cmd+S` | Quick Save Modal                 |
| Load Patch | Overflow menu, Command Palette, `Cmd+O` | Opens/focuses Saves sidebar view |
| New Patch  | Overflow menu, Command Palette, `Cmd+N` | (existing behavior)              |

The command palette becomes a **launcher** that triggers the same UI as other entry points, rather than having its own implementation.

## 1. Saves Sidebar View

Add a new "Saves" view to the existing sidebar alongside Files, Presets, and Packs.

### UI Structure

```
[Sidebar Header]
  [Files] [Presets] [Packs] [Saves*] [X]

[Saves View Content]
  ┌─────────────────────────────────┐
  │ 🔍 Search saves...              │
  ├─────────────────────────────────┤
  │ 📁 My Projects                  │
  │   └─ 🎵 ambient-drone.json      │
  │   └─ 🎵 live-set-v2.json        │
  │ 📁 Experiments                  │
  │   └─ 🎵 glitch-test.json        │
  │ 🎵 untitled-1.json              │
  │ 🎵 demo-patch.json              │
  └─────────────────────────────────┘

[Action Bar]
  [+ New Folder] [Import] [Export]
```

### Features

#### Browsing

- Tree view of saves organized by folders
- Search/filter saves by name
- Show metadata on hover or in a details pane (last modified, node count)
- Optional: thumbnail preview of patch

#### Management Actions (Context Menu)

- **Load**: Load the selected patch (replaces current)
- **Rename**: Inline rename
- **Duplicate**: Create a copy
- **Move to Folder**: Move to different folder
- **Delete**: Delete with confirmation
- **Export as JSON**: Download as `.json` file
- **Share as URL**: Generate shareable URL (if supported)

#### Folder Organization

- Create, rename, delete folders
- Drag-and-drop saves between folders
- Folders stored as part of the save metadata structure

#### Bulk Operations

- Multi-select with `Cmd+Click` or `Shift+Click`
- Bulk delete, export, move

### Type Updates

```typescript
// ui/src/stores/ui.store.ts
export type SidebarView = "files" | "presets" | "packs" | "saves";
```

### New Component

Create `SavesTreeView.svelte` following the pattern of `FileTreeView.svelte` and `PresetTreeView.svelte`.

## 2. Quick Save Modal

A lightweight modal for saving patches, triggered by "Save Patch" from any entry point.

### Behavior

1. **Named patch (has existing save)**:

   - Save immediately (overwrite existing)
   - Show brief toast: "Saved to [name]"

2. **New/unnamed patch**:
   - Open Quick Save Modal

### Modal UI

```
┌─────────────────────────────────────┐
│ Save Patch                      [X] │
├─────────────────────────────────────┤
│ Name                                │
│ ┌─────────────────────────────────┐ │
│ │ my-awesome-patch                │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Location                            │
│ ┌─────────────────────────────────┐ │
│ │ 📁 My Projects            [▼]  │ │
│ └─────────────────────────────────┘ │
│                                     │
│           [Cancel]  [Save]          │
└─────────────────────────────────────┘
```

### Features

- Auto-focus on name input
- Pre-fill with current patch name if exists
- Location picker using existing `FolderPickerDialog.svelte` pattern
- Default location: root or last-used folder
- `Enter` to save, `Escape` to cancel

### Component

Create `SavePatchModal.svelte` as a lightweight modal component.

## 3. Overflow Menu Updates

Add save/load items to the existing three-dots overflow menu in `BottomToolbar`.

```
┌──────────────────┐
│ New Patch        │
│ ──────────────── │
│ Save Patch       │  ← NEW
│ Load Patch       │  ← NEW
│ ──────────────── │
│ Settings...      │
└──────────────────┘
```

## 4. Command Palette Changes

Update the command palette to use the unified UI patterns instead of its own multi-stage implementation.

### Before (Current)

- "Save Patch" → Multi-stage command palette UI asking for name
- "Load Patch" → Multi-stage command palette UI listing saves

### After (New)

- "Save Patch" → Opens Quick Save Modal
- "Load Patch" → Opens/focuses Saves sidebar view

This removes the duplicate UI and ensures consistency.

## 5. Keyboard Shortcuts

| Shortcut      | Action                                                  |
| ------------- | ------------------------------------------------------- |
| `Cmd+S`       | Save Patch (Quick Save Modal)                           |
| `Cmd+O`       | Load Patch (Opens Saves sidebar)                        |
| `Cmd+N`       | New Patch (existing)                                    |
| `Cmd+Shift+S` | Save As... (always shows modal, even for named patches) |

## Implementation Steps

### Phase 1: Quick Save Modal

1. Create `SavePatchModal.svelte` component
2. Implement save logic with folder support
3. Update command palette "Save Patch" to open modal
4. Add "Save Patch" to overflow menu

### Phase 2: Saves Sidebar View

1. Add `'saves'` to `SidebarView` type
2. Create `SavesTreeView.svelte` component
3. Implement save browsing with tree structure
4. Add icon to sidebar header
5. Implement context menu actions (load, rename, delete)

### Phase 3: Unified Load Flow

1. Update command palette "Load Patch" to open sidebar
2. Add "Load Patch" to overflow menu
3. Implement keyboard shortcut `Cmd+O`

### Phase 4: Advanced Features

1. Folder creation and organization
2. Search/filter functionality
3. Multi-select and bulk operations
4. Export/import functionality
5. Share as URL (optional)

## Migration Notes

- Existing saves in local storage should appear in the Saves view at root level
- No breaking changes to save format
- Command palette multi-stage UI for save/load can be removed after new UI is implemented

## Open Questions

1. Should we show a confirmation when loading a patch that would replace unsaved changes?
2. Should folders be stored in local storage alongside saves, or as a separate metadata structure?
3. Should "Save As..." be a separate command, or should holding `Shift` while clicking "Save" trigger it?
