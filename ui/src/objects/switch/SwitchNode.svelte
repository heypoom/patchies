<script lang="ts">
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { SwitchObject } from '$objects/switch/SwitchObject';
  import { Switch } from '$lib/components/ui/switch';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { untrack } from 'svelte';
  import { useNodeDataTracker } from '$lib/history';
  import { useNodeViewMessageContext } from '$lib/runtime/useNodeViewMessageContext.svelte';

  let { id: nodeId, selected, data }: { id: string; selected: boolean; data: any } = $props();

  const { updateNodeData } = useSvelteFlow();

  // Undo/redo tracking
  const tracker = $derived.by(() => useNodeDataTracker(nodeId));
  const viewMessageContext = useNodeViewMessageContext(untrack(() => nodeId), () => {});

  // Get toggle state from node data, default to false
  let isOn = $derived(data.value === true);
  const switchOutlet = SwitchObject.outlets[0];

  const handleCheckedChange = (checked: boolean) => {
    const oldValue = isOn;
    updateNodeData(nodeId, { value: checked });
    tracker.commit('value', oldValue, checked);
    viewMessageContext.send(checked);
  };
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

      <TypedHandle
        port="outlet"
        spec={switchOutlet.handle!}
        total={1}
        index={0}
        class="!top-6"
        {nodeId}
      />
    </div>
  </div>
</div>
