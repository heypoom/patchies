# 11. Add Strudel Object

Let's add a `strudel` object that embeds strudel.cc.

- See <https://strudel.cc/technical-manual/project-start>
- See <https://www.npmjs.com/package/@strudel/web> for README on web embedding.
- We should use the `@strudel/repl` where we can, because it provides a nice REPL interface with visuals for what's happening.

## Using @strudel/repl -- our primary choice

Code sample for embedding Strudel in a Svelte component:

```svelte
import '@strudel/repl'

<script>
  strudel.
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

## Implementation Plan

We will replace the current StrudelManager class approach with the @strudel/repl web component:

1. **Install @strudel/repl** - Add the package dependency
2. **Replace StrudelManager usage** - Remove StrudelManager.ts and update StrudelNode.svelte to use the `<strudel-editor>` web component
3. **Maintain existing API** - Keep the same play/stop interface but use the web component's methods
4. **Code synchronization** - Sync our CodeEditor content with the strudel-editor content
5. **Error handling** - Handle errors from the strudel-editor web component

### Component Structure

```svelte
<script>
  import '@strudel/repl';
  
  let strudelElement: HTMLElement;
  let code = $state(`note("c a f e").jux(rev)`);
  
  function play() {
    strudelElement.editor.evaluate();
  }
  
  function stop() {
    strudelElement.editor.stop();
  }
</script>

<strudel-editor bind:this={strudelElement}>
  {code}
</strudel-editor>
```

### Using @strudel/web

Code sample for initializing and evaluating Strudel directly:

```js
import {initStrudel} from '@strudel/web'

initStrudel({
  prebake: () => samples('github:tidalcycles/dirt-samples'),
})

document
  .getElementById('play')
  .addEventListener('click', () => evaluate('note("c a f e").jux(rev)'))

document.getElementById('stop').addEventListener('click', () => hush())
```
