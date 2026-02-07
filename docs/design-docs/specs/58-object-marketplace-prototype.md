# 58. Object Marketplace Prototype Plan

## Problem

Patchies has 150+ objects which overwhelms new users. Users say "it can do way too many things" and don't know where to start. Different personas (musicians, creative coders, visual artists) only care about subsets of the available objects.

## Core Concept

**"Installing" objects controls visibility** - not actual installation. Objects not in your enabled set are hidden from:

- ObjectNode.svelte autocomplete suggestions
- ObjectBrowserModal.svelte browse/search

## Data Model

### Extension Pack

```ts
interface ExtensionPack {
  id: string;
  name: string;
  description: string;
  icon?: string; // lucide icon name
  objects: string[]; // object names like 'p5', 'glsl', 'osc~'
  builtin: boolean; // true for default packs
}
```

### Store State (Simplified for Prototype)

```ts
// New store: src/stores/extensions.store.ts
interface ExtensionsState {
  enabledPackIds: string[]; // which packs are enabled
}

// Derived: enabledObjects = union of all objects from enabled packs
```

## Proposed Built-in Packs

| Pack            | Objects                                                      | Description                         |
| --------------- | ------------------------------------------------------------ | ----------------------------------- |
| **Essentials**  | js, msg, button, toggle, slider, print                       | Core building blocks everyone needs |
| **Visual**      | p5, hydra, glsl, canvas, three, webcam, video, img, screen   | Graphics & video processing         |
| **Audio**       | osc~, gain~, filters, delay~, out~, mic~, soundfile~, meter~ | Sound synthesis & effects           |
| **Livecoding**  | strudel, chuck~, csound~, sonic~, elem~, orca                | Music livecoding languages          |
| **Data Flow**   | filter, map, tap, scan, uniq, expr, trigger, select          | Functional data processing          |
| **UI Controls** | dom, vue, keyboard, textbox, label, markdown                 | Interface building                  |
| **Networking**  | netsend, netrecv, mqtt, sse, midi.in, midi.out               | External communication              |
| **AI**          | ai.txt, ai.img, ai.music, ai.tts                             | AI-powered nodes                    |
| **Esoteric**    | uxn, asm, ruby, python                                       | Alternative languages & VMs         |

## Design Decisions

### Default State: Minimal + Easy Escape Hatch

- New users start with only **Essentials** pack enabled
- Extensions UI has prominent **"Enable All Objects"** button for power users
- One click to go from minimal → full access

### Discovery: Hidden Completely

- Disabled objects don't appear in autocomplete or Object Browser
- Clean, focused experience
- Users manage visibility in the dedicated Extensions tab

### UI Location: Sidebar Tab

- New "Extensions" tab alongside Files and Presets
- Clean separation: sidebar for managing, browser for selecting

## Implementation Phases

### Phase 1: Core Data Layer

1. Create `src/stores/extensions.store.ts`

   - Define pack interfaces
   - Built-in packs data
   - State management (enable/disable)
   - Persist to localStorage
   - Derive `enabledObjects` computed set

2. Create `src/lib/extensions/packs.ts`
   - Define all built-in packs
   - Helper functions for pack management

### Phase 2: Filtering Integration

1. Modify `get-categorized-objects.ts`

   - Add `enabledObjects` parameter
   - Filter objects before categorizing

2. Update `ObjectBrowserModal.svelte`

   - Pass enabled objects to getCategorizedObjects
   - Add subtle "X objects enabled" indicator

3. Update `ObjectNode.svelte`
   - Filter autocomplete by enabled objects

### Phase 3: Extensions UI

1. Create `ExtensionPackCard.svelte`

   - Pack name, description, icon
   - Enable/disable toggle
   - Object count badge
   - Expandable to see included objects

2. Create `ExtensionsView.svelte`

   - List of pack cards
   - "Enable All" / "Disable All" buttons at top
   - Shows count of enabled objects

3. Add to `SidebarPanel.svelte`
   - New 'extensions' view option
   - Package icon

### Phase 4: Onboarding (Optional)

1. First-launch detection in extensions store
2. Onboarding modal with pack selection
3. Persona-based recommendations

## Key Files to Modify

| File                                                           | Changes                     |
| -------------------------------------------------------------- | --------------------------- |
| `src/stores/extensions.store.ts`                               | NEW - Core state management |
| `src/lib/extensions/packs.ts`                                  | NEW - Pack definitions      |
| `src/lib/components/sidebar/SidebarPanel.svelte`               | Add extensions tab          |
| `src/lib/components/sidebar/ExtensionsView.svelte`             | NEW - Extensions UI         |
| `src/lib/components/sidebar/ExtensionPackCard.svelte`          | NEW - Pack card             |
| `src/lib/components/object-browser/get-categorized-objects.ts` | Add filtering               |
| `src/lib/components/object-browser/ObjectBrowserModal.svelte`  | Pass filter, add indicator  |
| `src/lib/components/nodes/ObjectNode.svelte`                   | Filter autocomplete         |

## Verification Plan

1. Enable only "Essentials" pack → verify only those objects appear in autocomplete and browser
2. Enable/disable packs → verify changes reflect immediately
3. Refresh page → verify settings persist
4. Click "Enable All" → verify all objects become visible
5. Create an ObjectNode, type partial name → verify autocomplete respects enabled filter

## Prototype Scope

This is a **quick prototype** to validate the concept. Keeping it minimal:

- Built-in packs only (no custom pack creation yet)
- No individual object overrides (just pack-level toggles)
- No onboarding modal (just the sidebar UI)
- Skip Phase 4 entirely for now
