# Patchies.app: creative coding patcher in the browser

<img src="./docs/images/patchies-v3-hero.png" alt="Patchies.app Hero Image" width="700">

> The above image remixes the Hydra code "Filet Mignon" from [AFALFL](https://www.instagram.com/a_f_alfl) and GLSL shader ["Just another cube"](https://www.shadertoy.com/view/3XdXRr) from mrange. Licensed under CC BY-NC-SA 4.0 and CC0 respectively.

Patchies is a patcher for audio, visual and computational things that runs on the web. It's made for creative coding; patch objects and code snippets together to explore visualizations, soundscapes and computations 🎨

Try it out at [patchies.app](https://patchies.app) - it's open source and free to use 😎

## Use tools and libraries you love

Patchies lets you use the audio, visual and computational tools and libraries that you know (and love!), together in one place. For example:

- Create interactive graphics with [P5.js](https://patchies.app/docs/objects/p5), [Three.js](https://patchies.app/docs/objects/three), [HTML5 Canvas](https://patchies.app/docs/objects/canvas) and [Textmode.js](https://patchies.app/docs/objects/textmode)
- Synthesize and process video with [Hydra](https://patchies.app/docs/objects/hydra) and [GLSL shaders](https://patchies.app/docs/objects/glsl)
- Live code music with [Strudel](https://patchies.app/docs/objects/strudel), [ChucK](https://patchies.app/docs/objects/chuck~), [SuperSonic](https://patchies.app/docs/objects/sonic~) and [Orca](https://patchies.app/docs/objects/orca)
- Synthesize and process audio with [Web Audio](https://patchies.app/docs/audio-chaining) nodes, [Tone.js](https://patchies.app/docs/objects/tone~) and [Elementary Audio](https://patchies.app/docs/objects/elem~)
- Run programs and games on the [Uxn](https://patchies.app/docs/objects/uxn) virtual machine and write your own with [Uxntal](https://wiki.xxiivv.com/site/uxntal.html) assembly.
- Compute like a caveman with [stack machine assembly](https://patchies.app/docs/objects/asm), or like a wizard with [Ruby](https://patchies.app/docs/objects/ruby) and [Python](https://patchies.app/docs/objects/python)
- Connect to the outside world with [MIDI](https://patchies.app/docs/objects/midi.in), [MQTT](https://patchies.app/docs/objects/mqtt), [SSE](https://patchies.app/docs/objects/sse), [WebRTC](https://patchies.app/docs/objects/netsend), [Iframe](https://patchies.app/docs/objects/iframe) and [VDO.Ninja](https://patchies.app/docs/objects/vdo.ninja.push).
- Manage [data and control flow](https://patchies.app/docs/message-passing) with [js](https://patchies.app/docs/objects/js), [expr](https://patchies.app/docs/objects/expr), [filter](https://patchies.app/docs/objects/filter), [map](https://patchies.app/docs/objects/map), [iframe](https://patchies.app/docs/objects/iframe), [spigot](https://patchies.app/docs/objects/spigot), [trigger](https://patchies.app/docs/objects/trigger) and more.
- Use built-in widgets or make your own with [Vue.js](https://patchies.app/docs/objects/vue), [DOM API](https://patchies.app/docs/objects/dom), [Tailwind](https://tailwindcss.com) or any library you like.
- Use any [third party JavaScript library](https://patchies.app/docs/javascript-runner) via [esm.sh](https://esm.sh).

## ...by patching them together ✨

<img src="./docs/images/patchies-random-walker.png" alt="Patchies.app random walk with hydra shader" width="700">

> Try out [the above demo](https://patchies.app/?id=ng7a8mcxobde7kv&readonly=true) which uses P5.js with Hydra to create a random walk shader.

Patchies is designed to mix textual coding and visual patching, using the best of both worlds. Instead of writing long chunks of code or patching together a huge web of small objects, Patchies encourages you to write small and compact programs and patch 'em together.

If you haven't used a patching environment before, patching is a _visual_ way to program by connecting objects together. Each object does something e.g. generate sound, generate visual, compute some values. You connect the output of one object to the input of another object to create a flow of data.

This lets you visually see the program's core composition and its in-between results such as audio, video and message flows, while using tools you're already familiar with that lets you do a lot with a bit of code. This is done through [Message Passing](https://patchies.app/docs/message-passing), [Video Chaining](https://patchies.app/docs/video-chaining) and [Audio Chaining](https://patchies.app/docs/audio-chaining). They're heavily inspired by tools like Max, Pd, TouchDesigner and VVVV.

> "What I cannot create, I do not understand. Know how to solve every problem that has been solved." - Richard Feynman

## Get Started

No installation needed. Open [patchies.app](https://patchies.app) and start patching. Use the [demos tab](https://patchies.app/?startup=demos) to get some inspirations.

New to Patchies? Check out the [docs](https://patchies.app/docs/adding-objects) for guides and object references.
