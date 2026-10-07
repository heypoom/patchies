# Startup Bundle Loading

## Objective

Reduce initial downloads identified in the October 7 production and development reports, starting with large preset payloads and optional libraries pulled in by shared helpers.

## Key Challenges & Solutions

- The Greggman pack was disabled by default but both pack metadata and the preset library eagerly imported its formulas. Split generated folder metadata from the formula payload, and publish formulas into the built-in library only when an enabled pack is needed by the object browser or object autocomplete.
- Shared Vite preload and CommonJS helpers lived in the CodeMirror and Butterchurn chunks. Move them into a neutral 2.5 kB runtime chunk and use explicit manual chunk membership.
- Broad CodeMirror and Strudel chunk rules joined independently loaded features with shared editor dependencies. Remove those package-family rules so Rollup can preserve the dynamic boundaries.
- Two Lucide barrels made Vite optimize the complete icon catalogue in development. Replace runtime barrel imports with individual icon paths, preserving aliases and type-only imports.
- MediaBunny was imported with the player module even before a video source existed. Import the decoder library when loading a file or URL, keeping synchronous player construction and discarding loads canceled during the import.

The production page's static JavaScript import graph shrank from 10,827,127 to 7,808,276 bytes (27.9%). This measures the same page graph, not total browser traffic or compressed transfer sizes. Greggman's 1.34 MB formula chunk and Butterchurn's 913 kB chunk are absent from that graph.

A production Firefox check verified zero Greggman requests at startup with the pack enabled or disabled. Opening the object browser requested the enabled archive once and did not request the disabled archive. Both cases produced no uncaught runtime errors. Type checking and 39 focused tests passed. Formatting passed; all 199 ESLint findings in touched files were also present in HEAD.

## What Could Be Better

The largest remaining page chunk is 6.26 MB. The static node registry still imports all node components, which bring editor implementations, settings controls, Spectrum themes, and the browser Tailwind compiler. Individual icon imports remove the development barrels, but development download sizes have not been remeasured.

## Action Items

- Introduce component loading boundaries for node implementations and editors without delaying handle metadata or changing node lifecycle behavior.
- Load Spectrum controls and the browser Tailwind compiler only when their features are used.
- Defer help rendering and its Markdown/KaTeX dependencies until help or rendered chat content is needed.
- Repeat the cold-start throttled browser report after the next batch, including worker resources separately.
