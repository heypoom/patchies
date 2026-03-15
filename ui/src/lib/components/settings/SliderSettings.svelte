<script lang="ts">
  import { RotateCcw } from '@lucide/svelte/icons';
  import type { NodeDataTracker } from '$lib/history';

  type SliderData = {
    min?: number;
    max?: number;
    defaultValue?: number;
    isFloat?: boolean;
    value?: number;
    vertical?: boolean;
    runOnMount?: boolean;
    resizable?: boolean;
    locked?: boolean;
  };

  let {
    nodeId,
    data,
    tracker,
    onUpdate,
    onReset
  }: {
    nodeId: string;
    data: SliderData;
    tracker: NodeDataTracker;
    onUpdate: (updates: Partial<SliderData>) => void;
    onReset: () => void;
  } = $props();

  // Derived values with defaults
  const min = $derived(data.min ?? 0);
  const max = $derived(data.max ?? (data.isFloat ? 1 : 100));
  const defaultValue = $derived(data.defaultValue ?? min);
  const isFloat = $derived(data.isFloat ?? false);
  const isResizable = $derived(data.resizable ?? false);
</script>

<div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
  <div class="space-y-4">
    <div>
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="mb-2 block text-xs font-medium text-zinc-300">Mode</label>

      <div class="flex gap-2">
        <label class="flex items-center">
          <input
            type="radio"
            name="mode-{nodeId}"
            value="int"
            checked={!isFloat}
            onchange={() => {
              const oldValue = isFloat;
              onUpdate({ isFloat: false });
              tracker.commit('isFloat', oldValue, false);
            }}
            class="mr-2 h-3 w-3"
          />
          <span class="text-xs text-zinc-300">Integer</span>
        </label>

        <label class="flex items-center">
          <input
            type="radio"
            name="mode-{nodeId}"
            value="float"
            checked={isFloat}
            onchange={() => {
              const oldValue = isFloat;
              onUpdate({ isFloat: true });
              tracker.commit('isFloat', oldValue, true);
            }}
            class="mr-2 h-3 w-3"
          />
          <span class="text-xs text-zinc-300">Float</span>
        </label>
      </div>
    </div>

    <div>
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="mb-2 block text-xs font-medium text-zinc-300">Minimum</label>

      <input
        type="number"
        step={isFloat ? 0.01 : 1}
        value={min}
        onchange={(e) => {
          const oldMin = min;
          const newMin = parseFloat((e.target as HTMLInputElement).value);
          onUpdate({ min: newMin });
          tracker.commit('min', oldMin, newMin);
        }}
        class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
      />
    </div>

    <div>
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="mb-2 block text-xs font-medium text-zinc-300">Maximum</label>

      <input
        type="number"
        step={isFloat ? 0.01 : 1}
        value={max}
        onchange={(e) => {
          const oldMax = max;
          const newMax = parseFloat((e.target as HTMLInputElement).value);
          onUpdate({ max: newMax });
          tracker.commit('max', oldMax, newMax);
        }}
        class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
      />
    </div>

    <div>
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="mb-2 block text-xs font-medium text-zinc-300">Default Value</label>

      <input
        type="number"
        step={isFloat ? 0.01 : 1}
        value={defaultValue}
        {min}
        {max}
        onchange={(e) => {
          const oldDefault = defaultValue;
          const newDefault = parseFloat((e.target as HTMLInputElement).value);
          onUpdate({ defaultValue: newDefault });
          tracker.commit('defaultValue', oldDefault, newDefault);
        }}
        class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
      />
    </div>

    <div class="flex gap-x-4">
      <div class="flex gap-x-2">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Vertical</label>

        <input
          type="checkbox"
          checked={data.vertical}
          onchange={(e) => {
            const oldVertical = data.vertical ?? false;
            const newVertical = e.currentTarget.checked;
            onUpdate({ vertical: newVertical });
            tracker.commit('vertical', oldVertical, newVertical);
          }}
          class="h-4 w-4 cursor-pointer"
        />
      </div>

      <div class="flex gap-x-2">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Resize</label>

        <input
          type="checkbox"
          checked={isResizable}
          onchange={(e) => {
            const oldResizable = isResizable;
            const newResizable = e.currentTarget.checked;
            onUpdate({ resizable: newResizable });
            tracker.commit('resizable', oldResizable, newResizable);
          }}
          class="h-4 w-4 cursor-pointer"
        />
      </div>
    </div>

    <div class="pt-2">
      <button
        onclick={onReset}
        class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
      >
        <RotateCcw class="h-3 w-3" />
        Reset to Default
      </button>
    </div>
  </div>
</div>
