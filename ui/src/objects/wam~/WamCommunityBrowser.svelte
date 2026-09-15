<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { fetchWamCommunityPlugins, type WamCommunityPlugin } from './wam-community-plugins';

  let {
    open = $bindable(false),
    onSelect
  }: {
    open: boolean;
    onSelect: (plugin: WamCommunityPlugin) => void;
  } = $props();

  let plugins = $state<WamCommunityPlugin[]>([]);
  let query = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let unavailableThumbnails = $state<Record<string, true>>({});

  const filteredPlugins = $derived.by(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return plugins;

    return plugins.filter((plugin) => {
      const searchableText = [plugin.name, plugin.vendor, plugin.description, ...plugin.categories]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  });

  async function loadPlugins() {
    loading = true;
    error = null;

    try {
      plugins = await fetchWamCommunityPlugins();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Could not load community plugins.';
    } finally {
      loading = false;
    }
  }

  function selectPlugin(plugin: WamCommunityPlugin) {
    onSelect(plugin);
    open = false;
  }

  function hideThumbnail(plugin: WamCommunityPlugin) {
    unavailableThumbnails[plugin.url] = true;
  }

  $effect(() => {
    if (open) void loadPlugins();
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="nowheel flex max-h-[min(42rem,calc(100dvh-2rem))] max-w-2xl flex-col gap-4 p-0"
  >
    <Dialog.Header class="px-5 pt-5 sm:px-6 sm:pt-6">
      <Dialog.Title>Browse community WAMs</Dialog.Title>
      <Dialog.Description>
        Choose a plugin to copy its entry URL into this node’s settings.
      </Dialog.Description>
    </Dialog.Header>

    <div class="px-5 sm:px-6">
      <input
        class="nodrag nowheel w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
        placeholder="Search plugins, vendors, or categories"
        bind:value={query}
      />
    </div>

    <div class="min-h-0 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
      {#if loading}
        <p class="py-8 text-center text-sm text-zinc-400">Loading community plugins…</p>
      {:else if error}
        <div class="rounded-md border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      {:else if filteredPlugins.length === 0}
        <p class="py-8 text-center text-sm text-zinc-400">No matching community plugins.</p>
      {:else}
        <div class="grid gap-2">
          {#each filteredPlugins as plugin (plugin.url)}
            <button
              type="button"
              class="cursor-pointer rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-800"
              onclick={() => selectPlugin(plugin)}
            >
              <div class="flex gap-3">
                {#if plugin.thumbnailUrl && !unavailableThumbnails[plugin.url]}
                  <img
                    class="h-14 w-14 shrink-0 rounded border border-zinc-700 bg-zinc-950 object-cover"
                    src={plugin.thumbnailUrl}
                    alt=""
                    onerror={() => hideThumbnail(plugin)}
                  />
                {/if}

                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline justify-between gap-3">
                    <span class="truncate font-medium text-zinc-100">{plugin.name}</span>
                    {#if plugin.vendor}
                      <span class="shrink-0 text-xs text-zinc-400">{plugin.vendor}</span>
                    {/if}
                  </div>

                  {#if plugin.description}
                    <p class="mt-1 line-clamp-2 text-xs text-zinc-400">{plugin.description}</p>
                  {/if}

                  {#if plugin.categories.length > 0}
                    <p class="mt-2 font-mono text-[10px] text-zinc-500">
                      {plugin.categories.join(' · ')}
                    </p>
                  {/if}
                </div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
