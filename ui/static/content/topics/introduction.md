# Introduction

Patchies is a creative coding patcher where you write small programs using the tools and libraries that you already know, and patch them together to make something interesting.

![A random walk world made with P5.js and a Hydra shader](/content/images/patchies-random-walker.png)

> ✨ [Try this patch](/?demo=random-walk-world) — It uses P5.js with Hydra to create a random walk shader.

It's a playground where you can make interactive widgets, craft synthesizers, simulate biology and physics, design audio-reactive visuals, compose shader graphs, and connect all of them together.

It's all running on the web, no installation needed.

Prefer to watch a video? [Check out this walkthrough on YouTube.](https://www.youtube.com/watch?v=jxFXNnmcOAs)

## What can I make?

Patchies lets you use the audio, visual and computational tools and libraries that you know and love, together in one place. For example:

- Make interactive graphics and widgets with [P5.js](/docs/objects/p5), [HTML5 Canvas](/docs/objects/canvas.dom), [Three.js](/docs/objects/three) and [Textmode.js](/docs/objects/textmode)
- Synthesize videos with [Hydra](/docs/objects/hydra), [GLSL shaders](/docs/objects/glsl), and [Shader Park](/docs/objects/shaderpark)
- Make music from code with [Strudel](/docs/objects/strudel), [Orca](/docs/objects/orca), [Bytebeat](/docs/objects/bytebeat~), [ChucK](/docs/objects/chuck~), [SuperSonic](/docs/objects/sonic~) and [Csound](/docs/objects/csound~)
- Design sounds with [Pure Data-style](/docs/audio-chaining) objects, [Tone.js](/docs/objects/tone~) and [Elementary Audio](/docs/objects/elem~)
- Build and run tiny programs & games on the [Uxn](/docs/objects/uxn) virtual machine.
- Compute like an ancient witch with [Stack Assembly](/docs/objects/asm) and [Uiua](/docs/objects/uiua), or like a wizard with [Ruby](/docs/objects/ruby) and [Python](/docs/objects/python)
- Reach out to outside world with [MIDI](/docs/objects/midi.in), [MQTT](/docs/objects/mqtt), [SSE](/docs/objects/sse), [WebRTC](/docs/objects/netsend), [Iframe](/docs/objects/iframe) and [VDO.Ninja](/docs/objects/vdo.ninja.push).
- Manage [data and control flow](/docs/message-passing) with [js](/docs/objects/js), [expr](/docs/objects/expr), [filter](/docs/objects/filter), [map](/docs/objects/map), [iframe](/docs/objects/iframe), [spigot](/docs/objects/spigot), [trigger](/docs/objects/trigger) and more.
- Craft widgets with [Vue.js](/docs/objects/vue), [DOM API](/docs/objects/dom), [Tailwind](https://tailwindcss.com) or any library you like.
- Use any [third party JavaScript library](/docs/javascript-runner) via [esm.sh](https://esm.sh).

## What is patching?

Patchies lets you write small blocks of code and patch them together.

Patching is a visual way to program by connecting objects together. Each object does something e.g. generate sound, generate visual, compute some values. You then chain their [messages](/docs/message-passing), [audio output](/docs/audio-chaining), [video output](/docs/video-chaining) together to build up a larger program.

This is heavily inspired by the [actor model](https://en.wikipedia.org/wiki/Actor_model), as well as software like TouchDesigner, Pure Data and Max/MSP.

## See Also

- [Demos](/docs/demos) - Open examples you can inspect and change.
- [Collections](/docs/manage-collections) - Choose what kind of objects you want in your patch.
- [Adding Objects](/docs/adding-objects) - Add programs and presets to a patch.
- [Connecting Objects](/docs/connecting-objects) - Connect objects into a larger program.
- [Message Passing](/docs/message-passing) - Learn how objects send data to each other.
