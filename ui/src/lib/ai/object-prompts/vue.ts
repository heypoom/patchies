export const vuePrompt = `## vue Object Instructions

Vue 3 reactive components with Composition API. Container is fluid-sized by default.

**Tailwind CSS is enabled by default!** Use Tailwind utility classes for styling in templates. Call \`tailwind(false)\` to disable it for better performance if not needed.

**Vue-specific methods:**
- root: HTMLDivElement - the container element to mount your Vue app
- width, height: Container dimensions (undefined if fluid, set after setSize)
- setSize(w, h): Set fixed container dimensions
- htmlCanvas.videoOutput(options): Experimental API that exposes the Vue node as a video source using Chromium's experimental HTML-in-Canvas flag; call htmlCanvas.videoOutput() to match the render output size, htmlCanvas.videoOutput(false) to disable, or htmlCanvas.videoOutput({ size: "free" }) to let the Vue content choose its own source size before Patchies fits it into the render output; mutually exclusive with canvasLayer and glslLayer
- htmlCanvas.canvasLayer(callback): Experimental API that locally post-processes the live Vue interface with a 2D canvas and Chromium's experimental HTML-in-Canvas flag without adding video output; callback receives (ctx, { width, height, displayWidth, displayHeight, pixelRatio, time, delta }); call htmlCanvas.canvasLayer(false) to disable; mutually exclusive with videoOutput and glslLayer
- htmlCanvas.glslLayer(fragmentShader): Experimental API that locally post-processes the live Vue interface with a WebGL2 GLSL ES 3 fragment shader and source sampler; use texture(source, uv), mainImage(out vec4 fragColor, in vec2 fragCoord), source, iResolution, iTime, iTimeDelta, and iFrame; supports #include directives; mutually exclusive with videoOutput and canvasLayer
- setHidePorts(hide): Hide/show ports
- noDrag(), noPan(), noWheel(), noInteract() - Interaction control (whole node)
- hideBorder(): Hide Patchies border and selected glow
- tailwind(enabled): Enable/disable Tailwind CSS (enabled by default)

**Selective canvas interaction (CSS classes):**
Apply these classes to individual elements to block canvas interactions only for that element:
- "nodrag" — prevent node drag when the user interacts with this element
- "nopan" — prevent canvas pan when the user interacts with this element
- "nowheel" — prevent canvas zoom when scrolling over this element

**Vue 3 APIs (auto-imported):**
- createApp: Create and mount Vue applications
- ref, reactive: Reactive state
- computed: Computed properties
- watch, watchEffect: Watchers
- onMounted, onUnmounted: Lifecycle hooks
- nextTick: DOM update timing
- h: Render function helper
- defineComponent: Component definition

**Caveats**
- If you use a border, you must use rounded-lg in the outer container, otherwise the border will be cut off.
- Do NOT use gradient colors in Tailwind classes, like "bg-gradient-to-r from-amber-500 to-orange-400". They are not supported.

Example - Simple reactive counter with Tailwind:
\`\`\`json
{
  "type": "vue",
  "data": {
    "code": "noDrag(); setSize(150, 80); createApp({ template: '<div class=\"p-4 text-center\"><h2 class=\"text-green-400 text-2xl m-0\">{{ count }}</h2><button @click=\"increment\" class=\"mt-2 px-3 py-1 bg-green-400 text-black rounded cursor-pointer\">+1</button></div>', setup() { const count = ref(0); const increment = () => count.value++; return { count, increment } } }).mount(root)"
  }
}
\`\`\`

Example - Reactive list with messages:
\`\`\`json
{
  "type": "vue",
  "data": {
    "code": "setSize(200, 150); const items = reactive([]); recv(msg => items.push(msg)); createApp({ template: '<ul class=\"list-none p-2 m-0\"><li v-for=\"item in items\" class=\"p-1 text-zinc-400\">{{ item }}</li></ul>', setup() { return { items } } }).mount(root)"
  }
}
\`\`\`

Example - Two-way binding form:
\`\`\`json
{
  "type": "vue",
  "data": {
    "code": "noDrag(); setSize(250, 100); const text = ref(''); const submit = () => send(text.value); createApp({ template: '<div class=\"p-2\"><input v-model=\"text\" class=\"w-full p-2 mb-2 bg-zinc-800 border border-zinc-600 text-white rounded\"><button @click=\"submit\" class=\"w-full p-2 bg-green-400 text-black rounded cursor-pointer\">Send</button></div>', setup() { return { text, submit } } }).mount(root)"
  }
}
\`\`\``;
