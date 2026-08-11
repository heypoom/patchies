# 45. Application Startup Modal

Let's build a custom CSS modal (to allow for maximal customizability) with no backdrop.

This should replace the "Keyboard Shortcuts" modal. When clicking on the help button (that we currently use for keyboard shortcuts), we must show the application startup modal instead.

The goal is to show this modal every time the application starts, and for it to be triggerable via the help button.

MVP features

1. Contains the name and description of the application.
2. Describes briefly what the application does and how to get started.
3. Provides a link to the application's GitHub repository for further information.
4. Contains an "examples" tab with card of examples with images. I should be able to update the patch list by simply updating a static file, e.g. `example-patches.json`. It should be groupde by categories.
5. Provides footer community links for Patchies Instagram demos/tutorials and the Discord server.

Phase 2 features - can wait until MVP is done

1. Contains a "load recents / create new" functionality. Imagine a typical application's startup dialog (e.g. Blender or CapCut's), it would let you either load from recently saved patches, or create new patches.
   - See `CommandPalette.svelte` of how the save and load capability works today.

## Reference/Inspiration

This idea was inspired by Olivia Jack's hydra startup modal. It's short and brief, yet informative. Don't copy their writing style, please. This is just to serve as content reference.

```
hydra
live coding video synth

///////////////////////////////////////////////////////////

Hydra is live code-able video synth and coding environment that runs directly in the browser. It is free and open-source and made for beginners and experts alike.
To get started:

    Close this window
    Change some numbers
    Type Ctrl + Shift + Enter

///////////////////////////////////////////////////////////


Hydra is written in JavaScript and compiles to WebGL under the hood. The syntax is inspired by analog modular synthesis, in which chaining or patching a set of transformations together generates a visual result.

Hydra can be used:

    to mix and add effects to camera feeds, screenshares, live streams, and videos
    to create generative and audio-reactive visuals, and share them online with others
    in combination with other javascript libraries such as P5.js, Tone.js, THREE.js, or gibber
    to add interactive video effects to a website
    to experiment with and learn about video feedback, fractals, and pixel operations
    to stream video between browsers and live-jam with others online

Created by olivia.

For more information and instructions, see: the interactive documentation, a list of hydra functions, the community database of projects and tutorials, a gallery of user-generated sketches, and the source code on github,

There is also an active Discord server and facebook group for hydra users+contributors.

If you enjoy using Hydra, please consider supporting continued development <3 .
```

## Implementation Details

### MVP Implementation (Completed)

#### Component Architecture
The startup modal is implemented as a modular component system in `/ui/src/lib/components/startup-modal/`:

- **StartupModal.svelte** - Main modal container with tab navigation and backdrop handling
- **AboutTab.svelte** - About content with app description and getting started guide
- **ExamplesTab.svelte** - Examples browser with category grouping and loading logic
- **ExampleCard.svelte** - Individual example patch card component
- **types.ts** - Shared TypeScript types for examples and tabs

#### Features Implemented

1. ✅ **Custom CSS Modal** - Built with Tailwind classes, no backdrop (transparent overlay for click handling)
2. ✅ **Tab System** - Two tabs: "About" and "Examples" with orange accent highlighting
3. ✅ **About Content**:
   - App name and tagline
   - Description of capabilities (P5.js, Hydra, Strudel, GLSL, etc.)
   - Getting Started guide with keyboard shortcuts
   - Links to GitHub repository and documentation
   - Footer links to Patchies Instagram and Discord for demos, tutorials, sharing creations, and help
4. ✅ **Examples Tab**:
   - Loads from `/static/example-patches.json`
   - Grouped by categories
   - Card grid layout with hover effects
   - Support for thumbnail images
   - Clicking a card navigates to `/?patch={id}`
5. ✅ **Auto-show on First Launch**:
   - Uses `localStorage` key `patchies-seen-startup-modal`
   - Shows automatically on first app load
   - Can be re-opened via help button
6. ✅ **Help Button Integration**:
   - Replaced `ShortcutHelp.svelte` with `StartupModal` in `FlowCanvasInner.svelte`
   - Help icon in top-right triggers modal
7. ✅ **Show on Startup Toggle**:
   - Toggle switch at bottom of About tab
   - Stores preference in `localStorage` key `patchies-show-startup-modal`
   - Defaults to enabled for first-time users
   - Orange toggle switch with smooth animation

#### Typography

- Use IBM Plex Sans for interface copy and IBM Plex Mono for shortcuts, commands, and technical
  labels.
- Use IBM Plex Sans at regular weight for the expressive heading. Scale, line breaks, and one
  deliberate Ember emphasis create the display voice without introducing a second type family.
- Do not use an eyebrow above the hero heading or rely on italic serif styling for personality.

#### Expressive Hero

The About tab is the expressive exception within the restrained modal system from spec 173. Its
hero visualizes Patchies' core mechanism as a compact patch topology: small code/object nodes,
visible signal cables, and an output state. The diagram is illustrative and does not claim to be a
live patch. It uses the existing Ink/Zinc/Ember palette, remains readable without animation, and
keeps motion disabled when reduced motion is requested.

The hero includes direct actions to browse demos and open the object browser. Supporting guidance,
shortcuts, and community links remain visually quieter so the hero is the modal's single peak.

The About tab reads as one continuous instrument surface rather than a stack of separate cards. Its
content runs edge-to-edge between the tab bar and footer: the modal shell is the boundary, so the
About content must not introduce an inset outer container, rounded inner frame, or decorative margin.
The technology rail, guide/shortcut paths, and compact command reference use only internal dividers.
This keeps the learning material connected to the patch metaphor while preserving clear hierarchy
beneath the primary actions.

The patch topology must be geometrically trustworthy and visually quiet. Cables terminate at the
visible centers of their inlet and outlet handles at every supported size. The illustrative patch
demonstrates a real Patchies relationship: an audio source passes through gain to audio output, while
the same signal is analyzed by `fft~` and drives a Hydra visual. Analysis and visual nodes use neutral
boundaries rather than introducing a second accent system. The Hydra result is a flat, edge-to-edge
striped output rectangle rather than another padded node or nested preview. Code nodes preserve the
editor's anatomy: the object name sits outside the node while the code itself sits inside. Related
nodes align to shared edges where possible so the topology reads as a deliberate layout.

The compact shortcut reference presents six first moves in a three-column, two-row command matrix:
adding and browsing objects, running code, opening the sidebar and command palette, and connecting
nodes. On narrow screens it becomes one column. Each item is a single compact row with a muted icon,
short label, and platform-aware keycap; extended explanations belong in the full Shortcuts tab.
Because these items are reference content rather than controls, their surface, icons, and typography
must remain visually quieter than the clickable guide and Shortcuts paths above them. Gesture labels
use the same keycap treatment as keyboard shortcuts.

The community links and “show on startup” preference live in a dedicated footer outside the tab's
scrolling content. The footer stays visible whenever About is active, including before the user
scrolls, and adapts to two compact rows on narrow screens.

#### Demos and Sparks Signal System

Demos and Sparks extend the patch topology into an interactive signal-system language while
remaining subordinate to About's hero. The treatment is built with lightweight CSS and SVG rather
than WebGL, backdrop blur, or continuously running off-screen animation. Motion is limited to direct
interaction and respects reduced-motion preferences.

Demo cards carry quiet category-specific signal traces behind their real title, description, author,
and action. The trace is decorative rather than a literal preview of the patch, stays neutral at
rest, and receives a brief Ember signal sweep on hover or keyboard focus. Cards remain readable and
fully functional without the trace or motion.

Sparks reads as one connected creative instrument rather than two unrelated selector grids. Its
opening question is a live sentence that combines the selected feeling and medium into a curiosity
prompt. On desktop, entering Sparks expands the modal from its focused reading width into a wider
creative workspace, then returns it when another tab is selected. The width transition uses a
single restrained ease and is disabled when reduced motion is requested. Feeling and Medium remain
visible side by side around a signal junction on wide screens, then stack on narrow screens. They
form one Define stage, allowing users to understand and adjust the collision as a whole. Generated
ideas occupy a separate Ideas stage rather than splitting the modal with the selectors; users may
return to Define without losing their generated ideas. Mood choices expose a directional affordance and clear
hover, focus, and selected states. Mood colors belong to those interactions and generated results,
not broad card fills; the default state remains in the Ink, Zinc, and Ember modal system. The
full-screen Sparks route is intentionally omitted: this workflow exists only inside the startup
modal so its presentation and editor actions have one maintained implementation.

After the first feeling or medium is selected, generation appears as a persistent creation dock at
the bottom of the Define stage, keeping the creative-direction field and Imagine action visible.
Invoking Imagine transitions the modal to the Ideas stage, where generated what-if cards receive the
full workspace instead of sharing it with the selectors. A clear Edit feeling and medium action
returns to Define without discarding results. The Ideas header keeps the selected feeling and every
selected medium visible while the user refines or regenerates the directions. Missing AI
credentials remain a just-in-time concern:
invoking Imagine opens provider settings, while the idle dock does not pre-emptively gate or warn
the user.

#### Example Patches JSON Format

```json
{
  "patches": [
    {
      "id": "patch-id",
      "name": "Patch Name",
      "description": "Brief description",
      "category": "Category Name",
      "author": "Author Name",
      "imageUrl": "/optional/image/path.png"
    }
  ]
}
```

Categories are automatically generated from the `category` field in each patch.

### Phase 2 (Future)

To implement the "load recents / create new" functionality:

1. Add a third tab: "Recent Patches"
2. Reference `CommandPalette.svelte` save/load implementation
3. Read from `localStorage` keys prefixed with `patchies-patch-`
4. Display recent patches sorted by last modified timestamp
5. Add "New Patch" button that clears the canvas
