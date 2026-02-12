<script lang="ts">
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import { onMount } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import { useNodeDataTracker } from '$lib/history';

  let { id: nodeId, selected, data }: { id: string; selected: boolean; data: any } = $props();

  let messageContext: MessageContext;
  const { updateNodeData } = useSvelteFlow();

  // Undo/redo tracking
  const tracker = useNodeDataTracker(nodeId);

  // Get toggle state from node data, default to false
  let isOn = $derived(data.value ?? false);

  const handleCheckedChange = (checked: boolean) => {
    const oldValue = isOn;
    updateNodeData(nodeId, { value: checked });
    tracker.commit('value', oldValue, checked);
    setTimeout(() => {
      messageContext.send(checked);
    }, 0);
  };

  onMount(() => {
    messageContext = new MessageContext(nodeId);

    return () => {
      messageContext.destroy();
    };
  });
</script>

<div class="relative">
  <div class="group relative">
    <div class="relative">
      <Switch
        checked={isOn}
        onCheckedChange={handleCheckedChange}
        class={[
          'cursor-pointer data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-zinc-700',
          selected && 'shadow-glow-sm'
        ]}
      />

      <StandardHandle port="outlet" type="message" total={1} index={0} class="!top-6" {nodeId} />
    </div>
  </div>
</div>
