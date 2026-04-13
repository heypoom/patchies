# 131. Sidebar Tab Context Menu

## Summary

Replace the chevron expand/collapse system in the sidebar header with a right-click context menu that lets users freely show/hide any sidebar tab. Similar to VS Code's activity bar right-click menu.

## Motivation

- The current chevron system is finicky — items get "promoted" when active, creating complex derived state
- Users can't freely choose which tabs to show in the header
- The expand/collapse UX is unintuitive compared to a standard context menu

## Design

### Tab Visibility

All sidebar views can be shown or hidden in the header bar. Visibility is persisted to localStorage.

**Default visible**: `files`, `presets`, `saves`, `help`
**Default hidden**: `packs`, `samples`, `chat`, `preview`, `profiler`

AI-only views (`chat`, `preview`) are hidden from both the header and the context menu when AI features are disabled.

### Context Menu

Right-clicking on:

- **Any tab icon** in the header → shows context menu with checkboxes for all views
- **Empty space** in the header bar → same context menu

The context menu shows each view with a checkbox indicating visibility. Checking/unchecking toggles whether the tab icon appears in the header.

The currently active view cannot be hidden (its checkbox is disabled or the item is visually marked as active).

### Behavior

- Clicking a hidden view in the context menu makes it visible AND switches to it
- Hiding the currently active view switches to the first visible view
- At least one view must remain visible (prevent hiding all)

## Implementation

### Store

New `sidebar-visibility.store.ts`:

- `sidebarVisibleTabs` writable store (`Set<SidebarView>`)
- Persisted to localStorage key `patchies-sidebar-visible-tabs`
- Helper functions: `toggleSidebarTab()`, `showSidebarTab()`, `hideSidebarTab()`

### SidebarPanel Changes

- Remove: `isExpanded`, `isPacksPromoted`, `isSamplesPromoted`, `isChatPromoted`, `isProfilerPromoted`, chevron button, expanded section
- Remove: `allExpandableItems`, `baseViews` split — merge into single `allViews` list
- Add: Context menu wrapping the header icon area
- Derive visible tabs from store + AI feature visibility
