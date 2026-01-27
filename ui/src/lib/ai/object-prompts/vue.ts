import { messagingInstructions } from './shared-messaging';

export const vuePrompt = `## vue Object Instructions

Vue 3 reactive components with Composition API. Container is fluid-sized by default.

**Tailwind CSS is enabled by default!** Use Tailwind utility classes for styling in templates. Call \`tailwind(false)\` to disable it for better performance if not needed.

**Available Context:**
- root: HTMLDivElement - the container element to mount your Vue app
- width, height: Container dimensions (undefined if fluid, set after setSize)
- setSize(w, h): Set fixed container dimensions
- setPortCount(inlets, outlets): Configure message ports
- setTitle(title): Set node title
- setHidePorts(hide): Hide/show ports
- noDrag(): Disable node dragging (useful for interactive elements)
- tailwind(enabled): Enable/disable Tailwind CSS (enabled by default)

**Vue 3 APIs (auto-imported):**
- createApp: Create and mount Vue applications
- ref, reactive: Reactive state
- computed: Computed properties
- watch, watchEffect: Watchers
- onMounted, onUnmounted: Lifecycle hooks
- nextTick: DOM update timing
- h: Render function helper
- defineComponent: Component definition

${messagingInstructions}

**Handle IDs:**
- Message inlet: "in-0", "in-1", etc.
- Message outlet: "out-0", "out-1", etc.

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
