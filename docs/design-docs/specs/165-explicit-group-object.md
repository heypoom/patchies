# 165. Visual Group Object

## Goal

Add a `group` object that visually frames related canvas objects and updates membership from spatial placement.

## Scope

- Users add objects to a group by moving objects into the group's frame or resizing the group around them.
- Users remove objects from a group by moving them outside the group's frame.
- Group membership is stored with Svelte Flow `parentId` relationships.
- A group is a normal canvas node with a translucent border, resize handles, and no ports.
- Dragging the group moves all child objects together through Svelte Flow's parent/child behavior.
- Membership changes are committed on drag/resize release, not continuously while dragging.

## Non-Goals

- No nested group authoring beyond preserving existing parent relationships where possible.
- No collapse/expand, editable labels, or locking controls in the first pass.
- No new message, audio, or video behavior.
- No automatic group deletion when it becomes empty.

## Behavior

### Create A Group

Creating a `group` object from the object browser inserts an empty resizable frame. It does not capture objects until the user releases a resize or moves objects into it.

New group nodes store their default frame size as top-level `width` and `height` immediately. The first resize therefore starts from the same dimensions the user sees, even before the group has ever been manually resized.

### Add Objects To A Group

When a top-level non-group object is released with its center inside a group frame, it becomes a child of that group.

The child receives:

- `parentId: <group-id>`
- a position converted from absolute canvas coordinates to the group's relative coordinate space

The group node appears before its children in the `nodes` array because Svelte Flow requires parents to appear before child nodes.

When a group is resized, all top-level non-group objects whose centers are inside the resized frame are added to that group.

### Move Group

Dragging the group moves the group node. Svelte Flow keeps child nodes visually attached because child positions are relative to the parent.

Moving a group does not sweep up unrelated top-level objects. This avoids accidental membership changes while repositioning an existing group.

### Remove Objects From A Group

When a child object is released with its center outside its parent group frame, it becomes a top-level canvas object.

The object receives:

- no `parentId`
- no `extent`
- absolute position equal to group position plus child relative position

When a group is resized smaller, direct children whose centers are outside the resized frame are removed from that group.

## UI

- Add `group` to the Starters pack and object browser.
- Do not require command palette actions or keyboard shortcuts for grouping.
- The visible frame and resize handles must overlap exactly.
- Empty space inside a group behaves like empty canvas space for canvas insertion and selection clearing.
- Drag-select gestures that start inside a group select objects inside the group without selecting the group frame itself.
- Users select or drag a group by its border, resize handles, or title pill, not by the transparent interior.
- The title pill follows the small `node-title-drag-handle` visual convention used by other visual nodes.
- A settings button at the top-right opens predefined color swatches for the group frame. The settings panel opens outside the group frame so it does not cover grouped objects.
- Group color is optional. Omitting `node.data.color` uses the default gray frame; choosing a swatch stores `node.data.color` and supports undo/redo as a discrete node data change.
- The rendered group frame uses explicit pixel dimensions from `node.width` and `node.height` so resize observation cannot collapse the group back to its content size.
- The Svelte Flow group wrapper must override the library's built-in group-node width so first resize measurement comes from the Patchies frame, not the default 150px XYFlow group style.

## Testing

Pure tests cover:

- adding a top-level object whose center is inside a group
- removing a child object whose center is outside its group
- keeping a child inside its group when its center remains inside
- preserving parent-before-child node order after membership changes
- not sweeping unrelated objects into a group when the group itself is dragged
- keeping the group interior pointer-transparent while border/title hit zones stay pointer-active
- deriving group frame styles from the selected predefined color
- preserving resized group dimensions even when measured dimensions lag behind explicit node dimensions

Focused Svelte/type checks should cover component wiring and object registration.
