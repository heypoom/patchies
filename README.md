# Patchies.app: creative coding patcher in the browser

<a href="https://patchies.app/?demo=random-walk-world"><img src="./docs/images/patchies-random-walker.png" alt="Random walk with hydra shader" width="700"></a>

> Try out [the above demo](https://patchies.app/?demo=random-walk-world) which uses P5.js with Hydra to create a random walk shader.

Patchies is a code-first patcher for exploring computation through audio, visual, hardware and more.

It's made for creative coding: patch objects and code snippets together to explore visualizations, soundscapes and computations 🎨

Ready to try Patchies? [Let's get started.](#get-started)

## Use tools and libraries you love

Patchies lets you use the audio, visual and computational tools and libraries that you know (and love!), together in one place. For example:

- Create interactive graphics with [P5.js](https://patchies.app/docs/objects/p5), [Three.js](https://patchies.app/docs/objects/three), [HTML5 Canvas](https://patchies.app/docs/objects/canvas) and [Textmode.js](https://patchies.app/docs/objects/textmode)
- Synthesize and process video with [Hydra](https://patchies.app/docs/objects/hydra), [Shader Park](https://patchies.app/docs/objects/shaderpark) and [GLSL shaders](https://patchies.app/docs/objects/glsl)
- Live code music with [Strudel](https://patchies.app/docs/objects/strudel), [ChucK](https://patchies.app/docs/objects/chuck~), [SuperSonic](https://patchies.app/docs/objects/sonic~), [Bytebeat](https://patchies.app/docs/objects/bytebeat~), [Csound](https://patchies.app/docs/objects/csound~) and [Orca](https://patchies.app/docs/objects/orca)
- Synthesize audio with [Pure Data-style](https://patchies.app/docs/audio-chaining) objects, [Tone.js](https://patchies.app/docs/objects/tone~) and [Elementary Audio](https://patchies.app/docs/objects/elem~)
- Run programs and games on the [Uxn](https://patchies.app/docs/objects/uxn) virtual machine and write your own with [Uxntal](https://wiki.xxiivv.com/site/uxntal.html) programs.
- Compute like a witch with [Assembly](https://patchies.app/docs/objects/asm) and [Uiua](https://patchies.app/docs/objects/uiua), or like a wizard with [Ruby](https://patchies.app/docs/objects/ruby) and [Python](https://patchies.app/docs/objects/python)
- Connect to the outside world with [MIDI](https://patchies.app/docs/objects/midi.in), [MQTT](https://patchies.app/docs/objects/mqtt), [SSE](https://patchies.app/docs/objects/sse), [WebRTC](https://patchies.app/docs/objects/netsend), [Iframe](https://patchies.app/docs/objects/iframe) and [VDO.Ninja](https://patchies.app/docs/objects/vdo.ninja.push).
- Manage [data and control flow](https://patchies.app/docs/message-passing) with [js](https://patchies.app/docs/objects/js), [expr](https://patchies.app/docs/objects/expr), [filter](https://patchies.app/docs/objects/filter), [map](https://patchies.app/docs/objects/map), [iframe](https://patchies.app/docs/objects/iframe), [spigot](https://patchies.app/docs/objects/spigot), [trigger](https://patchies.app/docs/objects/trigger) and more.
- Use built-in widgets or make your own with [Vue.js](https://patchies.app/docs/objects/vue), [DOM API](https://patchies.app/docs/objects/dom), [Tailwind](https://tailwindcss.com) or any library you like.
- Use any [third party JavaScript library](https://patchies.app/docs/javascript-runner) via [esm.sh](https://esm.sh).

## ...by patching them together ✨

Patchies is designed to mix textual coding and visual patching, using the best of both worlds. Instead of writing long chunks of code or patching together a huge web of small objects, Patchies encourages you to write small and compact programs and patch 'em together.

Patching is a _visual_ way to program by connecting objects together. Each object does something e.g. generate sound, generate visual, compute some values. Connect the output of one object to the input of another object to create a flow of data.

You can the program's composition and in-between results such as audio, video and message flows, using tools you're already familiar with that lets you do a lot with a bit of code. This is done through [Message Passing](https://patchies.app/docs/message-passing), [Video Chaining](https://patchies.app/docs/video-chaining) and [Audio Chaining](https://patchies.app/docs/audio-chaining). They're heavily inspired by tools like Max, Pd, TouchDesigner and VVVV.

> "What I cannot create, I do not understand. Know how to solve every problem that has been solved." - Richard Feynman

## Get started

<a href="https://patchies.app"><img src="./docs/images/startup-modal.webp" alt="Patchies getting started screen" width="700"></a>

Choose the option that works for you:

1. **Use the hosted app:** Open [patchies.app](https://patchies.app) and get patching.
2. **Host Patchies with Docker.** Run the [published Docker image](https://hub.docker.com/r/phoomparin/patchies), or build the included Dockerfile yourself:

   ```bash
   docker run --rm -p 8090:8090 -v patchies-data:/app/pb_data phoomparin/patchies:latest

   # Or build locally first
   just docker-build
   docker run --rm -p 8090:8090 -v patchies-data:/app/pb_data patchies
   ```

   Then open [http://localhost:8090](http://localhost:8090). The `patchies-data` volume keeps your PocketBase data between container runs.

3. **Build and run a single binary.** With Bun, Go, and [just](https://github.com/casey/just) installed, build the bundled frontend and server into one executable:

   ```bash
   just build

   # Store data and SQLite database in this directory
   PATCHIES_DATA_DIR=./patchies-data

   ./patchies serve --http=0.0.0.0:8090
   ```

   Then open [http://localhost:8090](http://localhost:8090). Patchies is built with Pocketbase and writes to a single SQLite database file.

### Helpful Links

- Play with the [demos](https://patchies.app/?startup=demos) to see what you can make with Patchies.
- Skim the [docs](https://patchies.app/docs/adding-objects) for tutorials and object references.
- No idea what to make? Open [sparks](https://patchies.app/?startup=sparks) to generate patch ideas.
- Follow the [Instagram](https://www.instagram.com/patchiesapp) for demos, inspirations and tutorials.
- Join the [Discord](https://discord.gg/PpccRb2XjE) to share your creations, ask for help and chat with other patchers.

## Development

See [DEVELOPMENT.md in docs](./docs/DEVELOPMENT.md) for how to develop Patchies locally.

## Thanks

Patchies is open source, [AGPL-licensed](https://github.com/heypoom/patchies/blob/main/LICENSE). You're more than welcome to use it in your AGPL-licensed projects, or fork it and make it your own.

Patchies is only possible because of the generosity of open source library developers who made it possible! If you enjoyed using Patchies, it would make my day if you can go and support them 🧡

Please check out the [thanks tab](https://patchies.app/?startup=thanks) which contains the direct links to support all the amazing people who helped play a part in bringing Patchies to life through their code and support.
