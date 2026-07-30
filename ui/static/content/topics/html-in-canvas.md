# HTML in Canvas

HTML-in-Canvas lets `dom` and `vue` objects render an HTML interface in a canvas. Use the canvas as a video source or apply local effects.

> **Experimental**: This feature uses Chromium's experimental HTML-in-Canvas API. Enable `chrome://flags/#canvas-draw-element` in Chromium.

## How It Works

`dom` and `vue` normally render interactive HTML directly on the Patchies canvas. HTML-in-Canvas puts the interface in a `layoutsubtree` canvas. Patchies can then draw or capture the DOM pixels.

There are two separate use cases:

- `htmlCanvas.videoOutput()` captures the HTML as a transferable `ElementImage`. It sends the image to the render worker as a video source.
- `htmlCanvas.canvasLayer()` and `htmlCanvas.glslLayer()` process the interface on the main thread. They do not add a video outlet.

The local layer APIs keep the interface clickable. Use one `htmlCanvas` mode at a time: `videoOutput`, `canvasLayer`, or `glslLayer`. Patchies logs an error when an object enables multiple modes in one run.

## Video Output

Call `htmlCanvas.videoOutput()` to use the object as a video source. Patchies captures the root element as a transferable `ElementImage`. It draws the image in the render worker:

```js
htmlCanvas.videoOutput();
setSize(640, 360);

root.innerHTML = '<div class="grid h-full place-items-center text-4xl">hello</div>';
```

By default, `htmlCanvas.videoOutput()` uses the current Patchies render output size. Use `htmlCanvas.videoOutput({ size: "free" })` to let DOM or Vue content choose the source size. Patchies then fits it into the render output.

`videoOutput` cannot be combined with `canvasLayer` or `glslLayer`.

Disable the video output with:

```js
htmlCanvas.videoOutput(false);
```

## Canvas Layer

Call `htmlCanvas.canvasLayer(callback)` to process the interface with a local 2D canvas. This function does not register a video output:

```js
htmlCanvas.canvasLayer((ctx, frame) => {
  ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
  ctx.fillRect(0, 0, frame.displayWidth, frame.displayHeight);
});
```

The callback gets `{ width, height, displayWidth, displayHeight, pixelRatio, time, delta }`.

- `width` and `height` are backing canvas pixels.
- `displayWidth` and `displayHeight` are CSS pixels.
- `pixelRatio` is the device pixel ratio used for the backing canvas.

Disable the layer with:

```js
htmlCanvas.canvasLayer(false);
```

`canvasLayer` cannot be combined with `videoOutput` or `glslLayer`.

## GLSL Layer

Call `htmlCanvas.glslLayer(fragmentShader)` to process the interface with a local WebGL2 GLSL ES 3 fragment shader. The HTML pixels are available as `sampler2D source`:

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

The built-in uniforms are `source`, `iResolution`, `iTime`, `iTimeDelta`, and `iFrame`.

Use `texture(source, uv)` to sample the interface. `htmlCanvas.glslLayer()` uses the same ShaderToy-style GLSL wrapper as the `glsl` object. It supports GLSL ES 3 syntax and `#include` preprocessing.

Disable the layer with:

```js
htmlCanvas.glslLayer(false);
```

`glslLayer` cannot be combined with `videoOutput` or `canvasLayer`.

## Vue Example

Use the same `htmlCanvas` APIs before you mount a Vue app:

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

If Chromium does not provide the required API, Patchies logs a warning. The object remains in normal DOM or Vue mode.

These APIs are experimental. They can change when Chromium changes its HTML-in-Canvas implementation.

## See Also

- [dom](/docs/objects/dom) — Create a vanilla JavaScript interface.
- [vue](/docs/objects/vue) — Create a Vue.js interface.
- [GLSL Imports](/docs/glsl-imports) — Share GLSL code with `#include`.
- [Video Chaining](/docs/video-chaining) — Connect visual objects as video sources.
