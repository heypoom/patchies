<script lang="ts">
  import { uiuaGlyphDocs, type UiuaGlyphDoc } from '$lib/uiua/uiua-docs';
  import { match } from 'ts-pattern';

  let {
    onInsert
  }: {
    onInsert: (glyph: string) => void;
  } = $props();

  // Tooltip state
  let tooltipDoc = $state<UiuaGlyphDoc | null>(null);

  // Group glyphs by type
  const categories = [
    { key: 'stack', label: 'Stack' },
    { key: 'monadic function', label: 'Monadic' },
    { key: 'dyadic function', label: 'Dyadic' },
    { key: 'monadic modifier', label: '1-Mod' },
    { key: 'dyadic modifier', label: '2-Mod' },
    { key: 'constant', label: 'Const' }
  ] as const;

  const glyphsByCategory = $derived.by(() => {
    const grouped = new Map<string, UiuaGlyphDoc[]>();
    for (const cat of categories) {
      grouped.set(cat.key, []);
    }
    for (const doc of Object.values(uiuaGlyphDocs)) {
      grouped.get(doc.type)?.push(doc);
    }
    return grouped;
  });

  function getGlyphColor(type: string): string {
    return match(type)
      .with('monadic function', () => 'text-[#7dcfff]')
      .with('dyadic function', () => 'text-[#9ece6a]')
      .with('monadic modifier', () => 'text-[#bb9af7]')
      .with('dyadic modifier', () => 'text-[#e0af68]')
      .with('constant', () => 'text-[#ff9e64]')
      .otherwise(() => 'text-[#c0caf5]');
  }

  function handleClick(e: MouseEvent, doc: UiuaGlyphDoc) {
    if (e.shiftKey) {
      window.open(doc.docUrl, '_blank');
    } else {
      onInsert(doc.glyph);
    }
  }
</script>

<!-- Prevent mousedown from stealing focus from the editor -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="nodrag nowheel nopan flex max-w-[400px] flex-col gap-1 rounded-md border border-zinc-600 bg-zinc-900 py-2 shadow-xl"
  onmousedown={(e) => e.preventDefault()}
>
  {#each categories as cat}
    {@const glyphs = glyphsByCategory.get(cat.key)}
    {#if glyphs && glyphs.length > 0}
      <div class="flex items-start gap-1.5">
        <span class="w-12 shrink-0 pt-1.5 text-right font-mono text-[8px] text-zinc-500"
          >{cat.label}</span
        >

        <div class="flex flex-wrap gap-0.5">
          {#each glyphs as doc}
            <button
              class={[
                'flex h-6 w-6 cursor-pointer items-center justify-center rounded text-sm transition-colors hover:bg-zinc-700',
                getGlyphColor(doc.type)
              ]}
              style="font-family: 'Uiua', 'IBM Plex Mono', monospace;"
              title={`${doc.name} (${doc.signature}) — shift+click for docs`}
              onclick={(e) => handleClick(e, doc)}
              onpointerenter={() => (tooltipDoc = doc)}
              onpointerleave={() => (tooltipDoc = null)}
            >
              {doc.glyph}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/each}

  <!-- Inline tooltip -->
  {#if tooltipDoc}
    <div class="border-t border-zinc-700 px-4 pt-1.5 pb-1">
      <div class="flex items-center gap-2">
        <span
          class="text-lg text-amber-400"
          style="font-family: 'Uiua', 'IBM Plex Mono', monospace;">{tooltipDoc.glyph}</span
        >
        <span class="text-xs font-semibold text-zinc-100">{tooltipDoc.name}</span>
        <span class="text-[10px] text-zinc-400">{tooltipDoc.type} {tooltipDoc.signature}</span>
      </div>
      <div class="mt-0.5 text-xs text-zinc-300">{tooltipDoc.description}</div>
    </div>
  {/if}
</div>
