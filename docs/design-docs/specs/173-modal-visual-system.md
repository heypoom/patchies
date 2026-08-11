# 173. Modal Visual System

## Summary

Create one restrained modal visual system for Patchies' high-visibility editor
surfaces: startup, settings, object browser, patch save/load/export/new/delete
dialogs, and AI provider/API-key dialogs. Preserve each surface's content,
actions, and behavior; this work changes the presentation and shared dialog
primitives only.

## Motivation

The current surfaces share a dark theme but not one coherent modal language.
Some use blue confirmation buttons, some use orange ornamental corners and
ambient glows, and others use generic card styling. This makes an interruption
feel visually unrelated to the editor it covers.

## Design Direction

- Modal bodies are opaque Ink/Zinc surfaces so live graphics and canvas output
  cannot compromise readability.
- Backdrops use a dark scrim with at most a minimal blur. Blur is not a
  full-screen default because the patch canvas can be animated and expensive.
- Use IBM Plex Sans for titles and human-readable copy; reserve IBM Plex Mono
  for shortcuts, values, object names, and compact technical labels.
- Use a 12px radius, fine neutral border, offset soft shadow, consistent close
  affordance, and clear keyboard focus. Normal primary actions use a light
  zinc control; semantic warning/destructive states retain their color.
- The startup modal inherits this foundation but may contain one bounded,
  expressive Patchies-specific moment. It must not use ornamental corner
  brackets or a modal-wide ambient glow to create personality.

## Scope

- Update the shared Bits UI dialog primitives first, so standard patch and API
  dialogs converge automatically.
- Migrate the custom startup, settings, and object-browser shells to the same
  surfaces, elevation, type, mobile margins, and restrained backdrop.
- Preserve modal-specific navigation, content, and data. Onboarding content
  sequencing is intentionally deferred.

## Non-Goals

- No redesign of onboarding information architecture or demo curation.
- No new persistence or modal behavior.
- No broad blur or glass treatment over the editor canvas.

## Verification

- Inspect the startup, settings, object browser, one standard confirmation
  dialog, and the API-key dialog at desktop and narrow mobile widths.
- Verify visible focus, readable text over an active canvas, destructive and
  disabled states, Escape/close behavior, and no horizontal overflow.
