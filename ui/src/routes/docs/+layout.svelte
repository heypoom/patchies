<script lang="ts">
  import DocsSidebar from '$lib/components/docs/DocsSidebar.svelte';

  let { data, children } = $props();
</script>

<div class="patchies-docs min-h-screen bg-zinc-950 text-zinc-200">
  <div class="mx-auto flex max-w-5xl px-4 py-8">
    <DocsSidebar topics={data.index.topics} objects={data.index.objects} />

    <!-- Main content -->
    <main class="min-w-0 flex-1">
      {@render children()}
    </main>
  </div>
</div>
