import { domSharedPrompt } from '$objects/dom/shared-prompt';

export const vuePrompt = `## vue Object Instructions

Vue 3 reactive components with Composition API. Container is fluid-sized by default.

**Tailwind CSS is enabled by default!** Use Tailwind utility classes for styling in templates. Call \`tailwind(false)\` to disable it for better performance if not needed.

**Vue-specific methods:**
- root: HTMLDivElement - the container element to mount your Vue app

${domSharedPrompt}

When using noBorder() for a custom widget, use onSelectionChange() to keep a visible selection indicator that matches its theme and geometry, including rounded or inset borders. Store selected in a Vue ref and bind the widget border or outline to that ref.

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
    "code": "setFluidSize({ showResizer: false, initialSize: { width: 400, height: 300 } }); Object.assign(root.style, { width: '100%', height: '100%', padding: '0', margin: '0' }); const resizeUI = ({ width, height }) => root.style.fontSize = Math.max(18, 24 * Math.min(width / 400, height / 300)) + 'px'; onResize(resizeUI); resizeUI({ width: Number(width), height: Number(height) }); noDrag(); createApp({ template: '<div class=\\"w-full h-full p-0 m-0 flex flex-col items-center justify-center text-center\\"><h2 class=\\"text-green-400 text-[1.5em] m-0\\">{{ count }}</h2><button @click=\\"increment\\" class=\\"mt-[0.5em] px-[0.75em] py-[0.25em] text-[1em] bg-green-400 text-black rounded cursor-pointer\\">+1</button></div>', setup() { const count = ref(0); const increment = () => count.value++; return { count, increment } } }).mount(root)"
  }
}
\`\`\`

Example - Reactive list with messages:
\`\`\`json
{
  "type": "vue",
  "data": {
    "code": "setFluidSize({ showResizer: false, initialSize: { width: 400, height: 300 } }); Object.assign(root.style, { width: '100%', height: '100%', padding: '0', margin: '0' }); const resizeUI = ({ width, height }) => root.style.fontSize = Math.max(18, 24 * Math.min(width / 400, height / 300)) + 'px'; onResize(resizeUI); resizeUI({ width: Number(width), height: Number(height) }); const items = reactive([]); recv(msg => items.push(msg)); createApp({ template: '<ul class=\\"w-full h-full list-none p-0 m-0 overflow-auto\\"><li v-for=\\"item in items\\" class=\\"py-[0.25em] text-zinc-400\\">{{ item }}</li></ul>', setup() { return { items } } }).mount(root)"
  }
}
\`\`\`

Example - Two-way binding form:
\`\`\`json
{
  "type": "vue",
  "data": {
    "code": "setFluidSize({ showResizer: false, initialSize: { width: 400, height: 300 } }); Object.assign(root.style, { width: '100%', height: '100%', padding: '0', margin: '0' }); const resizeUI = ({ width, height }) => root.style.fontSize = Math.max(18, 24 * Math.min(width / 400, height / 300)) + 'px'; onResize(resizeUI); resizeUI({ width: Number(width), height: Number(height) }); noDrag(); const text = ref(''); const submit = () => send(text.value); createApp({ template: '<div class=\\"w-full h-full p-0 m-0\\"><input v-model=\\"text\\" class=\\"w-full p-[0.5em] mb-[0.5em] text-[1em] bg-zinc-800 border border-zinc-600 text-white rounded\\"><button @click=\\"submit\\" class=\\"w-full p-[0.5em] text-[1em] bg-green-400 text-black rounded cursor-pointer\\">Send</button></div>', setup() { return { text, submit } } }).mount(root)"
  }
}
\`\`\``;
