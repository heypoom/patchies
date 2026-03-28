<script lang="ts">
  import { marked } from '$lib/objects/fetch-object-help';
  import { ExternalLink } from '@lucide/svelte/icons';
  import { TRIGGER_TYPE_SPECS } from '$lib/objects/schemas/trigger';
  import PortCard from '$lib/components/docs/PortCard.svelte';

  let { data } = $props();

  const htmlContent = $derived(data.markdown ? (marked.parse(data.markdown) as string) : null);

  function openHelpPatch() {
    window.location.href = `/?help=${encodeURIComponent(data.objectType)}`;
  }
</script>

<svelte:head>
  <title>{data.objectType} | Patchies</title>
  <meta
    name="description"
    content={data.schema?.description ?? `Documentation for ${data.objectType} object in Patchies`}
  />
</svelte:head>

<!-- Header -->
<header class="mb-8">
  <div class="mb-1 flex items-start gap-3">
    <h1
      class="font-mono text-3xl font-bold text-zinc-50"
      style="letter-spacing: -0.015em; text-shadow: 0 0 60px rgba(249,115,22,0.12);"
    >
      {data.objectType}
    </h1>
  </div>
  {#if data.schema}
    <div class="mt-2 flex items-center gap-2">
      <span
        class="rounded border border-zinc-700/60 bg-zinc-800/50 px-2 py-0.5 font-mono text-xs text-zinc-500"
      >
        {data.schema.category}
      </span>
    </div>
    <p class="mt-3 text-sm leading-relaxed text-zinc-400">{data.schema.description}</p>
  {/if}
</header>

<!-- Schema-based documentation -->
{#if data.schema}
  <!-- Inlets -->
  {#if data.schema.inlets.length > 0}
    <section class="mb-6">
      <h2
        class="mb-3 border-l-2 border-orange-500 pl-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
        style="font-family: 'Syne', sans-serif;"
      >
        Inlets
      </h2>
      <div class="space-y-4">
        {#each data.schema.inlets as inlet}
          <PortCard port={inlet} />
        {/each}
      </div>
    </section>
  {/if}

  <!-- Outlets -->
  {#if data.schema.outlets.length > 0 && !data.schema.hasDynamicOutlets}
    <section class="mb-6">
      <h2
        class="mb-3 border-l-2 border-orange-500 pl-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
        style="font-family: 'Syne', sans-serif;"
      >
        Outlets
      </h2>
      <div class="space-y-4">
        {#each data.schema.outlets as outlet}
          <PortCard port={outlet} />
        {/each}
      </div>
    </section>
  {/if}

  <!-- Special: trigger type specifiers -->
  {#if data.objectType === 'trigger'}
    <section class="mb-6">
      <h2
        class="mb-3 border-l-2 border-orange-500 pl-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
        style="font-family: 'Syne', sans-serif;"
      >
        Type Specifiers
      </h2>
      <p class="mb-3 text-sm text-zinc-400">
        Outlets are created based on type specifiers. Use shorthand or full names:
      </p>
      <div class="grid grid-cols-2 gap-2">
        {#each Object.entries(TRIGGER_TYPE_SPECS) as [short, spec]}
          <div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div class="flex items-center gap-2">
              <span class={['font-mono text-sm', spec.color]}>{short}</span>
              <span class="text-xs text-zinc-500">({spec.name})</span>
            </div>
            <div class="mt-1 text-xs text-zinc-500">{spec.description}</div>
          </div>
        {/each}
      </div>
    </section>
  {/if}
{/if}

<!-- Prose documentation from markdown -->
{#if htmlContent}
  <section class="prose-markdown mb-8">
    {@html htmlContent}
  </section>
{/if}

<!-- CTA (only if help patch exists) -->
{#if data.hasHelpPatch}
  <div class="mb-2 border-t border-zinc-800 pt-6">
    <button
      onclick={openHelpPatch}
      class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-300 transition-colors hover:bg-blue-500/20"
    >
      <ExternalLink class="h-4 w-4" />
      Open Help Patch
    </button>
  </div>
{/if}

<!-- Tags -->
{#if data.schema?.tags && data.schema.tags.length > 0}
  <section class="mb-6">
    <h2
      class="mb-3 border-l-2 border-orange-500 pl-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
      style="font-family: 'Syne', sans-serif;"
    >
      Tags
    </h2>
    <div class="flex flex-wrap gap-1.5">
      {#each data.schema.tags as tag}
        <span
          class="rounded border border-zinc-700/50 bg-zinc-800/40 px-2 py-0.5 font-mono text-xs text-zinc-500"
          >{tag}</span
        >
      {/each}
    </div>
  </section>
{/if}
