export const VFS_BROWSER_VUE = `setTitle('File Browser')
noBorder()
setFluidSize({ initialSize: { width: 460, height: 560 } })
setPortCount(1, 1)

const query = ref('')
const tree = ref([])
const searchResults = ref([])
const selectedPath = ref('')
const selectedUrl = ref('')
const loading = ref(false)
const error = ref('')

function createNode(path) {
  return {
    path,
    name: path.split('/').filter(Boolean).pop() || path,
    children: null,
    expanded: false,
    loading: false
  }
}

const visibleRows = computed(() => {
  const rows = []

  function visit(nodes, depth) {
    for (const node of nodes) {
      rows.push({ node, depth })
      if (node.expanded && node.children) visit(node.children, depth + 1)
    }
  }

  visit(tree.value, 0)
  return rows
})

async function loadChildren(node, quiet = false) {
  node.loading = true
  if (!quiet) error.value = ''

  try {
    node.children = (await vfs.list(node.path)).map(createNode)
    await Promise.all(
      node.children.map(async (child) => {
        try {
          child.children = (await vfs.list(child.path)).map(createNode)
        } catch {
          child.children = []
        }
      })
    )
    return node.children.length > 0
  } catch (cause) {
    if (!quiet) error.value = String(cause)
    node.children = []
    return false
  } finally {
    node.loading = false
  }
}

async function refresh() {
  loading.value = true
  selectedPath.value = ''
  selectedUrl.value = ''
  const root = createNode('.')
  await loadChildren(root)
  tree.value = root.children
  loading.value = false
}

async function toggle(node) {
  if (node.expanded) {
    node.expanded = false
    return
  }

  const hasChildren = node.children === null ? await loadChildren(node, true) : node.children.length > 0
  if (hasChildren) {
    await Promise.all(
      node.children.filter((child) => child.children === null).map((child) => loadChildren(child, true))
    )
    node.expanded = true
    return
  }

  await selectFile(node.path)
}

async function search() {
  const trimmed = query.value.trim()
  if (!trimmed) {
    searchResults.value = []
    return
  }

  loading.value = true
  error.value = ''

  try {
    searchResults.value = await vfs.search(trimmed, '.')
  } catch (cause) {
    error.value = String(cause)
  } finally {
    loading.value = false
  }
}

async function selectFile(path) {
  error.value = ''
  selectedPath.value = path
  send(path)

  try {
    selectedUrl.value = await vfs.getUrl(path)
  } catch (cause) {
    selectedUrl.value = ''
    error.value = \`Could not resolve \${path}: \${String(cause)}\`
  }
}

async function navigateRows(event) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return

  event.preventDefault()
  event.stopPropagation()

  const rows = Array.from(event.currentTarget.querySelectorAll('[data-vfs-browser-row]'))
  if (rows.length === 0) return

  const focusedRow = event.target.closest('[data-vfs-browser-row]')

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const path = focusedRow?.dataset.vfsPath
    const row = visibleRows.value.find((item) => item.node.path === path)
    const isFolder = row?.node.children && row.node.children.length > 0

    if (isFolder && ((event.key === 'ArrowRight' && !row.node.expanded) || (event.key === 'ArrowLeft' && row.node.expanded))) {
      await toggle(row.node)
    }
    return
  }

  const currentIndex = rows.indexOf(focusedRow)
  const direction = event.key === 'ArrowDown' ? 1 : -1
  const nextIndex = currentIndex === -1
    ? (direction > 0 ? 0 : rows.length - 1)
    : Math.max(0, Math.min(rows.length - 1, currentIndex + direction))

  rows[nextIndex].focus()
}

watch(query, search)
refresh()

createApp({
  setup() {
    return {
      error,
      loading,
      query,
      refresh,
      searchResults,
      selectFile,
      selectedPath,
      selectedUrl,
      toggle,
      navigateRows,
      visibleRows
    }
  },
  template: \`
    <main class="flex h-full min-h-0 flex-col overflow-hidden rounded-[10px] border border-zinc-700 bg-[#09090b] font-sans text-sm text-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.35)]" @keydown="navigateRows">
      <section class="border-b border-zinc-800 px-3 py-2.5">
        <div class="flex items-center gap-2">
          <label class="relative min-w-0 flex-1">
            <span class="sr-only">Search files</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
            <input
              v-model="query"
              class="nodrag h-8 w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-8 pr-2.5 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
              placeholder="Search files and folders"
            />
          </label>
          <button
            class="nodrag flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="loading"
            @click="refresh"
            aria-label="Refresh files"
          ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.8-4.2L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14.8 4.2L21 15"/><path d="M21 20v-5h-5"/></svg></button>
        </div>
      </section>

      <section class="nowheel min-h-0 flex-1 overflow-y-auto p-2">
        <p v-if="loading" class="flex items-center gap-2 px-2 py-3 text-xs text-zinc-400"><span class="size-1.5 animate-pulse rounded-full bg-orange-400"></span> Reading files…</p>
        <p v-else-if="error" class="mx-1 rounded-md border border-red-900/70 bg-red-950/30 px-2.5 py-2 text-xs leading-5 text-red-200">{{ error }}</p>

        <template v-else-if="query.trim()">
          <p v-if="searchResults.length === 0" class="px-2 py-5 text-center text-xs text-zinc-500">No matching files in this patch.</p>
          <div v-else class="space-y-px">
            <button
              v-for="path in searchResults"
              :key="path"
              data-vfs-browser-row
              :data-vfs-path="path"
              class="nodrag flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70"
              @click="selectFile(path)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5 shrink-0 text-zinc-500" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>
              <code class="truncate">{{ path }}</code>
            </button>
          </div>
        </template>

        <template v-else>
          <p v-if="visibleRows.length === 0" class="px-2 py-5 text-center text-xs text-zinc-500">Drop files into the patch to browse them here.</p>
          <div v-else class="space-y-px">
            <button
              v-for="row in visibleRows"
              :key="row.node.path"
              data-vfs-browser-row
              :data-vfs-path="row.node.path"
              class="nodrag flex h-7 w-full cursor-pointer items-center gap-1 rounded-md py-1 text-left text-[12px] text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70"
              :class="selectedPath === row.node.path ? 'bg-orange-400/15 text-zinc-50 ring-1 ring-inset ring-orange-400/30' : ''"
              :style="{ paddingLeft: (row.depth * 16 + 8) + 'px' }"
              @click="toggle(row.node)"
            >
              <span class="flex size-4 shrink-0 items-center justify-center text-zinc-500">
                <svg v-if="row.node.loading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3 animate-spin" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7"/></svg>
                <svg v-else-if="row.node.children && row.node.children.length" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3 transition-transform" :class="row.node.expanded ? 'rotate-90' : ''" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
              </span>
              <svg v-if="row.node.children && row.node.children.length" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5 shrink-0 text-orange-400" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h5l1.8 2h8.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/><path d="M3 9h18"/></svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5 shrink-0 text-zinc-500" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>
              <span class="truncate">{{ row.node.name }}</span>
            </button>
          </div>
        </template>
      </section>

      <footer class="border-t border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">
        <template v-if="selectedPath">
          <div class="flex min-w-0 items-center gap-2">
            <code class="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300">{{ selectedPath }}</code>
            <a v-if="selectedUrl" :href="selectedUrl" target="_blank" rel="noreferrer" class="nodrag inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-sm py-0.5 text-zinc-400 transition-colors hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70">Open file <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3" aria-hidden="true"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg></a>
          </div>
        </template>
        <p v-else class="text-zinc-500">Select a file to send its <code class="font-mono text-zinc-400">user://</code> path from the outlet.</p>
      </footer>
    </main>
  \`
}).mount(root)`;

export const vfsBrowserPreset = {
  type: 'vue' as const,
  description: 'Explore and search the patch virtual filesystem',
  data: {
    code: VFS_BROWSER_VUE,
    inletCount: 1,
    outletCount: 1
  }
};
