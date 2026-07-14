<script lang="ts">
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { onMount } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { objectSchemas } from '$lib/objects/schemas';

  import { shouldShowHandles } from '../../stores/ui.store';

  let { id: nodeId, selected, data }: { id: string; selected: boolean; data: any } = $props();

  const toggleSchema = objectSchemas.toggle;
  let messageContext: MessageContext | null = null;
  const toggleValue = () =>
    messageContext?.queue.sendMessage({ data: { type: 'bang' }, source: nodeId });

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.messageCallbacks = [() => {}];

    return () => {
      messageContext?.destroy({ unregisterNode: false });
      messageContext = null;
    };
  });

  let isOn = $derived((data.params?.[0] ?? data.value) === true);

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

  const buttonClass = $derived.by(() => {
    const baseClass =
      'h-10 w-10 cursor-pointer rounded-lg border font-mono text-xs font-medium transition-colors';

    const glowClass = selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm';

    if (isOn) {
      return `${baseClass} ${borderColor} ${glowClass} bg-zinc-300 hover:bg-zinc-100 active:bg-zinc-400 text-white`;
    } else {
      return `${baseClass} ${borderColor} ${glowClass} bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-600 text-zinc-200`;
    }
  });
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="relative">
        <TypedHandle
          port="inlet"
          spec={toggleSchema.inlets[0].handle!}
          total={1}
          index={0}
          class={handleClass}
          {nodeId}
        />

        <button onclick={toggleValue} class={buttonClass} aria-label="toggle button"> </button>

        <TypedHandle
          port="outlet"
          spec={toggleSchema.outlets[0].handle!}
          total={1}
          index={0}
          class={`absolute !bottom-1.5 ${handleClass}`}
          {nodeId}
        />
      </div>
    </div>
  </div>
</div>
