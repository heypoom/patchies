# 206. Presentation Views

Status: Exploration. This spec proposes three models and does not choose between
them yet. None needs implementing now.

## Problem

In Patchies today, buttons, sliders, and other widgets only exist on the infinite
canvas. A button in the top-left corner of the screen is impossible. The only way
to build a custom interface is the `surface` object, which takes over the screen
with a transparent canvas and needs hand-written Canvas 2D drawing code
(`ui/static/content/objects/surface.md`).

Patchies V2 could go beyond "interfaces only exist on the infinite canvas" by
separating where a control lives in the patch from where it appears in the interface.

## Three Models From Established Tools

|                | TouchDesigner: panel components                                                                        | Max: Presentation Mode                                                                   | Pure Data: Graph-on-Parent                                            |
| -------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| What the UI is | A separate hierarchy of UI components (Container, Button, Slider, Field) inside the network            | The same objects as the patch, each with a second position                               | Selected controls of a subpatch, shown inside its box on the parent   |
| Patch and UI   | separate, connected by bindings                                                                        | one thing, two layouts                                                                   | one thing, one layout                                                 |
| Layout         | Parameters per component: position, size, alignment, anchors, nested containers with automatic layouts | Absolute positions in one presentation layout per patcher                                | A fixed rectangle on the parent canvas                                |
| Reuse          | Components are reusable and nest                                                                       | `bpatcher` embeds a subpatch's presentation                                              | Abstractions carry their own interface                                |
| Windows        | A Window component shows any panel on any monitor. Perform Mode hides the editor.                      | The patcher window, switched into presentation                                           | None: the UI stays on the canvas                                      |
| Strengths      | Scales to installations, many screens, and complex interfaces                                          | Almost no extra work: mark a control and place it, with nothing duplicated               | Minimal, and good for reusable abstractions                           |
| Weaknesses     | Two things to build and keep in sync: the logic network and the UI network. Steep to learn.            | One layout only, with fixed pixel positions: no anchoring to edges, no responsive layout | Does not put controls on the screen: the UI still lives on the canvas |

## Model 1: Presentation Views (Max-Style)

The same nodes get a second layout in screen space.

- A widget node, such as a button, slider, toggle, or scope, can have a
  presentation rectangle in one or more named views, such as `perform`, `mobile`,
  or `embed`. This is more node data: `presentation: { view, rect }`.
- Positions are in screen space and anchored to edges, such as "top-left, 16 px
  in", "bottom-right corner", or "centered, 40% wide". Containers can stack or align
  their children.
- One object stays one control. A button in the patch and in a view is the same
  runtime object, so clicking either sends the same message. This is one more
  representation of a runtime object
  ([168. Runtime Object and Editor Representations](168-runtime-object-editor-representations.md)).

Two of Max's limits are fixed rather than copied: several named views instead of
one presentation, and anchors instead of fixed pixels.

Fit with V2:

- The display list draws a widget in any coordinate space, so the same widget draws
  in the patch and in a view with no new rendering code. The controller hit-tests
  both the same way ([197](197-canvas-editor-and-dom-islands.md)).
- Perform mode is the one canvas drawn in the usual order: the output first, then
  the view's widgets as a heads-up display, with the editor passes skipped. It may
  be run mode with the editor passes hidden
  ([197](197-canvas-editor-and-dom-islands.md#edit-mode-and-run-mode)).
- DOM islands work in views too, such as a markdown note or a text field.

## Model 2: Graph-on-Parent (Pure Data-Style)

A subpatch shows selected controls inside its box on the parent canvas, like Pure
Data's Graph-on-Parent or Max's `bpatcher`.

- It depends on subpatches and abstractions
  ([167. Modular Patchies Roadmap](167-modular-patchies-roadmap.md), phase 6).
- An abstraction carries its own small interface, so reusable UI components come
  from patches instead of new object types.
- It does not put controls on the screen by itself. It complements model 1 rather
  than replacing it.

## Model 3: Windows (TouchDesigner-Style)

A chosen layout shows in its own window, on any monitor and at any size, like
TouchDesigner's Window component and Perform Mode.

- A separate UI network, TouchDesigner's full model, would mean many new object
  types and two networks to keep in sync. That is heavy for a code-first tool.
- The window part maps well. A view, or a subpatch's interface, could open:
  - full-screen over the output in the browser;
  - as a native window on any monitor in the native host
    ([201](201-rust-native-host.md));
  - as an embed on a website, such as `<patchies-output view="controls">`
    ([200](200-patchies-v2-primitives.md#embedding)).
- Several windows in the browser depend on popup windows and the Window Management
  API, whose support is uneven. Natively it is straightforward.

## One Possible Combination

Not a decision:

1. Presentation views as the base, with named views and anchors.
2. Graph-on-parent for subpatches, once subpatches exist.
3. Windows for showing a view: full-screen in the browser, native windows on any
   monitor, and embeds on websites.

`surface` stays as the escape hatch for fully custom-drawn interfaces.

## What Views Would Enable

| Where                                               | What a view gives it                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Embeds ([200](200-patchies-v2-primitives.md))       | An embedded patch shows its own controls on a website, not only its video          |
| Native host ([201](201-rust-native-host.md))        | Views open as native windows on any monitor, for installations and performances    |
| Subpatches ([167](167-modular-patchies-roadmap.md)) | An abstraction exposes its interface, giving reusable UI components                |
| Multiplayer ([204](204-multiplayer.md))             | Each performer has their own view of one shared patch                              |
| Mobile                                              | A view with large touch controls on a phone, controlling a patch running elsewhere |

## Open Questions

- Which model, or combination, should V2 build first?
- Layout model: anchors and offsets cover most cases. Responsive layout, such as
  grids and wrapping, is much more work.
- How are views edited: a mode for dragging widgets around in screen space, like
  Max's presentation editing?
- Are views part of the shared document in multiplayer, or per person?

## Related Specs

- [27. Decouple XYFlow With Graph](27-decouple-xyflow-with-graph.md): subpatches and the `p` object.
- [167. Modular Patchies Roadmap](167-modular-patchies-roadmap.md): subpatches and abstractions.
- [168. Runtime Object and Editor Representations](168-runtime-object-editor-representations.md).
- [197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md): the display list and controller.
- [203. Patchies V2 Roadmap](203-patchies-v2-roadmap.md).
