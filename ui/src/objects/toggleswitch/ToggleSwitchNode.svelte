<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';

  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { ToggleSwitchObject } from '$objects/toggleswitch/ToggleSwitchObject';
  import { Switch } from '$lib/components/ui/switch';
  import { useNodeDataTracker } from '$lib/history';
  import { useNodeViewMessageContext } from '$lib/messages';

  let {
    id: nodeId,
    selected,
    data
  }: { id: string; selected: boolean; data: { value: boolean } } = $props();

  const { updateNodeData } = useSvelteFlow();
  const tracker = $derived.by(() => useNodeDataTracker(nodeId));

  const viewMessageContext = useNodeViewMessageContext(
    () => nodeId,
    () => {}
  );

  const isOn = $derived(data.value === true);
  const switchOutlet = ToggleSwitchObject.outlets[0];

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
