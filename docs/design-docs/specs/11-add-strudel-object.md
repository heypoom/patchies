# 11. Add Strudel Object

Let's add a `strudel` object that embeds strudel.cc.

- See <https://strudel.cc/technical-manual/project-start>
- See <https://www.npmjs.com/package/@strudel/web> for README on web embedding.
- We should use the `@strudel/repl` where we can, because it provides a nice REPL interface with visuals for what's happening.

See the implementation for the `strudel-editor` custom element in the `@strudel/repl` package below. The goal is we want to replace our use of `<strudel-editor>` web component with our own Svelte component, `StrudelEditor`, which must be exactly the same as Strudel's web component implementation.

## Embedding strudel with StrudelMirror

Here is a generic example of how to embed Strudel using the `@strudel/codemirror` package, which provides a CodeMirror-based editor for Strudel code.

```ts
import {StrudelMirror} from '@strudel/codemirror'
import {funk42} from './tunes'
import {evalScope} from '@strudel/core'
import {drawPianoroll} from '@strudel/draw'
import './style.css'
import {initAudioOnFirstClick} from '@strudel/webaudio'
import {transpiler} from '@strudel/transpiler'
import {
  getAudioContext,
  webaudioOutput,
  registerSynthSounds,
} from '@strudel/webaudio'
import {registerSoundfonts} from '@strudel/soundfonts'

// init canvas
const canvas = document.getElementById('roll')
canvas.width = canvas.width * 2
canvas.height = canvas.height * 2
const drawContext = canvas.getContext('2d')
const drawTime = [-2, 2] // time window of drawn haps

const editor = new StrudelMirror({
  defaultOutput: webaudioOutput,
  getTime: () => getAudioContext().currentTime,
  transpiler,
  root: document.getElementById('editor'),
  initialCode: funk42,
  drawTime,
  onDraw: (haps, time) =>
    drawPianoroll({haps, time, ctx: drawContext, drawTime, fold: 0}),
  prebake: async () => {
    initAudioOnFirstClick() // needed to make the browser happy (don't await this here..)
    const loadModules = evalScope(
      import('@strudel/core'),
      import('@strudel/draw'),
      import('@strudel/mini'),
      import('@strudel/tonal'),
      import('@strudel/webaudio')
    )
    await Promise.all([
      loadModules,
      registerSynthSounds(),
      registerSoundfonts(),
    ])
  },
})

document
  .getElementById('play')
  .addEventListener('click', () => editor.evaluate())
document.getElementById('stop').addEventListener('click', () => editor.stop())
```

## @strudel/repl

For reference, this is a code sample for embedding Strudel in a Svelte component:

```svelte
import '@strudel/repl'

<script>
  strudel
</script>

<strudel-editor bind:this={strudel}>
  <!--
setcps(1)
n("<0 1 2 3 4>*8").scale('G4 minor')
.s("gm_lead_6_voice")
.clip(sine.range(.2,.8).slow(8))
.jux(rev)
.room(2)
.sometimes(add(note("12")))
.lpf(perlin.range(200,20000).slow(4))
-->
</strudel-editor>
```

You can access the editor's instance methods:

- `strudel.editor.evaluate()`: runs whatever the code is in the editor. We should tie that to our UI's run/evaluate.
- `document.querySelector('#repl').editor.stop()`: stop the sound that is going on.

We will not use this, replace this with our own implementation of strudel for more control over the UI.

## How strudel-editor is implemented

Here is how the above `strudel-editor` web component is implemented. This is copied from the Strudel repository:

```ts
import {silence} from '@strudel/core'
import {getDrawContext} from '@strudel/draw'
import {transpiler} from '@strudel/transpiler'
import {getAudioContext, webaudioOutput} from '@strudel/webaudio'
import {StrudelMirror, codemirrorSettings} from '@strudel/codemirror'
import {prebake} from './prebake.mjs'

if (typeof HTMLElement !== 'undefined') {
  class StrudelRepl extends HTMLElement {
    static observedAttributes = ['code']
    settings = codemirrorSettings.get()
    editor = null
    sync = false
    solo = true
    constructor() {
      super()
    }
    attributeChangedCallback(name, oldValue, newValue) {
      if (name === 'code') {
        this.code = newValue
        this.editor?.setCode(newValue)
      }
    }
    connectedCallback() {
      // setTimeout makes sure the dom is ready
      setTimeout(() => {
        const code = (this.innerHTML + '')
          .replace('<!--', '')
          .replace('-->', '')
          .trim()
        if (code) {
          // use comment code in element body if present
          this.setAttribute('code', code)
        }
      })
      // use a separate container for the editor, to make sure the innerHTML stays as is
      const container = document.createElement('div')
      this.parentElement.insertBefore(container, this.nextSibling)
      const drawContext = getDrawContext()
      const drawTime = [-2, 2]
      this.editor = new StrudelMirror({
        defaultOutput: webaudioOutput,
        getTime: () => getAudioContext().currentTime,
        transpiler,
        root: container,
        initialCode: '// LOADING',
        pattern: silence,
        drawTime,
        drawContext,
        prebake,
        onUpdateState: (state) => {
          const event = new CustomEvent('update', {
            detail: state,
          })
          this.dispatchEvent(event)
        },
        solo: this.solo,
        sync: this.sync,
      })
      // init settings
      this.editor.updateSettings(this.settings)
      this.editor.setCode(this.code)
    }
    // Element functionality written in here
  }

  customElements.define('strudel-editor', StrudelRepl)
}
```

And, here is how the prebake.mjs script is implemented:

```js
import {noteToMidi, valueToMidi, Pattern, evalScope} from '@strudel/core'
import {
  aliasBank,
  registerSynthSounds,
  registerZZFXSounds,
  samples,
} from '@strudel/webaudio'
import * as core from '@strudel/core'

export async function prebake() {
  const modulesLoading = evalScope(
    // import('@strudel/core'),
    core,
    import('@strudel/draw'),
    import('@strudel/mini'),
    import('@strudel/tonal'),
    import('@strudel/webaudio'),
    import('@strudel/codemirror'),
    import('@strudel/hydra'),
    import('@strudel/soundfonts'),
    import('@strudel/midi')
    // import('@strudel/xen'),
    // import('@strudel/serial'),
    // import('@strudel/csound'),
    // import('@strudel/osc'),
  )
  // load samples
  const ds = 'https://raw.githubusercontent.com/felixroos/dough-samples/main/'

  // TODO: move this onto the strudel repo
  const ts = 'https://raw.githubusercontent.com/todepond/samples/main/'
  await Promise.all([
    modulesLoading,
    registerSynthSounds(),
    registerZZFXSounds(),
    //registerSoundfonts(),
    // need dynamic import here, because importing @strudel/soundfonts fails on server:
    // => getting "window is not defined", as soon as "@strudel/soundfonts" is imported statically
    // seems to be a problem with soundfont2
    import('@strudel/soundfonts').then(({registerSoundfonts}) =>
      registerSoundfonts()
    ),
    samples(`${ds}/tidal-drum-machines.json`),
    samples(`${ds}/piano.json`),
    samples(`${ds}/Dirt-Samples.json`),
    samples(`${ds}/EmuSP12.json`),
    samples(`${ds}/vcsl.json`),
    samples(`${ds}/mridangam.json`),
  ])

  aliasBank(`${ts}/tidal-drum-machines-alias.json`)
}

const maxPan = noteToMidi('C8')
const panwidth = (pan, width) => pan * width + (1 - width) / 2

Pattern.prototype.piano = function () {
  return this.fmap((v) => ({...v, clip: v.clip ?? 1})) // set clip if not already set..
    .s('piano')
    .release(0.1)
    .fmap((value) => {
      const midi = valueToMidi(value)
      // pan by pitch
      const pan = panwidth(Math.min(Math.round(midi) / maxPan, 1), 0.5)
      return {...value, pan: (value.pan || 1) * pan}
    })
}
```
