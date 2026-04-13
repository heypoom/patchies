# 130. Settings Modal

## Summary

Add a settings modal with a categorized sidebar, surfacing all user-configurable settings that currently live only in CommandPalette toggle commands and scattered stores. The modal clearly separates **global (per-user)** settings from **patch-local** settings.

## Motivation

- **Discoverability**: ~10+ settings are only reachable via command palette search. New users don't know they exist.
- **No state visibility**: Toggle commands don't show current state at a glance (some try with "currently ON/OFF" in descriptions, inconsistently).
- **No grouping**: Related settings (e.g., AI provider + AI features toggle) are separate commands with no visual relationship.
- **Scope ambiguity**: Users can't tell which settings are per-patch vs global.

## Design

### Visual Style

Reuses the same dark-card aesthetic as `StartupModal` and `ObjectBrowserModal`:

- Dark background (`#09090b`), accent border, corner ornaments, radial glow
- **Left sidebar** with category list (not top tabs — more categories than startup modal)
- Right content pane with the settings for the selected category
- Same close button, backdrop blur, escape-to-close behavior
- IBM Plex Mono for labels, Syne for headings

### Layout

```
┌──────────────────────────────────────────────────────┐
│  ┌─────────────┐ ┌────────────────────────────────┐  │
│  │  SETTINGS    │ │  Category Title                │  │
│  │             │ │                                │  │
│  │  Per-User   │ │  Setting Label         [toggle]│  │
│  │  ─────────  │ │  description text              │  │
│  │  General    │ │                                │  │
│  │  Editor     │ │  Setting Label         [value] │  │
│  │  Rendering  │ │  description text              │  │
│  │  AI         │ │                                │  │
│  │  Audio      │ │  ...                           │  │
│  │  Samples    │ │                                │  │
│  │  Extensions │ │                                │  │
│  │             │ │                                │  │
│  │  Per-Patch  │ │                                │  │
│  │  ─────────  │ │                                │  │
│  │  Transport  │ │                                │  │
│  │             │ │                                │  │
│  └─────────────┘ └────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

The sidebar has two labeled sections separated by a subtle divider:

- **Per-User** — settings that persist globally across all patches
- **Per-Patch** — settings scoped to the current patch

### Scope Labels

Each section header in the sidebar has a small label: `PER-USER` or `PER-PATCH` in uppercase, muted color, monospace. This makes scope unambiguous.

### Opening the Modal

- Command palette: `Settings` command (new)
- Keyboard shortcut: `Cmd+,` (standard macOS convention)
- Optional: gear icon in bottom bar or sidebar

### Categories & Settings

#### Per-User Settings

**General**
| Setting | Control | Store | Notes |
|---------|---------|-------|-------|
| Show startup modal | Toggle | `patchies-show-startup-modal` | |
| Sidebar default open | Toggle | `patchies-sidebar-open` | |
| Show bottom bar | Toggle | `isBottomBarVisible` (ui.store) | |

**Editor**
| Setting | Control | Store | Notes |
|---------|---------|-------|-------|
| Vim mode | Toggle | `editor.vim` | Shows "requires reload" hint |

**Rendering**
| Setting | Control | Store | Notes |
|---------|---------|-------|-------|
| Render FPS cap | Dropdown (Unlimited/30/60) | `renderFpsCap` (renderer.store) | |
| Show FPS monitor | Toggle | `isFpsMonitorVisible` (ui.store) | |
| Show video stats | Toggle | `showVideoStats` (video.store) | |
| MediaBunny (WebCodecs) | Toggle | `useWebCodecs` (video.store) | Shows browser support note |

**AI**
| Setting | Control | Store | Notes |
|---------|---------|-------|-------|
| Enable AI features | Toggle | `isAiFeaturesVisible` (ui.store) | |
| AI provider | Dropdown (Gemini/OpenRouter) | `ai-settings` | |
| API key | Password input | `ai-settings` | Per-provider |
| Text model | Text input | `ai-settings` | Per-provider |
| Image model | Text input | `ai-settings` | Per-provider |
| Expand thinking | Toggle | `chat-settings` | |
| Chat persona | Dropdown | `persona.store` | |

**Audio**
| Setting | Control | Store | Notes |
|---------|---------|-------|-------|
| Orca BPM | Number input | `orca-bpm` | |

**Samples**
| Setting | Control | Store | Notes |
|---------|---------|-------|-------|
| Enabled providers | Checkboxes | `sample-search:enabled-providers` | |
| Auto-preview | Toggle | `sample-search:auto-preview` | |
| Preview volume | Slider | `sample-search:preview-volume` | |
| Freesound API key | Password input | `freesound:api-key` | |

**Extensions**
| Setting | Control | Store | Notes |
|---------|---------|-------|-------|
| Enabled object packs | Checkbox list | `patchies:enabled-packs` | "Starters" locked on |
| Enabled preset packs | Checkbox list | `patchies:enabled-preset-packs` | |

**Profiler**
| Setting | Control | Store | Notes |
|---------|---------|-------|-------|
| Display stat | Dropdown | `profiler-settings` | avg/max/p95/last/calls |
| Sample window | Dropdown | `profiler-settings` | 2.5s/5s/10s |
| Flush interval | Dropdown | `profiler-settings` | 250/500/1000ms |
| Hot threshold | Dropdown | `profiler-settings` | 1/2/5/10ms |
| Focus on select | Toggle | `profiler-settings` | |

#### Per-Patch Settings

These are already serialized into `PatchSettings` in `serialize-patch.ts` and restored on patch load.

**Patch**
| Setting | Control | Store | Serialized in PatchSettings |
|---------|---------|-------|-----------------------------|
| BPM | Number input | `transport.store` | `bpm` |
| Time signature | Dual number input | `transport.store` | `timeSignature` |
| Output size | Dual number input | `GLSystem` | `outputSize` |
| Show cables | Toggle | `isCablesVisible` (ui.store) | `cablesVisible` |

> **Note**: These settings also persist globally in their respective stores (for the "last used" state), but are saved/restored per-patch via `PatchSettings`. The settings modal should read/write the live stores — the serialization layer handles per-patch persistence automatically.

## Component Architecture

```
src/lib/components/settings-modal/
  SettingsModal.svelte          # Root modal (sidebar + content pane)
  SettingsSidebar.svelte        # Category nav with scope sections
  SettingsPane.svelte           # Right content area (renders active category)
  categories/
    GeneralSettings.svelte
    EditorSettings.svelte
    RenderingSettings.svelte
    AISettings.svelte
    AudioSettings.svelte
    SamplesSettings.svelte
    ExtensionsSettings.svelte
    ProfilerSettings.svelte
    TransportSettings.svelte
  controls/
    SettingRow.svelte            # Label + description + control layout
    SettingToggle.svelte         # Toggle switch
    SettingDropdown.svelte       # Dropdown select
    SettingSlider.svelte         # Range slider
    SettingTextInput.svelte      # Text/password input
  types.ts                       # Category/setting types
```

### SettingRow Component

Standard layout for every setting row:

```svelte
<SettingRow title="Vim Mode" description="Enable Vim keybindings in code editors">
  <SettingToggle bind:value={vimEnabled} />
</SettingRow>
```

Renders as a horizontal row: label + description on the left, control on the right. Consistent spacing and alignment across all categories.

### Reuse of Existing Controls

- Where possible, the AI settings category should reuse or extract logic from the existing `AiProviderDialog.svelte` rather than duplicating it.
- Extension packs can reuse pack listing logic from the object browser.

## CommandPalette Integration

- Add a `settings` command that opens the modal
- Add `settings:ai`, `settings:rendering`, etc. to jump directly to a category
- Existing toggle commands remain as shortcuts — they continue to work as before
- The `initialCategory` prop on `SettingsModal` supports deep-linking from command palette

## Keyboard Shortcut

`Cmd+,` (macOS) / `Ctrl+,` (Windows/Linux) — standard settings shortcut. Register in the keybindings system.

## Non-Goals

- Not migrating storage mechanisms (localStorage stays as-is)
- Not adding new settings — just surfacing existing ones
- Not removing command palette toggles — they stay as power-user shortcuts
- Not tackling transport per-patch persistence migration (separate spec)

## Implementation Plan

1. Create `settings-modal/` component directory with types and `SettingsModal.svelte` shell
2. Build `SettingRow` and control primitives (`SettingToggle`, `SettingDropdown`, `SettingSlider`, `SettingTextInput`)
3. Implement sidebar with scope-separated category navigation
4. Implement category panes one at a time (start with General, then Rendering, AI, etc.)
5. Wire up `Cmd+,` shortcut and command palette `settings` command
6. Add `initialCategory` prop for deep-linking from command palette
