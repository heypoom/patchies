<script lang="ts">
  import { marked } from '$lib/objects/fetch-object-help';
  import { ArrowLeft, ExternalLink } from '@lucide/svelte/icons';
  import { TRIGGER_TYPE_SPECS } from '$lib/objects/schemas/trigger';

  let { data } = $props();

  const htmlContent = $derived(data.markdown ? (marked.parse(data.markdown) as string) : null);

  function openHelpPatch() {
    window.location.href = `/?help=${encodeURIComponent(data.objectType)}`;
  }
</script>

<svelte:head>
  <title>{data.objectType} - Patchies Documentation</title>
  <meta
    name="description"
    content={data.schema?.description ?? `Documentation for ${data.objectType} object in Patchies`}
  />
</svelte:head>

<div class="patchies-docs min-h-screen bg-zinc-950 text-zinc-200">
  <div class="mx-auto max-w-2xl px-4 py-8">
    <!-- Header -->
    <header class="mb-8">
      <a
        href="/"
        class="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft class="h-4 w-4" />
        Back to Patchies
      </a>

      <div class="flex items-center gap-3">
        <h1 class="font-mono text-2xl font-bold text-zinc-100">{data.objectType}</h1>
        {#if data.schema}
          <span class="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-500">
            {data.schema.category}
          </span>
        {/if}
      </div>

      {#if data.schema}
        <p class="mt-2 text-zinc-400">{data.schema.description}</p>
      {/if}
    </header>

    <!-- Schema-based documentation -->
    {#if data.schema}
      <!-- Inlets -->
      {#if data.schema.inlets.length > 0}
        <section class="mb-6">
          <h2 class="mb-3 text-sm font-medium tracking-wider text-zinc-500 uppercase">Inlets</h2>
          <div class="space-y-2">
            {#each data.schema.inlets as inlet}
              <div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div class="font-mono text-sm text-zinc-200">{inlet.id}</div>
                <div class="mt-1 text-sm text-zinc-400">{inlet.description}</div>
                {#if inlet.args}
                  <div class="mt-2 text-xs text-zinc-500">
                    Args: <span class="font-mono">{inlet.args.join(', ')}</span>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Outlets -->
      {#if data.schema.outlets.length > 0 && !data.schema.hasDynamicOutlets}
        <section class="mb-6">
          <h2 class="mb-3 text-sm font-medium tracking-wider text-zinc-500 uppercase">Outlets</h2>
          <div class="space-y-2">
            {#each data.schema.outlets as outlet}
              <div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div class="font-mono text-sm text-zinc-200">{outlet.id}</div>
                <div class="mt-1 text-sm text-zinc-400">{outlet.description}</div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Special: trigger type specifiers -->
      {#if data.objectType === 'trigger'}
        <section class="mb-6">
          <h2 class="mb-3 text-sm font-medium tracking-wider text-zinc-500 uppercase">
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
      <div class="border-t border-zinc-800 pt-6">
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
    {#if data.schema.tags && data.schema.tags.length > 0}
      <section class="mb-6">
        <h2 class="mb-3 text-sm font-medium tracking-wider text-zinc-500 uppercase">Tags</h2>
        <div class="flex flex-wrap gap-2">
          {#each data.schema.tags as tag}
            <span class="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">{tag}</span>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</div>
