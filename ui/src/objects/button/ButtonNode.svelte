<script lang="ts">
  import { onDestroy } from 'svelte';

  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { objectSchemas } from '$lib/objects/schemas';
  import { useNodeViewMessageContext } from '$lib/runtime/useNodeViewMessageContext.svelte';

  import { shouldShowHandles } from '../../stores/ui.store';

  let { id: nodeId, selected }: { id: string; selected: boolean } = $props();

  let isFlashing = $state(false);
  let flashTimeout: ReturnType<typeof setTimeout> | null = null;

  const flash = () => {
    isFlashing = true;

    if (flashTimeout) clearTimeout(flashTimeout);

    flashTimeout = setTimeout(() => {
      isFlashing = false;
      flashTimeout = null;
    }, 150);
  };

  const viewMessageContext = useNodeViewMessageContext(nodeId, flash);
  const handleClick = () => viewMessageContext.send({ type: 'bang' });
  const buttonSchema = objectSchemas.button;

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
