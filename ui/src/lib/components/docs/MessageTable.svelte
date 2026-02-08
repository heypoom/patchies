<script lang="ts">
  import { ChevronRight } from '@lucide/svelte/icons';
  import type { MessageSchema } from '$lib/objects/schemas/types';
  import { schemaToHtml, isComplexSchema, getSchemaTypeName } from '$lib/objects/schemas/utils';

  interface Props {
    messages: MessageSchema[];
    class?: string;
    compact?: boolean;
  }

  let { messages, class: className = '', compact = false }: Props = $props();

  // Track which complex messages are expanded (by index)
  let expanded = $state<Set<number>>(new Set());

  function toggleExpand(index: number) {
    if (expanded.has(index)) {
      expanded.delete(index);
    } else {
      expanded.add(index);
    }

    expanded = new Set(expanded);
  }
</script>

<div class="overflow-x-auto {className}">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase">
        <th class="pr-4 pb-2 font-medium">Message</th>
        <th class="pb-2 font-medium">Description</th>
      </tr>
    </thead>

    <tbody class="divide-y divide-zinc-800/50">
      {#each messages as msg, i}
        {@const isComplex = isComplexSchema(msg.schema)}
        {@const typeName = getSchemaTypeName(msg.schema)}
        {@const isExpanded = expanded.has(i)}

        <tr>
          <td class="py-2 pr-4 align-top">
            {#if isComplex}
              <button
                onclick={() => toggleExpand(i)}
                class="flex cursor-pointer items-center gap-1"
              >
                <ChevronRight
                  class={['h-3 w-3 text-zinc-500 transition-transform', isExpanded && 'rotate-90']}
                />
                <code class="rounded bg-zinc-800 px-1.5 py-0.5 text-xs whitespace-nowrap">
                  <span>{typeName}</span>
                </code>
              </button>
            {:else}
              <code class="rounded bg-zinc-800 px-1.5 py-0.5 text-xs whitespace-nowrap">
                {@html schemaToHtml(msg.schema)}
              </code>
            {/if}
          </td>

          <td class={['py-2 text-zinc-400', compact && 'text-xs']}>
            {msg.description}
          </td>
        </tr>

        {#if isComplex && isExpanded}
          <tr>
            <td colspan="2" class="pt-2 pb-2">
              <code class="ml-4 rounded bg-zinc-800 px-1.5 py-0.5 text-xs whitespace-nowrap">
                {@html schemaToHtml(msg.schema)}
              </code>
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>
