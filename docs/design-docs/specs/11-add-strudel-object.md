# 11. Add Strudel Object

Let's add a `strudel` object that embeds strudel.cc.

- See <https://strudel.cc/technical-manual/project-start>
- See <https://www.npmjs.com/package/@strudel/web> for README on web embedding.

Code sample for initializing and evaluating Strudel:

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
