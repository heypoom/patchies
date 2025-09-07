# Patchies.app

<img src="./docs/images/patchies-v3-hero.png" alt="Patchies.app Hero Image" width="700">

> The above image remixes the Hydra code "Filet Mignon" from [AFALFL](https://www.instagram.com/a_f_alfl) and GLSL shader ["Just another cube"](https://www.shadertoy.com/view/3XdXRr) from mrange. Licensed under CC BY-NC-SA 4.0 and CC0 respectively.

Patchies is a tool for building interactive audio-visual patches in the browser, using JavaScript. Try it out at [patchies.app](https://patchies.app) - it's open source!

Patchies lets you use the audio-visual tools that you know and love, together in one place. For example:

- [P5.js](https://p5js.org), a JavaScript library for creative coding.
- [Hydra](https://hydra.ojack.xyz), a live-coding video synthesizer.
- [Strudel](https://strudel.cc), a TidalCycles-like music environment
- [ChucK](https://chuck.cs.princeton.edu/webchuck), a programming language for real-time sound synthesis
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), a powerful audio synthesis and processing API
- [GLSL fragment shaders](https://www.shadertoy.com), for complex visual effects
- ...as well as write JavaScript code directly.

Patchies lets you "patch" multiple objects together using [Message Passing](#message-passing), [Video Chaining](#video-chaining) and [Audio Chaining](#audio-chaining). It's inspired by tools such as Max/MSP, Pure Data, TouchDesigner, VVVV, and others.

> "What I cannot create, I do not understand. Know how to solve every problem that has been solved." - Richard Feynman

## How to use

- Go to [patchies.app](https://patchies.app).
- Press `Enter` to create a new object.
- Click and drag the title of the object on the top left to move.
- When hovering over an object, you'll see icon buttons such as "edit code" and "play/stop" on the top right.
  - Use the "Edit Code" button to open the code editor.
  - Press `Shift + Enter` while in a code editor to re-run the code, or hit the "Play" icon.
- Click on the title to focus on an object.
  - Drag on the title to move the object around.
  - Press `Delete` to delete an object.
- Press `Ctrl/Cmd + K` to bring up the command palette.
  - You can do many actions here, such as toggling fullscreen, import/export patch files, save/load patches in your browser, setting API keys, opening secondary output screen, toggling FPS monitors and more.

## Keyboard Shortcuts

You can use the Shortcuts button on the bottom right to see a list of shortcuts. Here are some of the most useful ones:

- `Click on object / title`: focus on the object.
- `Drag on object / title`: move the object around.
- `Scroll up`: zoom in.
- `Scroll down`: zoom out.
- `Drag on empty space`: pan the canvas.
- `Enter`: create a new object at cursor position.
- `Ctrl/Cmd + K`: open the command palette to search for commands.
- `Shift + Enter`: run the code in the code editor within the selected object.
- `Delete`: delete the selected object.
- `Cmd + Z`: undo the last action.
- `Ctrl + C`: copy the selected object.
- `Ctrl + V`: paste the copied object.

## Message Passing

You can use `send()` and `onMessage()` functions to send and receive messages between objects. This allows you to create complex interactions between different parts of your patch. This is very similar to messages in Max/MSP.

Here is how to use `send` and `onMessage` in JavaScript objects:

```js
// Object A
send('Hello from Object A')

// Object B
onMessage((data, meta) => {
  // data = "Hello from Object A"
  console.log('Received message:', data)
})
```

You can use the `send` and `onMessage` function in all JavaScript-based objects, such as `js`, `p5`, `hydra`, `strudel` and `canvas`.

The `meta` includes the `inlet` which is an index of the inlet. This is helpful to distinguish inlets. You can also do `send(data, {to: inletIndex})` to send data to only a particular inlet, for example:

```js
onMessage((data, meta) => {
  send(data, {to: meta.inlet})
})
```

In JavaScript objects such as `js`, `p5`, `hydra`, you can call `setPortCount(inletCount, outletCount)` to set the exact number of message inlets and outlets. Example: `setPortCount(2, 1)` ensures there is 2 message inlets and 1 message outlet.

You can also `send` messages into GLSL uniforms. If you define a uniform in your GLSL code like so:

```glsl
uniform float iMix;
uniform vec2 iFoo;
```

This will create two inlets in the GLSL object: the first one allows `send(0.5)` for `iMix`, and the other allows `send([0.0, 0.0])` for `iFoo`. When you `send` messages to these inlets, it will set the internal GLSL uniform values for the object.

## Video Chaining

You can chain video objects together to create complex video effects, by using the output of a video object as an input to another. For example: P5 -> Hydra -> GLSL. This is similar to shader graphs in TouchDesigner.

To leverage video chaining, use the leftmost orange inlets and outlets on the patch. You can connect the orange video outlet of a `p5` to an orange video inlet of a `hydra` object, and then connect the `hydra` object to a `glsl`.

This allows you to create video patches that are more powerful than what you can do with a single object. Have fun!

## Audio Chaining

Similar to video chaining, you can chain many audio objects together to create complex audio effects.

For example, you can use these as audio sources: `strudel`, `chuck`, `ai.tts`, `ai.music`, `midi.in`, `soundfile~`.

## List of objects

Here are the list of objects that we have in Patchies. You can also hit `n` on your keyboard to see list of objects to create, as well as drag in the objects from the bottom bar.

### Visual & Creative Coding Objects

These objects support video chaining and can be connected to create complex visual effects:

### `p5`: creates a P5.js sketch

- P5.js is a JavaScript library for creative coding. It provides a simple way to create graphics and animations, but you can do very complex things with it.
- If you are new to P5.js, I recommend watching [Patt Vira](https://www.youtube.com/@pattvira)'s YouTube tutorials on YouTube, or on her [website](https://www.pattvira.com). They're fantastic for both beginners and experienced developers.
- Read the [P5.js documentation](https://p5js.org/reference) to see how P5 works.
- See the [P5.js tutorials](https://p5js.org/tutorials) and [OpenProcessing](https://www.openprocessing.org) for more inspirations.
- You can call these special methods in your P5 sketch:

  - `noDrag()` to disable dragging the whole canvas. this is needed if you want to add interactivity to your P5 sketch, such as adding sliders. You can call it in your `setup()` function.
  - `send(message)` and `onMessage(callback)`, see [Message Passing](#message-passing).

### `hydra`: creates a Hydra video synthesizer

- Hydra is a live coding video synthesizer. You can use it to create complex video effects and animations.
- See the [interactive Hydra documentation](https://hydra.ojack.xyz/docs) to learn how to use hydra.
- Try out the standalone editor at [Hydra](https://hydra.ojack.xyz) to see how Hydra works.
- You can call these special methods in your Hydra code:
  - `setVideoCount(ins = 1, outs = 1)` creates the specified number of Hydra source ports.
    - For example, `setVideoCount(2)` will initialize `s0` and `s1` with the first two video inlets.
  - full hydra synth is available as `h`
  - outputs are available as `o0`, `o1`, `o2`, and `o3`.
  - `send(message)` and `onMessage(callback)`

### `glsl`: creates a GLSL fragment shader

- GLSL is a shading language used in OpenGL. You can use it to create complex visual effects and animations.
- You can use video chaining by connecting any video objects (e.g. `p5`, `hydra`, `glsl`, `swgl`, `bchrn`, `ai.img` or `canvas`) to the GLSL object via the four video inlets.
- You can create any number of GLSL uniform inlets by defining them in your GLSL code.
  - For example, if you define `uniform float iMix;`, it will create a float inlet for you to send values to.
  - You can send values to the uniform inlets using [Message Passing](#message-passing).
  - If you define the uniform as `sampler2D` such as `uniform sampler2D iChannel0;`, it will create a video inlet for you to connect video sources to.
- See [Shadertoy](https://www.shadertoy.com) for examples of GLSL shaders.
- All shaders on the Shadertoy website are automatically compatible with `glsl`, as they accept the same uniforms.
- I recommend playing with [The Book of Shaders](https://thebookofshaders.com) to learn the GLSL basics!

### `swgl`: creates a SwissGL compute shader

- SwissGL is a minimalistic wrapper for WebGL to create compute shaders and GPU-accelerated graphics.
- Perfect for data visualization, image processing, and GPU compute tasks.
- Supports video chaining for complex processing pipelines.

### `canvas`: creates a JavaScript canvas

- You can use [HTML5 Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) to create custom graphics and animations. The rendering context is exposed as `canvas` in the JavaScript code, so you can use methods like `canvas.fill()` to draw on the canvas.
- You can call these special methods in your canvas code:

  - `noDrag()` to disable dragging the whole canvas. this is needed if you want to add interactivity to your canvas, such as adding sliders. You can call it in your `setup()` function.
  - `getSource()` to get the video source from the previous video object using [Video Chaining](#video-chaining). This returns the HTML5 canvas element which you can use for e.g. copying pixels. You can call this in your `setup()` function.
  - `send(message)` and `onMessage(callback)`, see [Message Passing](#message-passing).

### `bchrn`: render the Winamp Milkdrop visualizer (Butterchurn)

- [Butterchurn](https://github.com/jberg/butterchurn) is a JavaScript port of the Winamp Milkdrop visualizer.
- You can use it as video source and connect it to other video objects (e.g. `hydra` and `glsl`) to derive more visual effects.

### `img`: display and manipulate images

- Load and display images from URLs or local files.
- Supports video chaining for image processing pipelines.
- Can be used as texture sources for other visual objects.

### Audio & Music Objects

### `strudel`: creates a Strudel music environment

- Strudel is a live coding environment based on TidalCycles. You can use it to expressively write dynamic music pieces, as well as create complex audio patterns and effects.
- See the [Strudel workshop](https://strudel.cc/workshop/getting-started) to learn how to use Strudel.
- Check out the [Strudel showcase](https://strudel.cc/intro/showcase) to get inspirations with how people use Strudel.

### `chuck`: creates a ChucK audio programming environment

- ChucK is a programming language for real-time sound synthesis and music creation.
- Great for algorithmic composition and sound design.
- Runs in the browser via WebChucK.

### `python`: creates a Python code environment

- Run Python code directly in the browser using Pyodide.
- Great for data processing, scientific computing, and algorithmic composition.
- Full Python standard library available.

### Programming & Control Objects

### `js`: A JavaScript code block

- Use `console.log()` to log messages to the virtual console.
- Use `setInterval(callback, ms)` to run a callback every `ms` milliseconds.
  - The code block has a special version of `setInterval` that automatically cleans up the interval on unmount. Do not use `window.setInterval` from the window scope as that will not clean up.
- Use `send()` and `onMessage()` to send and receive messages between objects. This also works in other JS-based objects. See the [Message Passing](#message-passing) section below.

### `expr`: mathematical expression evaluator

- Evaluate mathematical expressions and formulas.
- Perfect for control signals and parameter mapping.
- Supports variables and mathematical functions.

### `expr~`: audio-rate mathematical expression evaluator

- Similar to `expr` but runs at audio rate for signal processing.
- Use for audio synthesis and real-time signal manipulation.

### Interface & Control Objects

### `button`: creates an interactive button

- Trigger events and send messages when clicked.
- Perfect for user interaction and patch control.
- Use `send()` to output bang messages or custom data.

### `msg`: message object

- Store and send predefined messages.
- Click to send the stored message to connected objects.
- Great for triggering sequences or sending configuration data.

### `slider`: creates an interactive slider

- Continuous value control with customizable range.
- Perfect for real-time parameter adjustment.
- Outputs numeric values that can control other objects.

### `object`: textual object system

- Create Max/MSP-style textual objects with typed inlets and outlets.
- Supports a wide range of audio processing, control, and utility objects.
- Type an object name to create specialized functionality.

#### Available textual objects include:

**Audio Processing:**

- `gain~`: Amplifies audio signals with gain control
- `osc~`: Oscillator for generating audio waveforms (sine, square, sawtooth, triangle)
- `lowpass~`, `highpass~`, `bandpass~`, `allpass~`, `notch~`: Various audio filters
- `lowshelf~`, `highshelf~`, `peaking~`: EQ filters for frequency shaping
- `compressor~`: Dynamic range compression for audio
- `pan~`: Stereo positioning control
- `delay~`: Audio delay line with configurable delay time
- `+~`: Audio signal addition
- `sig~`: Generate constant audio signals
- `waveshaper~`: Distortion and waveshaping effects
- `convolver~`: Convolution reverb using impulse responses
- `fft~`: FFT analysis for frequency domain processing

**Sound Sources:**

- `soundfile~`: Load and play audio files with transport controls
- `sampler~`: Sample playback with triggering capabilities
- `mic~`: Capture audio from microphone input

**Control & Utility:**

- `mtof`: Convert MIDI note numbers to frequencies
- `loadbang`: Send bang on patch load
- `metro`: Metronome for regular timing
- `delay`: Message delay (not audio)
- `adsr`: ADSR envelope generator
- `dac~`: Send audio to speakers
- `fslider`: Floating-point slider control
- `bang`: Alias for button object

### MIDI & Network Objects

### `midi.in`: MIDI input

- Receive MIDI messages from connected devices.
- Outputs note, velocity, and control change data.
- Perfect for musical controllers and hardware integration.

### `midi.out`: MIDI output

- Send MIDI messages to external devices or software.
- Control external synthesizers and DAWs.
- Supports note, CC, and system messages.

### `netsend`: network message sender

- Send messages over network protocols.
- Communicate with other applications or devices.
- Supports UDP and TCP protocols.

### `netrecv`: network message receiver

- Receive messages from network sources.
- Listen for data from other applications.
- Complements `netsend` for network communication.

### AI & Generation Objects

These objects can be hidden via the "Toggle AI Features" command if you prefer not to use AI:

### `ai.txt`: AI text generation

- Generate text using AI language models.
- Create dynamic content, lyrics, or procedural text.
- Integrates with message system for interactive generation.

### `ai.img`: AI image generation

- Generate images from text prompts using AI.
- Create visual content programmatically.
- Supports video chaining as texture source.

### `ai.music`: AI music generation

- Generate musical compositions using AI.
- Create backing tracks, melodies, or soundscapes.
- Outputs audio that can be processed by other objects.

### `ai.tts`: AI text-to-speech

- Convert text to speech using AI voices.
- Create dynamic narration or vocal elements.
- Outputs audio for further processing.

### Output Objects

### `bg.out`: background output

- Set the final output that appears as the background.
- The endpoint for video chaining pipelines.
- Determines what the audience sees as the main visual.

### Documentation & Content

### `markdown`: Markdown renderer

- Render Markdown text as formatted content.
- Perfect for documentation, instructions, or dynamic text display.
- Supports full Markdown syntax including links and formatting.

## Hiding AI features

If you dislike AI features (e.g. text generation, image generation, speech synthesis and music generation), you can hide them by activating the command palette with `CMD + K`, then search for "Toggle AI Features". This will hide all AI-related objects and features, such as `ai.txt`, `ai.img`, `ai.tts` and `ai.music`.
