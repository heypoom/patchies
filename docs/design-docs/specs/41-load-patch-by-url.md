# 41. Load Patch by URL

When the URL parameter `?src=` is present, load the patch from the specified URL.

Example: `https://patchies.app/?src=https://files.poom.dev/patches/patch.json`

Bundled demos use the same contract. Each demo is a standalone JSON file in
`ui/static/demos/`, and links use a same-origin source URL such as
`/?src=/demos/random-walk-world.json`. This keeps demos reviewable as ordinary
files and lets the frontend load them without requiring a PocketBase record.
Demo filenames are stable, lowercase, human-readable slugs; they are listed in
`ui/static/example-patches.json` as `slug` values.

Source patches use the same confirmation and read-only session as `?id=`
shared patches. Their `src` parameter remains in the URL after loading, and is
removed only when the user cancels, creates a new patch, loads a saved local
patch through the Saves sidebar, or explicitly saves a local copy.

All bundled documentation examples use `?src=/demos/<slug>.json`; they do not
depend on PocketBase records that are absent from a new self-hosted instance.
