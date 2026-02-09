# 66. Object virtual filesystem mount and local edits

## Motivation

I love editing TypeScript code on real code editors like Neovim and Cursor, because there are so much niceties, like TypeScript Language Server, Intellisense, and ergonomic keybindings that you don't get with using Patchies' CodeMirror Editor.

## Core Idea

What if we let people edit their object code in whatever editor of choice they want? To do this, we mount the virtual filesystem into the user's real filesystem by using the File System Access API.

## Implementation

We already have a virtual filesystem system already, where people can add their own "linked folders", which is stored in IndexedDB. I believe we should extend on that but in reverse: letting people choose destination directories.

Once they have chosen their folder to represent the virtual object filesystem and we get their directory handles:

- We write all the object code to the files within that directory
  - We have to read the svelte-flow nodes and edges first. Then, have a getter for each type that extracts its stuff. For most nodes this is simply the `code` field, so that can be the default getter, with fallback.
- We create a button to **push and pull** changes, between the patcher and the user's local editor. There is no fs watcher in Web APIs so I guess this has to be manual?
  - Using automated timers or polling might risk either patch overriding local, or local overriding patch? Not exactly sure. I don't want to waste time on conflict resolution so I guess manual "always override" solves that problem.
  - I guess this has to be either per-object push/pull. Or, we need some sort of git-like diffing interface that lets you choose which one to "push/pull" but I think that's gonna be even more complex?

We have already designed the `obj://` VFS protocol which are the object protocol. The idea of the object protocol is to represent our node graph in a virtual file tree format:

```txt
obj/
  js-20.ts
  glsl-4.glsl
```

Essentially, we try to represent the code part of each object as a virtual file, and in this case write it to the user's real folder.

## Objects with their own filesystem

[Some objects has more complex filesystem](/docs/design-docs/specs/53-virtual-filesystem-object-integrations.md), such as `chuck~` (ChucK), `elem~` (Elementary Audio) and `csound~` (Csound), and we can represent it using folders with files inside:

```txt
obj/
  chuck~-24/
    hello.ck
    world.ck
  elem~-36/
    sample0.wav
    sample1.wav
```

## Discovering which node belong to which object id

- We should have a "focus/inspect" button on the right of the "Object" root namespace entry. This makes it so that when the user selects a node, its entry e.g. `obj://js-20.js` is **highlighted** in the file tree.

- We should also have the reverse: a button in each file entry that highlights the node that is associated with that file, albeit this is more complex as it has to be added to every visual object.

## Type Definition

We should always write `patchies.d.ts` whenever we mount, re-mount or push the changes. Reason is that this allows LSP and IDEs to have full autocompletion for the [JavaScript Runner](/ui/static/content/topics/javascript-runner.md), as well as individual objects if possible. I guess we can do `// references` comments that also inject object-specific methods like `flash()` or `setVideoCount`.
