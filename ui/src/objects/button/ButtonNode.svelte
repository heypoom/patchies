<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { objectSchemas } from '$lib/objects/schemas';

  import { shouldShowHandles } from '../../stores/ui.store';

  let { id: nodeId, selected }: { id: string; selected: boolean } = $props();

  let isFlashing = $state(false);
  let flashTimeout: ReturnType<typeof setTimeout> | null = null;
  let messageContext: MessageContext | null = null;

  const flash = () => {
    isFlashing = true;

    if (flashTimeout) clearTimeout(flashTimeout);

    flashTimeout = setTimeout(() => {
      isFlashing = false;
      flashTimeout = null;
    }, 150);
  };

  const handleClick = () =>
    messageContext?.queue.sendMessage({ data: { type: 'bang' }, source: nodeId });
  const buttonSchema = objectSchemas.button;

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.messageCallbacks = [flash];

    return () => {
      messageContext?.destroy({ unregisterNode: false });
      messageContext = null;
    };
  });

  onDestroy(() => {
    if (flashTimeout) {
      clearTimeout(flashTimeout);
    }
  });

  const borderColor = $derived(selected ? '!border-zinc-400' : '!border-zinc-600');

  const handleClass = $derived.by(() => {
    // makes handle obvious in connection mode.
    if (!selected && $shouldShowHandles) {
      return '';
    }

    if (selected) {
      return '!bg-gray-400';
    }

    return '!bg-zinc-900 !border-zinc-600';
  });
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="relative">
        <TypedHandle
          port="inlet"
          spec={buttonSchema.inlets[0].handle!}
          total={1}
          index={0}
          class={handleClass}
          {nodeId}
        />

        <button
          onclick={handleClick}
          class={[
            'h-10 w-10 cursor-pointer rounded-full border font-mono text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 active:bg-zinc-600',
            isFlashing ? '!border-transparent bg-zinc-500' : `${borderColor} bg-zinc-900`,
            selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
          ]}
          aria-label="send bang"
        >
        </button>

        <TypedHandle
          port="outlet"
          spec={buttonSchema.outlets[0].handle!}
          total={1}
          index={0}
          class={`absolute !bottom-1.5 ${handleClass}`}
          {nodeId}
        />
      </div>
    </div>
  </div>
</div>
