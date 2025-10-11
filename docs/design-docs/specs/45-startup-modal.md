# 45. Application Startup Modal

Let's build a custom CSS modal (to allow for maximal customizability) with no backdrop.

This should replace the "Keyboard Shortcuts" modal. When clicking on the help button (that we currently use for keyboard shortcuts), we must show the application startup modal instead.

The goal is to show this modal every time the application starts, and for it to be triggerable via the help button.

MVP features

1. Contains the name and description of the application.
2. Describes briefly what the application does and how to get started.
3. Provides a link to the application's GitHub repository for further information.
4. Contains an "examples" tab with card of examples with images. I should be able to update the patch list by simply updating a static file, e.g. `example-patches.json`. It should be groupde by categories.

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
