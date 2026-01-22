import { messagingInstructions } from './shared-messaging';

export const vuePrompt = `## vue Object Instructions

Vue 3 reactive components with Composition API. Container is fluid-sized by default.

**Available Context:**
- root: HTMLDivElement - the container element to mount your Vue app
- width, height: Container dimensions (undefined if fluid, set after setSize)
- setSize(w, h): Set fixed container dimensions
- setPortCount(inlets, outlets): Configure message ports
- setTitle(title): Set node title
- setHidePorts(hide): Hide/show ports
- noDrag(): Disable node dragging (useful for interactive elements)

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

Example - Simple reactive counter:
\`\`\`json
{
  "type": "vue",
  "data": {
    "code": "noDrag(); setSize(150, 80); createApp({ template: '<div style=\"padding: 16px; text-align: center;\"><h2 style=\"color: #4ade80; margin: 0;\">{{ count }}</h2><button @click=\"increment\" style=\"margin-top: 8px; padding: 4px 12px; background: #4ade80; border: none; border-radius: 4px; cursor: pointer;\">+1</button></div>', setup() { const count = ref(0); const increment = () => count.value++; return { count, increment } } }).mount(root)"
  }
}
\`\`\`

Example - Reactive list with messages:
\`\`\`json
{
  "type": "vue",
  "data": {
    "code": "setSize(200, 150); const items = reactive([]); recv(msg => items.push(msg)); createApp({ template: '<ul style=\"list-style: none; padding: 8px; margin: 0;\"><li v-for=\"item in items\" style=\"padding: 4px; color: #a1a1aa;\">{{ item }}</li></ul>', setup() { return { items } } }).mount(root)"
  }
}
\`\`\`

Example - Two-way binding form:
\`\`\`json
{
  "type": "vue",
  "data": {
    "code": "noDrag(); setSize(250, 100); const text = ref(''); const submit = () => send(text.value); createApp({ template: '<div style=\"padding: 8px;\"><input v-model=\"text\" style=\"width: 100%; padding: 8px; margin-bottom: 8px; background: #27272a; border: 1px solid #52525b; color: white; border-radius: 4px;\"><button @click=\"submit\" style=\"width: 100%; padding: 8px; background: #4ade80; border: none; border-radius: 4px; cursor: pointer;\">Send</button></div>', setup() { return { text, submit } } }).mount(root)"
  }
}
\`\`\``;
