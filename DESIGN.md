---
name: Patchies
description: Quiet editor instruments around a playful canvas for computation
colors:
  canvas-ink: "#000000"
  ink: "#080809"
  panel-ink: "#09090b"
  surface: "#18181b"
  surface-active: "#27272a"
  boundary: "#3f3f46"
  text-muted: "#71717a"
  text-secondary: "#a1a1aa"
  text-primary: "#e4e4e7"
  text-strong: "#f4f4f5"
  ember: "#f97316"
  ember-bright: "#fb923c"
  signal-blue: "#2563eb"
  signal-green: "#22c55e"
  signal-red: "#ef4444"
  running-pink: "#ec4899"
typography:
  headline:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.05em"
  code:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  micro: "3px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.surface-active}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px"
    size: "32px"
  input-compact:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.code}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
    height: "32px"
  node-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  node-selected:
    backgroundColor: "{colors.surface-active}"
    textColor: "{colors.text-strong}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
---

# Design System: Patchies

## Overview

**Creative North Star: "Playable Circuits"**

Patchies is a dark, precise, technical, playful, and quietly expressive creative
environment. The editor behaves like a set of dependable instruments around an
open stage: controls are legible and tactile, but the patch, its media, and the
user's computation carry the visual energy.

The infinite canvas is minimal Ink rather than a branded backdrop. Editor chrome
uses close steps of black and zinc, compact spacing, fine boundaries, and
state-driven color. Ember appears as a deliberate creative signal, not a wash
over every surface. This restraint lets vivid video, graphics, code, waveforms,
and patch topology shine without competing with the application shell.

Glass is a limited treatment for genuinely floating UI whose backdrop changes
infrequently. Opaque or nearly opaque surfaces are the default, especially over
live canvas output. The onboarding modal may be more playful than the editor,
but it must still feel authored rather than decorated from a generic template.

**Key Characteristics:**

- Content-first hierarchy on a minimal Ink canvas.
- Quiet, precise, compact controls that feel like creative instruments.
- Zinc tonal layering with Ember used sparingly for attention and activation.
- Monospace labels for commands, object names, values, and technical metadata.
- Glass and glow reserved for meaningful depth or state, never ambient excess.

The current startup, object-browser, settings, AI-settings, documentation, and
Sparks surfaces are provisional redesign candidates. Their ornamental corner
brackets and Instrument Serif plus Syne pairing are not design-system authority.
The sidebar and command palette are usable evidence but remain open to
refinement.

## Colors

The palette is an Ink-and-zinc instrument panel with one warm Ember signal and a
small set of semantic runtime colors.

### Primary

- **Ember** (`#f97316`): Creative activation, selected navigation, important
  focus, and occasional onboarding emphasis. It should occupy a small fraction
  of an editor screen.
- **Bright Ember** (`#fb923c`): Hover or lifted emphasis for an existing Ember
  affordance, not a second competing accent.

### Secondary

- **Signal Blue** (`#2563eb`): Connection modes, navigational activity, and
  informational state.
- **Signal Green** (`#22c55e`): Successful, enabled, or actively processing
  state.
- **Signal Red** (`#ef4444`): Errors and destructive actions.
- **Running Pink** (`#ec4899`): Live execution or automated runtime state where
  it must remain distinct from success.

### Neutral

- **Canvas Ink** (`#000000`): The infinite canvas and the deepest output stage.
- **Ink** (`#080809`): Application background and dense overlay foundation.
- **Panel Ink** (`#09090b`): Sidebars and contained panels.
- **Surface Zinc** (`#18181b`): Nodes, menus, and raised controls.
- **Active Zinc** (`#27272a`): Selected nodes, hovered rows, and active fields.
- **Boundary Zinc** (`#3f3f46`): Strong but quiet component boundaries.
- **Muted Zinc** (`#71717a`): Secondary labels and inactive icons.
- **Secondary Text** (`#a1a1aa`): Supporting copy and readable metadata.
- **Primary Text** (`#e4e4e7`): Normal high-importance interface text.
- **Strong Text** (`#f4f4f5`): Titles and selected content.

### Named Rules

**The Content Is the Color Rule.** The editor stays neutral so the user's patch,
media, and runtime states can own the saturated color.

**The Ember Earns Attention Rule.** Use Ember for a meaningful focus, selection,
or creative action; never use it as continuous decoration across the editor.

## Typography

**Display Font:** IBM Plex Sans (with system sans-serif fallback)
**Body Font:** IBM Plex Sans (with system sans-serif fallback)
**Label/Mono Font:** IBM Plex Mono (with system monospace fallback)

**Character:** The canonical editor pairing is one practical sans-serif family
with a technical mono companion. It should feel engineered without becoming
sterile. Expressive typography may be introduced for a redesigned onboarding
experience, but it must be chosen intentionally for Patchies rather than
inherited from the provisional Instrument Serif and Syne treatment.

### Hierarchy

- **Headline** (600, `2rem`, 1.15): Major documentation or onboarding headings
  when a surface genuinely needs editorial hierarchy.
- **Title** (600, `1.125rem`, 1.3): Dialog, panel, and section titles.
- **Body** (400, `0.9375rem`, 1.6): Guidance, descriptions, and readable prose.
  Long reading surfaces should stay near 65–75 characters per line.
- **Label** (500, `0.6875rem`, 1.4, `0.05em`): Compact controls, categories,
  shortcuts, and metadata. Uppercase is reserved for short structural labels.
- **Code** (400, `0.75rem`, 1.5): Object names, parameters, code, values, and
  patch-native language.

### Named Rules

**The Instrument Type Rule.** Use IBM Plex Sans for human-readable interface
language and IBM Plex Mono where exact values, commands, or computational
identity matter.

## Layout

The editor is an infinite canvas with tools at its edges, not a dashboard made
of equal panels. The canvas takes all available space. Nodes size to their
content, use compact internal spacing, and leave topology visible between them.

The primary sidebar is full-height, opaque Panel Ink with a one-pixel boundary.
It defaults to `256px`, resizes from `180px` to `1000px`, and becomes a full-width
mobile surface. Floating toolbars sit close to viewport edges, group
`32px`-scale icon buttons with `4px` gaps, and respect safe areas.

Use the observed 4, 8, 12, 16, 24, and 28px rhythm. Dense operational UI should
favor the first four steps; onboarding and reading surfaces may use the larger
steps. At `640px`, full-height modal surfaces may become centered cards. At
`768px`, desktop sidebars and edge-mounted tool layouts replace mobile
drawers/full-width surfaces.

Keep fixed overlays bounded. A modal should use at most the viewport minus a
small safe margin, keep its important action reachable, and allow its body—not
the whole page behind it—to scroll.

## Elevation & Depth

Patchies is flat by default and gains depth through tonal steps, fine borders,
and state. Nodes use a subtle white glow only on hover or selection. Menus and
floating controls may use a compact shadow to separate from the canvas.
Backdrop blur is exceptional because live video, WebGL, and canvas output can
make it expensive; use it only where the content behind the surface changes
infrequently and a non-blurred tonal surface cannot communicate the layer.

### Shadow Vocabulary

- **Node hover** (`0 0 15px rgba(255,255,255,0.08), 0 0 45px
  rgba(255,255,255,0.05)`): A faint proximity response around a node.
- **Node selected** (`0 0 15px rgba(255,255,255,0.17), 0 0 45px
  rgba(255,255,255,0.10)`): Confirms selection without introducing a new hue.
- **Floating control** (`0 10px 30px rgba(0,0,0,0.35)`): Separates a menu,
  tooltip, or palette from the canvas when tonal contrast is insufficient.

### Named Rules

**The Stable Glass Rule.** Blur only a floating layer over mostly stable
content; never blur large persistent surfaces over live or animated canvas
output.

**The State Creates Depth Rule.** Resting surfaces remain flat. Glow and stronger
shadow appear in response to hover, focus, selection, or an open overlay.

## Shapes

The form language uses compact rounded rectangles and circular handles. Micro
chips use `3px` corners, controls use `6–8px`, and nodes use `10px`. Pills are
reserved for switches, status, or inherently continuous controls rather than
used as the default silhouette.

Borders are usually one pixel and low contrast. Selection strengthens the
boundary before adding glow. Avoid ornamental corner brackets, arbitrary
cutouts, or sci-fi decoration that does not communicate state or structure.

## Components

Components feel like quiet, precise instruments: small targets remain usable,
states are visible, and decoration never competes with patch content.

### Buttons

- **Shape:** Compact rounded rectangle (`6px`), normally `32–36px` high.
- **Primary:** Light zinc fill with dark zinc text, medium weight, and
  `8px 16px` padding. Reserve for the clearest action in a contained workflow.
- **Hover / Focus:** Small tonal shift on hover; a visible three-pixel
  low-opacity focus ring. Do not remove focus treatment.
- **Ghost / Icon:** Transparent or `rgba(24,24,27,0.7)` at rest, `#3f3f46` on
  hover, with a `16px` icon and `8px` padding.
- **Semantic:** Destructive, connection, AI, and runtime actions may use their
  semantic color only while that state is relevant.

### Chips

- **Style:** Compact mono labels with `3px` corners, a one-pixel boundary, and
  `3px 9px` padding.
- **State:** Neutral by default. Ember may mark a selected creative category;
  state colors may identify runtime types.

### Cards / Containers

- **Corner Style:** `8–10px` for panels and nodes.
- **Background:** Opaque Surface Zinc or Panel Ink is the default.
- **Shadow Strategy:** Flat at rest; refer to the state-driven elevation rules.
- **Border:** One-pixel zinc or low-opacity white boundary.
- **Internal Padding:** `12–16px` for operational cards; up to `24px` for
  onboarding or reading surfaces.

### Inputs / Fields

- **Style:** Dark zinc fill or transparent fill on a dark surface, one-pixel
  boundary, `6px` corners, and IBM Plex Mono for values or object syntax.
- **Focus:** Boundary shifts toward a strong neutral or Ember when the field is
  a creative entry point; keep the visible focus ring.
- **Error / Disabled:** Signal Red for invalid state. Disabled controls retain
  legibility at reduced opacity and use a not-allowed cursor.

### Navigation

Navigation is compact and icon-led in the editor. Default items use Muted Zinc,
hovered items gain one tonal step, and active items use Active Zinc plus Primary
Text. Ember is appropriate for a singular active location in reading or
onboarding surfaces, not every selected editor control.

### Patch Nodes

Patch nodes are the signature component. They use Surface Zinc, a Boundary Zinc
stroke, `10px` corners, IBM Plex Mono at `12px`, and content-driven width. Hover
adds the faint glow. Selection shifts to Active Zinc, strengthens the boundary
to Secondary Text, and uses the medium glow. Port and runtime colors communicate
types and state without recoloring the whole node.

### Sidebars and Floating Surfaces

The sidebar stays opaque because it covers a potentially animated canvas and
may remain open for long sessions. Small transient menus, tooltips, and command
palettes may use restrained translucency or blur when performance is safe.
Floating surfaces must remain legible when the patch behind them is extremely
bright or visually noisy.

## Do's and Don'ts

### Do:

- **Do** let user-created graphics, video, waveforms, and patch structure carry
  the screen's strongest color.
- **Do** use close Ink and zinc tonal steps, fine borders, and compact spacing to
  organize editor chrome.
- **Do** reserve Ember for meaningful focus, selection, and creative activation.
- **Do** use IBM Plex Mono for object syntax, values, shortcuts, and technical
  metadata.
- **Do** make hover, focus, selected, running, error, and disabled states
  distinguishable without relying on shape alone.
- **Do** give a redesigned onboarding experience permission to be more playful
  than the editor while keeping the editor itself quiet.

### Don't:

- **Don't** turn the infinite canvas into a decorative branded background.
- **Don't** put persistent backdrop blur over live canvas, video, WebGL, or other
  frequently changing content.
- **Don't** spread Ember across large surfaces or use saturated gradients as
  editor chrome.
- **Don't** propagate the current ornamental modal corners or the Instrument
  Serif plus Syne pairing as canonical Patchies identity.
- **Don't** use the current startup, object-browser, settings, AI-settings, docs,
  or Sparks presentation as unquestioned design-system authority.
- **Don't** let floating UI become unreadable over bright or high-motion user
  content.
