# Licenses and Attributions

Patchies is built upon many amazing open source projects. This document provides comprehensive license information and attributions for all third-party libraries and components used in Patchies.

Check out [SUPPORT.md](./SUPPORT.md) for donation links and sponsorship resources for these amazing open-source projects.

## Project License

**Patchies** is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE).

This means:

- You are free to use, modify, and distribute this software
- If you modify the code, you must share your changes under the same license
- If you run this software on a server and provide services to users, you must make the source code available to those users
- See the [AGPL-3.0 full text](./LICENSE) for complete terms

## Complete License List

This is a comprehensive list of all third-party dependencies and their licenses. For the most current list, please see the `package.json` file in the project repository.

### Runtime Dependencies

| Package                           | Version      | License                |
| --------------------------------- | ------------ | ---------------------- |
| @codemirror/autocomplete          | ^6.18.7      | MIT                    |
| @codemirror/lang-javascript       | ^6.2.4       | MIT                    |
| @codemirror/lang-markdown         | ^6.3.4       | MIT                    |
| @codemirror/lang-python           | ^6.2.1       | MIT                    |
| @codemirror/language              | ^6.11.2      | MIT                    |
| @codemirror/state                 | ^6.5.2       | MIT                    |
| @codemirror/theme-one-dark        | ^6.1.3       | MIT                    |
| @codemirror/view                  | ^6.38.1      | MIT                    |
| @csound/browser                   | ^7.0.0-beta8 | LGPL-2.1               |
| @elemaudio/core                   | ^4.0.1       | MIT                    |
| @elemaudio/web-renderer           | ^4.0.3       | MIT                    |
| @google/genai                     | ^1.11.0      | Apache-2.0             |
| @iconify/svelte                   | ^5.0.0       | MIT                    |
| @lezer/generator                  | ^1.8.0       | MIT                    |
| @lezer/highlight                  | ^1.2.1       | MIT                    |
| @replit/codemirror-vim            | ^6.3.0       | MIT                    |
| @rollup/browser                   | ^4.50.1      | MIT                    |
| @strudel/\*                       | ^1.2.2+      | **AGPL-3.0-or-later**  |
| @sveltejs/adapter-cloudflare      | ^7.0.0       | MIT                    |
| @sveltejs/adapter-static          | ^3.0.8       | MIT                    |
| @sveltejs/kit                     | ^2.22.0      | MIT                    |
| @uiw/codemirror-theme-tokyo-night | ^4.24.2      | MIT                    |
| @xyflow/svelte                    | ^1.2.2       | MIT                    |
| butterchurn                       | ^2.6.7       | MIT                    |
| butterchurn-presets               | ^2.4.7       | MIT                    |
| codemirror                        | ^6.0.2       | MIT                    |
| expr-eval                         | ^2.0.2       | MIT                    |
| fuse.js                           | ^7.1.0       | Apache-2.0             |
| highlight.js                      | ^11.11.1     | BSD-3-Clause           |
| hydra-ts                          | ^1.0.0       | MIT                    |
| json5                             | ^2.2.3       | MIT                    |
| lezer-glsl                        | ^0.6.0       | MIT                    |
| lodash                            | ^4.17.21     | MIT                    |
| marked                            | ^16.1.2      | MIT                    |
| matter-js                         | ^0.20.0      | MIT                    |
| memfs                             | ^4.39.0      | MIT                    |
| meyda                             | ^5.6.3       | MIT                    |
| ml5                               | ^1.2.1       | MIT                    |
| mode-watcher                      | 0.5.1        | MIT                    |
| ohash                             | ^2.0.11      | MIT                    |
| overtype                          | ^1.1.1       | MIT                    |
| p2pkit                            | ^0.0.0-2     | MIT                    |
| p2pt                              | ^1.5.1       | MIT                    |
| p5                                | ^1.11.9      | LGPL-2.1               |
| pocketbase                        | ^0.26.2      | MIT                    |
| pyodide                           | ^0.28.1      | Apache-2.0             |
| regl                              | ^2.1.1       | MIT                    |
| stats.js                          | ^0.17.0      | MIT                    |
| supersonic-scsynth                | ^0.25.5      | Tiered (MIT + GPL-3.0) |
| textmode.js                       | ^1.0.0       | MIT                    |
| three                             | ^0.172.0     | MIT                    |
| tone                              | ^15.1.22     | MIT                    |
| ts-pattern                        | ^5.8.0       | MIT                    |
| uxn.wasm                          | ^0.9.0       | MIT                    |
| vite-plugin-static-copy           | ^3.1.1       | MIT                    |
| webchuck                          | ^1.2.10      | Apache-2.0             |
| webmidi                           | ^3.1.12      | Apache-2.0             |

### Ported/Adapted Code

#### Orca

The Orca node in Patchies is based on the [Orca livecoding environment](https://github.com/hundredrabbits/Orca) by [Hundred Rabbits](https://100r.co).

- **Original Project**: Orca - Esoteric Programming Language
- **Authors**: Hundred Rabbits (Devine Lu Linvega and Rekka Bellum)
- **Repository**: <https://github.com/hundredrabbits/Orca>
- **License**: MIT
- **Copyright**: © Hundred Rabbits

The following components were ported from the original Orca desktop implementation:

- Core modules are copied as-is: `Orca.ts`, `Operator.ts`, `library.ts`, `Clock.ts`, `transpose.ts`
- MIDI/IO system and renderer are rewritten to fit Patchies: `MidiMessageHandler.ts`, `CCMessageHandler.ts`, `MonoMessageHandler.ts`, `IO.ts`, `OrcaRenderer.ts`

All ported code has been properly attributed with license headers in each source file.

#### Uxn

The Uxn node in Patchies contains a port of the [uxn5 emulator](https://git.sr.ht/~rabbits/uxn5) by [Hundred Rabbits](https://100r.co).

- **Original Project**: uxn5 - Uxn Virtual Machine Emulator
- **Authors**: Devine Lu Linvega
- **Repository**: <https://git.sr.ht/~rabbits/uxn5>
- **License**: MIT
- **Copyright**: © 2020 Devine Lu Linvega

The emulator was ported to work within the Patchies patcher environment with integration for video chaining and message passing. The original MIT license is preserved in the source files.

#### Superdough (Package Patch)

Patchies uses a patched version of [Superdough](https://codeberg.org/uzu/strudel), which is part of the Strudel ecosystem.

- **Original Project**: Superdough - Audio synthesis engine for Strudel
- **Authors**: Felix Roos and Strudel contributors
- **Repository**: <https://codeberg.org/uzu/strudel>
- **License**: AGPL-3.0
- **Package Version**: 1.2.3 (patched)
- **Patch File**: `ui/patches/superdough@1.2.3.patch`

The package patch makes minor modifications to expose internal audio nodes for integration with Patchies' audio system:

- Exposes the destination gain node as `window.SuperdoughDestinationGain` for volume control
- Exposes audio node chains as `window.strudelNodes` and returns them for connectivity with other Patchies audio objects

These modifications enable seamless integration between Strudel's audio engine and Patchies' audio chaining system while maintaining full compatibility with the AGPL-3.0 license.

### Source Code Access

The complete source code for Patchies is available on [GitHub](https://github.com/heypoom/patchies)

### What this means for users

1. **For personal use**: You can use Patchies freely without any restrictions
2. **For modifications**: If you modify Patchies code, you must share your changes under AGPL-3.0
3. **For web services**: If you host Patchies as a service and modify it, you must provide source code to your users
4. **For redistribution**: You can redistribute Patchies but must include the license and attribution notices
