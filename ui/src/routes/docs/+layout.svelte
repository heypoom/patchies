<script lang="ts">
  import DocsSidebar from '$lib/components/docs/DocsSidebar.svelte';
  import DocsNavigation from '$lib/components/docs/DocsNavigation.svelte';
  import { TooltipProvider } from '$lib/components/ui/tooltip';

  let { data, children } = $props();

  let sidebarVisible = $state(true);
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,700;1,9..144,400&family=Syne:wght@400;600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<TooltipProvider>
  <div class="patchies-docs docs-bg min-h-screen text-zinc-200">
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
        <DocsNavigation topics={data.index.topics} objects={data.index.objects} />
      </main>
    </div>
  </div>
</TooltipProvider>

<style>
  .docs-bg {
    background-color: #09090b;
    background-image: radial-gradient(
      ellipse 90% 55% at 10% 0%,
      rgba(249, 115, 22, 0.05) 0%,
      transparent 60%
    );
  }
</style>
