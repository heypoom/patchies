# 182. Pack Collections

## Summary

Replace the user-facing split between Object Packs and Preset Packs with a
task-oriented **Collections** layer. A collection enables a curated set of
object and preset packs together, so people choose what they want to make
rather than how Patchies stores its catalog.

Collections are the default way to set up a focused library. Individual packs
remain selectable for people who want to declutter search and quick insert
more precisely. This changes catalog visibility only; it does not change
object loading or runtime initialization.

This supersedes the **Library Management** section of
[174. Browse-First Object Catalog](174-object-browser-catalog.md). The
Objects/Presets insertion workspaces in that spec remain unchanged.

## Problem

First-run Patchies enables only `Starters` and `Starter Presets`. The object
browser then advertises additional _object_ packs or _preset_ packs, terms
that describe implementation rather than a newcomer’s goal. Opening Manage
Library presents two granular grids, making it hard to answer either of the
questions users actually have:

- What can I make with Patchies?
- What should I turn on for visuals, sound, code, or connected devices?

The granularity is useful to experienced users, but it is introduced before a
person has enough context to use it. Preset packs also have object-pack
dependencies, so enabling a preset can expose a separate missing-pack decision.

## Goals

- Let a first-time user configure their library by intent.
- Make all required packs visible when a collection is selected.
- Enable the required object and preset packs together from one collection
  action.
- Preserve individual pack toggles for precise catalog decluttering.
- Use the same collection model in the object browser, Packs sidebar,
  disabled-search recovery, and documentation.
- Keep an enabled catalog small enough to make search and quick insert useful.

## Non-Goals

- Change when object code, workers, WASM, media, or other runtime features are
  loaded.
- Remove the underlying `ExtensionPack` or `PresetPack` registries.
- Make user-authored collections in V1.
- Change the Objects/Presets insertion views into one mixed result list.
- Guarantee that every possible manual pack combination has no unavailable
  presets. Manual configuration may still create an incomplete preset pack;
  the UI must explain the missing requirement.

## Terminology

- **Object pack:** Existing registry entry that exposes object types.
- **Preset pack:** Existing registry entry that exposes saved presets.
- **Primary collection:** The single user-facing home for a pack. In V1, every
  built-in pack has at most one primary collection.
- **Supporting object:** A single object type required by a collection’s
  selected presets but owned by another primary pack. It appears explicitly in
  every collection that needs it, grouped under its source pack, without
  enabling that parent pack.
- **Optional preset pack:** A preset pack that belongs to a collection but is
  excluded from its default bundle. People enable it independently when they
  want its additional catalog content.
- **Effective pack state:** Whether a pack is visible in the catalog after
  applying selected collections and a person’s individual pack overrides.

Object and preset pack IDs are separate namespaces. A collection must identify
them with typed fields rather than a shared string list; both registries
currently contain an ID named `starters`.

## Collection Manifest

Add a built-in collection manifest adjacent to the existing pack definitions.
The manifest is the single source of truth for collection labels, ordering,
descriptions, icons, primary membership, and dependencies.

```ts
interface PackCollection {
  id: string;
  name: string;
  description: string;
  icon: string;
  primaryObjectPackIds: string[];
  primaryPresetPackIds: string[];
  optionalPresetPackIds: string[];
  supportingObjectTypes: string[];
}
```

`supportingObjectTypes` must be explicit. A collection must not silently derive
or enable parent packs at interaction time. The manifest builder or test
validates that each primary or optional preset pack in a collection has all of
its required object types supplied by the collection’s primary or supporting
object packs.

The initial primary collection vocabulary is:

| Collection        | User intent                                                 |
| ----------------- | ----------------------------------------------------------- |
| Essentials        | Learn the patching basics and build small patches           |
| Visuals           | Make graphics, video, shaders, and interactive widgets      |
| Music             | Compose, sequence, perform, and play instruments            |
| Sound Design      | Craft signals, effects, routing, and audio-reactive patches |
| Code & Data       | Program, transform data, and explore computational systems  |
| Connect           | Work with cameras, devices, networks, and vision            |
| AI & Experimental | Opt into AI-assisted and unstable capabilities              |

Exact membership is part of this feature, not incidental implementation. The
initial manifest must assign each built-in pack one primary home where possible
and list cross-domain requirements as supporting objects. For example, `FFT
Demos` belongs primarily to Sound Design while its required visual objects are
listed as explicit support there.

Optional preset packs remain in their collection’s inventory but are not added
when the collection is selected. `Greggman Bytebeat Archive` is optional in
Sound Design: it has roughly 500 presets and must be enabled deliberately.

`Essentials` contains the locked starter object and preset packs. It is
enabled in every configuration and cannot be disabled as a collection.

## State and Persistence

Persist collection intent separately from the effective enabled-pack lists:

```ts
interface PackLibraryPreferences {
  selectedCollectionIds: string[];
  objectPackOverrides: Record<string, boolean>;
  presetPackOverrides: Record<string, boolean>;
  hasCompletedCollectionOnboarding: boolean;
}
```

The effective object and preset pack IDs are derived, not independently
authored:

1. Start with locked starter packs.
2. Union every selected collection’s primary packs and supporting object packs.
   Do not include optional preset packs.
3. Apply per-pack overrides, with an explicit `false` taking precedence.
4. Include an explicit `true` override even when its primary collection is not
   selected.

The existing `enabledPackIds`, `enabledPresetPackIds`, `enabledObjects`, and
`enabledPresets` public behavior remains available to callers. They read the
effective state. Migrate existing local-storage values into overrides so an
existing user’s enabled and disabled pack choices remain unchanged; do not
force onboarding for an existing saved library.

## Collection State and Actions

Each collection reports one of three states from its primary packs. Optional
preset packs do not affect collection state:

- **On:** Every primary pack is effectively enabled.
- **Partial:** At least one primary pack is enabled and at least one is
  disabled.
- **Off:** No optional displayed pack is enabled.

Selecting a collection adds it to `selectedCollectionIds` and clears its
collection-related `false` overrides so its complete, explicit bundle is
enabled. Deselecting it removes the collection selection and writes explicit
`false` overrides for its primary packs. In V1, primary packs do not overlap,
so this does not disable a pack owned by another collection; a person can
re-enable any individual pack afterward.

Toggling an individual primary pack writes an override and immediately updates
its collection state. Supporting objects are implicit requirements, not
independent pack choices, so they never make another collection partial.

## First-Run Collection Chooser

On the first `Ctrl/Cmd + O` opening for a new library, show a concise
collection chooser before the normal object browser:

- Explain that Patchies starts focused and additional tools can be enabled any
  time.
- Present non-Essentials, non-AI collections as a short multi-select list with
  outcome-oriented descriptions and included pack counts. AI remains available
  later in Manage Collections.
- Apply the selected collections, mark onboarding complete, then open the
  normal catalog.
- Offer **Skip for now**. It leaves only Essentials active and never traps the
  user in onboarding.
- Do not automatically show this chooser to a user with existing persisted
  pack choices.

### Visual presentation

The chooser is a single, expressive first-run composition rather than a set of
generic settings cards. Each collection has a stable, purpose-led signal color
and a small geometric signal path: Visuals is violet, Music is magenta, Sound
Design is amber, Code & Data is cyan, and Connect is green. The color makes
the different creative directions easier to scan; the checkbox and selected
state remain the source of truth.

Selecting a collection energizes only its path and contributes its color to a
compact library signal beside the primary action. The effect gives a clear
sense that the person is assembling their creative toolset, without delaying
selection or changing the chooser's multi-select behavior. All nonessential
motion respects reduced-motion preferences and the modal remains an opaque,
readable Ink surface.

When multiple collections are selected, the card surfaces recede toward the
neutral Ink panel. Their colored checks, icons, borders, and signals remain so
the user can still scan their choices without creating a wall of competing
color fields.

The chooser does not teach the distinction between object and preset packs.
That distinction is deliberately absent from its primary copy.

## Library UI

Rename the user-facing library surface to **Collections**. Use the same
component and information architecture in the object-browser management view
and Packs sidebar.

On narrow screens and in the Packs sidebar, render a dense, expandable tree.
On desktop in Manage collections, render a Finder-style drill-down:

```text
Collections          Packs                  Included items
Visuals              Video Synths           hydra
Sound Design         Paper Shaders           glsl
Code & Data                                 three
```

- Collection rows are the primary control and show on, partial, or off state.
- Desktop selection moves rightward: select a collection to show its packs,
  then select a pack to show its read-only contents. It never expands a row in
  place or changes a neighboring column’s height.
- Supporting objects appear as read-only, source-named groups (for example,
  **Included from Media**) so people can discover the available objects without
  enabling the whole source pack.
- Optional preset packs are visibly labelled **Optional**, remain individually
  toggleable, and do not affect their collection’s on, partial, or off state.
- Narrow layouts expand a collection to reveal primary packs, then supporting
  source groups with a requirement reason.
- Pack rows are independently selectable and toggleable.
- Object and preset leaves are inventory only; they never have enablement
  controls.
- Search matches collection names, pack names, descriptions, object names, and
  preset names. A match opens the smallest necessary branch while preserving
  its collection context.
- Global “Enable all” remains an advanced action. It enables all non-excluded
  packs rather than implying that Collections have disappeared.

The normal browser header links to **Manage collections**, replacing the
current count-based “N more object/preset packs” wording. Disabled-object
recovery names the object’s primary collection first, then its pack, and keeps
the one-click “Enable & Add” path.

## Accessibility and Responsive Behavior

- Use a checkbox with `aria-checked=\"mixed\"` for a partial collection or pack
  state; do not rely on color alone.
- Tree expansion controls and enablement controls are distinct focusable
  buttons. Keyboard users can traverse a collapsed tree without encountering
  read-only leaves.
- Supporting-object reasons are available as visible text and in the accessible
  name, not hover-only tooltips.
- On narrow screens, retain the tree hierarchy and use disclosure rows rather
  than reverting to two independent card lists. At desktop width, retain all
  three columns side by side with independent vertical scrolling.
- Preserve the existing modal’s focus management, Escape behavior, and 44px
  primary touch targets.

## Documentation

Rewrite `ui/static/content/topics/manage-collections.md` around a focused library:

- Introduce Collections before individual packs.
- Explain first-run selection and later management.
- Explain primary packs and supporting objects in plain language.
- Explain partial collection state and individual pack decluttering.
- Retain search, Enable all, and disabled-object recovery guidance as advanced
  actions.

## Verification

- A new user sees the chooser once, can select multiple collections, can skip,
  and reaches the object browser with the expected effective catalog.
- An existing user retains the same enabled object and preset packs after
  migration and does not see the chooser automatically.
- Enabling Visuals enables the `Audio Reactive Demos` pack and its visual
  requirements. Users enable its `fft~` audio-analysis dependency through
  Sound Design when they need it.
- Enabling Sound Design does not enable `Greggman Bytebeat Archive`, and its
  disabled state does not make Sound Design partial.
- Manually enabling or disabling any pack updates affected collection states
  to on, partial, or off correctly.
- Object-browser management, Packs sidebar, search recovery, and documentation
  expose Collections rather than a primary Object Packs/Preset Packs split.
- `enabledObjects`, `enabledPresets`, object-browser filtering, autocomplete,
  and preset availability continue to consume the effective pack state.
