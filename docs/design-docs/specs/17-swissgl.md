# 17. SwissGL

Let's add a 'swgl' block for SwissGL (https://github.com/google/swissgl) rendering.

I have added the library to `ui/src/lib/rendering/swissgl.ts`. You can import it like `import { SwissGL } from './swissgl';`. The library is not available on NPM.

## How to use SwissGL

In SwissGL's example code snippet, a SwissGL code looks like this:

```html
<script src="swissgl.js"></script>
<canvas id="c" width="400" height="300"></canvas>
<script>
  const canvas = document.getElementById('c')
  // create WebGL2 context end SwissGL
  const glsl = SwissGL(canvas)
  function render(t) {
    t /= 1000 // ms to sec
    glsl({
      t, // pass uniform 't' to GLSL
      Mesh: [10, 10], // draw a 10x10 tessellated plane mesh
      // Vertex shader expression returns vec4 vertex position in
      // WebGL clip space. 'XY' and 'UV' are vec2 input vertex
      // coordinates in [-1,1] and [0,1] ranges.
      VP: `XY*0.8+sin(t+XY.yx*2.0)*0.2,0,1`,
      // Fragment shader returns 'RGBA'
      FP: `UV,0.5,1`,
    })
    requestAnimationFrame(render)
  }
  requestAnimationFrame(render)
</script>
```

However, we will simplify this in our `swgl` block. This is the code block:

```javascript
function render({t}) {
  glsl({
    t,
    Mesh: [10, 10],
    VP: `XY*0.8+sin(t+XY.yx*2.0)*0.2,0,1`,
    FP: `UV,0.5,1`,
  })
}
```

## How to integrate SwissGL into our rendering pipeline

We need to add SwissGL to our rendering pipeline in `fboRenderer.ts`.

Look at the `glsl` and `hydra` block for inspirations on how to hook into our rendering pipeline and have appropriate previews. Note the `GLSystem.upsertNode` methods on `onMount` and `GLSystem.removeNode` on `onDestroy` to synchronize with our render graph.

You will have to add swgl to FBO compatibility list, create a `createSwglRenderer` method in `fboRenderer.ts`. It simply needs to call the user's `render` function in which we need to store. You can look at the `p5` block on how to get user functions, which is essentially `return {render}` so we can grab the render function from the user.
