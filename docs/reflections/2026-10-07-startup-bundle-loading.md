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

The next batch moved Spectrum registration behind opening a settings color picker and reused the same loader for inline editor widgets. The picker displays loading and retry states. The browser Tailwind compiler and CSS sources now load when a DOM/Vue container enables Tailwind; container creation remains synchronous, and disabling during loading prevents stale stylesheet or observer installation.

This reduced the static page graph from 7,808,276 to 6,916,930 bytes, another 891,346 bytes (11.4%). The combined reduction from the original report is 36.1%. The main page chunk is now 5,364,023 bytes. These remain uncompressed build sizes, not measured network transfer savings.

Five focused Chrome browser tests cover desktop/mobile picker edits, failed-download retry, shadow-style updates, and disabling/re-enabling during initialization. Production Firefox again verified no Spectrum, Tailwind, Greggman, or Butterchurn requests at startup, correct enabled archive loading, and no uncaught runtime errors. Build, type checking, formatting, and Svelte autofixer checks passed. Targeted ESLint reported only the existing unused `findInlineValueWidgets` import.

The editor batch moved shared CodeMirror setup behind a lightweight CodeEditor entry. It preserves reactive props, cursor insertion, readiness callbacks, and undo commits, and cancels delayed language/Vim initialization after destruction. Assembly uses a lazy editor implementation; Strudel loads CodeMirror APIs inside its existing async editor lifecycle. Expression and ChucK keymaps load only with the editor. Patchbay range analysis/tokenization now lives in a pure module, with completion extensions loaded on demand in inline, sidebar, and detached editors. AI text/image editors use the existing line-wrap option instead of importing EditorView.

This reduced the static graph from 6,916,930 to 6,385,469 bytes, another 531,461 bytes (7.7%). The combined reduction from the original graph is 41.0%, and the largest page chunk is 4,832,560 bytes. CodeMirror's view implementation, shared editor implementation, and Assembly editor implementation are outside the static startup graph.

Ten Chrome component tests and 29 focused unit tests passed, covering cursor insertion, external values, deferred extension keymaps/retry, editor cancellation, Assembly callbacks, detached undo commits, and Patchbay completion/range behavior. The production Chrome check verified empty and restored slider/expression patches request no editor implementation at startup. Opening the expression loads the editor once, focuses it, restores the original expression on Escape, and persists changes on Shift+Enter, with no uncaught errors. Build, type checking, and touched-source formatting passed. New/extracted implementation files pass ESLint; the tracked-file comparison found 19 existing errors and no added diagnostics.

A full visual-node registry split needs further runtime work. Several components still register message callbacks during mounting, while headless nodes can emit startup messages before a lazy interface finishes downloading. Keep those node mounts synchronous until component loading and runtime activation are coordinated. This avoids trading download savings for lost startup messages.

## What Could Be Better

The largest remaining page chunk is 4.83 MB. The static node registry still imports all node components, which bring their view implementations and settings panels. Individual icon imports remove the development barrels, but development download sizes have not been remeasured.

## Action Items

- Coordinate component readiness with runtime activation before splitting the node registry, including initial messages, patch restoration, paste, and viewport culling.
- Defer help rendering and its Markdown/KaTeX dependencies until help or rendered chat content is needed.
- Repeat the cold-start throttled browser report after the next batch, including worker resources separately.
