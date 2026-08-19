# 41. Load Patch by URL

When the URL parameter `?src=` is present, load the patch from the specified URL.

Example: `https://patchies.app/?src=https://files.poom.dev/patches/patch.json`

Bundled demos use the same contract. Each demo is a standalone JSON file in
`ui/static/demos/`, and links use a same-origin source URL such as
`/?src=/demos/random-walk-world.json`. This keeps demos reviewable as ordinary
files and lets the frontend load them without requiring a PocketBase record.
Demo filenames are stable, lowercase, human-readable slugs; they are listed in
`ui/static/example-patches.json` as `slug` values.
