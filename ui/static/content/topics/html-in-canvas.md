# HTML in Canvas

HTML-in-Canvas lets `dom` and `vue` objects render live HTML interfaces into a canvas so they can become video sources or receive local canvas and GLSL effects.

> **Experimental**: This uses Chromium's experimental HTML-in-Canvas API. Enable `chrome://flags/#canvas-draw-element` in a Chromium browser.

## How It Works

`dom` and `vue` normally render interactive HTML directly on the Patchies canvas. HTML-in-Canvas wraps that interface in a `layoutsubtree` canvas, then lets Patchies draw or capture the live DOM pixels.

There are two separate use cases:

- `htmlCanvas.videoOutput()` captures the HTML as a transferable `ElementImage` and sends it to the render worker as a video source.
- `htmlCanvas.canvasLayer()` and `htmlCanvas.glslLayer()` process the live interface locally on the main thread without adding a video outlet.

The local layer APIs keep the original interface clickable. Choose one `htmlCanvas` mode at a time: `videoOutput`, `canvasLayer`, or `glslLayer`. Patchies logs an error if a node tries to enable more than one mode in the same run.

## Video Output

Call `htmlCanvas.videoOutput()` to expose the object as a video source. Patchies captures the root element as a transferable `ElementImage` and draws it in the render worker:

```js
htmlCanvas.videoOutput();
setSize(640, 360);

root.innerHTML = '<div class="grid h-full place-items-center text-4xl">hello</div>';
```

`htmlCanvas.videoOutput()` uses the current Patchies render output size by default. Use `htmlCanvas.videoOutput({ size: "free" })` to let the DOM or Vue content choose its own source size before Patchies fits it into the render output.

`videoOutput` cannot be combined with `canvasLayer` or `glslLayer`.

Disable the video output with:

```js
htmlCanvas.videoOutput(false);
```

## Canvas Layer

Call `htmlCanvas.canvasLayer(callback)` to locally post-process the live interface with a 2D canvas. This does not register a video output:

```js
htmlCanvas.canvasLayer((ctx, frame) => {
  ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
  ctx.fillRect(0, 0, frame.displayWidth, frame.displayHeight);
});
```

The callback receives `{ width, height, displayWidth, displayHeight, pixelRatio, time, delta }`.

- `width` and `height` are backing canvas pixels.
- `displayWidth` and `displayHeight` are CSS pixels.
- `pixelRatio` is the device pixel ratio used for the backing canvas.

Disable the layer with:

```js
htmlCanvas.canvasLayer(false);
```

`canvasLayer` cannot be combined with `videoOutput` or `glslLayer`.

## GLSL Layer

Call `htmlCanvas.glslLayer(fragmentShader)` to locally post-process the live interface with a WebGL2 GLSL ES 3 fragment shader. The live HTML pixels are available as `sampler2D source`:

```js
htmlCanvas.glslLayer(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;

  vec4 color = texture(source, uv);

  float wave = sin((uv.y * 28.0) + iTime * 5.0) * 0.012;
  vec2 warpedUv = uv + vec2(wave, 0.0);

  vec4 warped = texture(source, warpedUv);

  float scanline = 0.92 + 0.08 * sin(fragCoord.y * 1.7);
  vec3 tint = warped.rgb * vec3(1.12, 0.96, 1.05) * scanline;

  float vignette = smoothstep(0.95, 0.25, distance(uv, vec2(0.5)));
  
  fragColor = vec4(tint * vignette, warped.a);
}
`);
```

Built-in uniforms: `source`, `iResolution`, `iTime`, `iTimeDelta`, and `iFrame`.

Use `texture(source, uv)` to sample the live interface. `htmlCanvas.glslLayer()` uses the same ShaderToy-style GLSL wrapper as the `glsl` object, including GLSL ES 3 syntax and `#include` preprocessing.

Disable the layer with:

```js
htmlCanvas.glslLayer(false);
```

`glslLayer` cannot be combined with `videoOutput` or `canvasLayer`.

## Vue Example

Use the same `htmlCanvas` APIs before mounting your Vue app:

```js
htmlCanvas.glslLayer(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 color = texture(source, uv);
  
  fragColor = vec4(color.rgb * vec3(1.0, 1.15, 1.05), color.a);
}
`);

createApp({
  template: '<button class="p-4">still clickable</button>'
}).mount(root);
```

## Browser Support

Without the required Chromium API, Patchies logs a warning and keeps the object in normal DOM or Vue mode.

These APIs are experimental and may change as Chromium's HTML-in-Canvas implementation changes.

## See Also

- [dom](/docs/objects/dom) - Vanilla JavaScript interfaces
- [vue](/docs/objects/vue) - Vue.js interfaces
- [GLSL Imports](/docs/glsl-imports) - Shared GLSL `#include` support
- [Video Chaining](/docs/video-chaining) - Connecting visual objects as video sources
