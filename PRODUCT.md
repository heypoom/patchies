# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users today are creative coders and artists working in the Patchies
browser editor. They use it to explore ideas, make audio-visual and computational
works, and learn through direct experimentation.

Developers building custom patchers and extensions are a future audience in the
modular Patchies roadmap. They are not yet the primary users of the current
product.

## Product Purpose

Patchies is a playful medium for working with computation and computational
models. It lets people explore difficult or abstract topics, including
algorithms and mathematics, by making them interactive, visible, audible, and
open to creative play.

The product brings creative-coding tools into one browser-based patching
environment. Users write small programs, connect them with visual objects, and
experience the message, audio, video, and computational flows between them.
Success means that people can move from curiosity to a working, playable
experiment without having to build an entire application around each idea.

## Positioning

Patchies is a code-first creative-patching environment and emerging runtime and
object ecosystem. It combines textual coding with visual patching across audio,
visuals, computation, hardware, and the web.

Unlike an environment built only from tiny fixed operators or one long source
file, Patchies encourages compact programs connected as a visible composition.
The graph exposes the shape of the system and its intermediate results while
each object can retain the expressive power of a familiar creative-coding
library, language, or runtime.

Its wider direction is to make computational models playable: not only programs
to execute or diagrams to inspect, but systems people can touch, remix, listen
to, watch, and learn through.

## Operating Context

- The current product runs as a browser editor at `patchies.app`.
- People work on a visual canvas by creating objects, editing compact code or
  parameters, and connecting objects into message, audio, and video flows.
- Demos, documentation, object references, Sparks prompts, presets, and object
  packs help people begin or explore unfamiliar tools.
- Patches can be saved locally, exported or loaded as patch data, and shared by
  link.
- The environment connects established creative-coding tools and libraries
  rather than requiring one exclusive language or medium.

## Capabilities and Constraints

Current capabilities include:

- message and control flow;
- audio synthesis, processing, analysis, and musical scheduling;
- video synthesis, graphics, shaders, rendering, and media processing;
- JavaScript, web workers, virtual machines, and other computational runtimes;
- MIDI, serial, DMX, networking, peer-to-peer media, and browser APIs;
- presets, object packs, local patch persistence, sharing, documentation, and
  profiling;
- built-in AI-assisted creation with user-provided provider credentials.

The default browser editor is the current product surface and source of truth
for today’s user experience.

The headless runtime, dynamic extensions, custom host patchers, external agent
authoring, embeddable components, live collaboration, and expanded self-hosting
model are aligned long-term explorations. They are not promises of current
product behavior. Specs 167, 169, and 170 describe this modular direction, with
parts of the runtime separation currently in development.

Subpatches, shared abstraction libraries, unrestricted dynamic plugin loading,
and a stable public custom-patcher API are not yet available as finished product
contracts.

## Brand Commitments

- The product name is **Patchies** and the public site is `patchies.app`.
- Patchies should feel playful, curious, experimental, welcoming, and
  technically expressive.
- The voice is informal and encouraging without hiding technical depth.
- The product is code-first while remaining approachable through direct
  manipulation, demos, documentation, and visible feedback.
- Patchies is currently open source, AGPL-licensed, and free to use.
- Existing identity assets include `ui/static/favicon.svg`,
  `ui/static/icon-512.png`, `docs/images/patchies-v4-hero.webp`, and
  `docs/images/patchies-random-walker.png`.

## Evidence on Hand

- `README.md` contains the current public description, capability examples,
  onboarding paths, community links, license statement, and product imagery.
- `ui/static/content/` contains tutorials and object documentation for the
  current product.
- `ui/static/example-patches.json`, built-in presets, object packs, and help
  patches provide real demonstrations.
- `docs/design-docs/specs/167-modular-patchies-roadmap.md`,
  `169-build-your-own-patcher-vision.md`, and
  `170-agent-extensible-patchies-vision.md` record the modular long-term
  direction.
- `/Users/poom/Notes/Wiki/Components and Primitives of Patchies.md` distinguishes
  existing capabilities, work in development, and long-term ideas.

No testimonials, customer roster, usage benchmarks, pricing model, or formal
accessibility certification are established here. Future product work must not
invent them.

## Product Principles

1. Make computation playable. Help people understand systems by changing,
   combining, observing, hearing, and performing them.
2. Let text and patches strengthen each other. Keep code compact and expressive
   while the graph reveals composition and intermediate results.
3. Connect the creative-coding ecosystem. Let people combine familiar
   libraries, languages, media, devices, and protocols in one environment.
4. Serve today’s creative coders before presenting future platform work as
   finished. Preserve a coherent browser-editor experience while the modular
   runtime develops.
5. Keep experimentation legible and resilient. Patches and future extensions
   should be inspectable, remixable, and clear about what is stable versus
   experimental.
