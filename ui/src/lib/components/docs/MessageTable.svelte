<script lang="ts">
  import type { MessageSchema } from '$lib/objects/schemas/types';
  import { schemaToString } from '$lib/objects/schemas/utils';

  interface Props {
    messages: MessageSchema[];
    class?: string;
  }

  let { messages, class: className = '' }: Props = $props();
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
      {#each messages as msg}
        <tr>
          <td class="py-2 pr-4 align-top">
            <code class="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
              {msg.example ?? schemaToString(msg.schema)}
            </code>
          </td>
          <td class="py-2 text-zinc-400">
            {msg.description}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
