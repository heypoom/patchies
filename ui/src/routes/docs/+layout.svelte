<script lang="ts">
  import DocsSidebar from '$lib/components/docs/DocsSidebar.svelte';

  let { data, children } = $props();

  let sidebarVisible = $state(true);
</script>

<div class="patchies-docs min-h-screen bg-zinc-950 text-zinc-200">
  <div
    class="mx-auto flex px-4 py-8 transition-all duration-300"
    class:max-w-5xl={sidebarVisible}
    class:max-w-3xl={!sidebarVisible}
  >
    <DocsSidebar
      topics={data.index.topics}
      objects={data.index.objects}
      bind:visible={sidebarVisible}
    />

    <!-- Main content -->
    <main class="min-w-0 flex-1">
      {@render children()}
    </main>
  </div>
</div>
