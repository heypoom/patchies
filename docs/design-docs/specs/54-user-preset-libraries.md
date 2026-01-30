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
