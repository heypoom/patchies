<script lang="ts">
  import { Settings, X } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import { useNodeDataTracker } from '$lib/history';

  let node: {
    id: string;
    data: {
      min?: number;
      max?: number;
      defaultValue?: number;
      isFloat?: boolean;
      value?: number;
      vertical?: boolean;
      runOnMount?: boolean;
      resizable?: boolean;
    };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData, updateNode } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  // Undo/redo tracking for node data changes
  const tracker = useNodeDataTracker(node.id);
  const valueTracker = tracker.track('value', () => node.data.value ?? defaultValue);

  let messageContext: MessageContext;
  let showSettings = $state(false);
  let sliderElement: HTMLInputElement;

  // Configuration values with defaults
  const min = $derived(node.data.min ?? 0);
  const max = $derived(node.data.max ?? (node.data.isFloat ? 1 : 100));
  const defaultValue = $derived(node.data.defaultValue ?? min);
  const isFloat = $derived(node.data.isFloat ?? false);
  const currentValue = $derived(node.data.value ?? defaultValue);
  const sliderWidth = $derived(node.width ?? 130);
  const sliderHeight = $derived(node.height ?? 140);
  const isResizable = $derived(node.data.resizable ?? false);
  // Settings panel position: use node width for horizontal, fixed for vertical
  const settingsLeftOffset = $derived(node.data.vertical ? 40 : sliderWidth + 10);

  // For display formatting
  const displayValue = $derived(
    isFloat ? Number(currentValue).toFixed(2) : Math.round(currentValue).toString()
  );

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with(P.number, (value) => {
        const newValue = Math.min(Math.max(value, min), max);
        updateNodeData(node.id, { ...node.data, value: newValue });
        messageContext.send(newValue);

        if (sliderElement) sliderElement.value = newValue.toString();
      })
      .with(messages.reset, () => {
        updateNodeData(node.id, { ...node.data, value: defaultValue });
        messageContext.send(defaultValue);

        if (sliderElement) sliderElement.value = defaultValue.toString();
      })
      .with(messages.bang, () => {
        messageContext.send(currentValue);
      });
  };

  function handleSliderChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const rawValue = parseFloat(target.value);

    // Apply proper precision based on mode
    const newValue = isFloat ? rawValue : Math.round(rawValue);

    if (newValue !== currentValue) {
      updateNodeData(node.id, { ...node.data, value: newValue });
      messageContext.send(newValue);
    }
  }

  function updateConfig(updates: Partial<typeof node.data>) {
    const newData = { ...node.data, ...updates };

    // Ensure value is within new bounds
    if ('min' in updates || 'max' in updates) {
      const newMin = updates.min ?? min;
      const newMax = updates.max ?? max;
      const clampedValue = Math.min(Math.max(currentValue, newMin), newMax);
      if (clampedValue !== currentValue) {
        newData.value = clampedValue;
      }
    }

    // Set appropriate default dimensions when switching orientation
    if ('vertical' in updates) {
      if (updates.vertical) {
        // Switching to vertical: narrow width, default height
        updateNode(node.id, { width: 30, height: 130 });
      } else {
        // Switching to horizontal: default width, auto height
        updateNode(node.id, { width: 130, height: undefined });
      }
    }

    updateNodeData(node.id, newData);

    setTimeout(() => {
      updateNodeInternals();
    }, 5);
  }

  onMount(() => {
    messageContext = new MessageContext(node.id);
    messageContext.queue.addCallback(handleMessage);

    // Initialize slider value
    if (sliderElement) {
      sliderElement.value = currentValue.toString();
    }

    // Run on mount by default.
    setTimeout(() => {
      if (node.data.runOnMount ?? true) {
        messageContext.send(currentValue);
      }
    }, 100);
  });

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
  });

  // Update node internals when size changes
  $effect(() => {
    sliderWidth;
    sliderHeight;

    setTimeout(() => {
      updateNodeInternals();
    }, 0);
  });

  const sliderClass = $derived.by(() => {
    if (node.data.vertical) {
      return '';
    }

    return [
      'h-1 w-full cursor-pointer appearance-none rounded-lg [&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-lg [&::-moz-range-progress]:bg-blue-500 [&::-moz-range-thumb:hover]:bg-zinc-100 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-zinc-300 [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-lg [&::-moz-range-track]:border-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-300 [&::-webkit-slider-track]:h-1 [&::-webkit-slider-track]:rounded-lg'
    ];
  });

  const handleInletClass = $derived.by(() => {
    if (node.selected || $shouldShowHandles) {
      return '';
    }

    return 'opacity-30 group-hover:opacity-100 sm:opacity-0';
  });
</script>

<div class="relative">
  {#if isResizable}
    <NodeResizer
      isVisible={node.selected}
      minWidth={node.data.vertical ? 30 : 60}
      maxWidth={node.data.vertical ? 30 : 500}
      minHeight={node.data.vertical ? 80 : 70}
      maxHeight={node.data.vertical ? 500 : 70}
    />
  {/if}

  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>

        <button
          class={[
            'z-4 cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0',
            node.data.vertical && 'absolute top-[30px] right-[30px]'
          ]}
          onclick={() => (showSettings = !showSettings)}
          title="Settings"
        >
          <Settings class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="relative">
        <StandardHandle
          port="inlet"
          type="message"
          total={1}
          index={0}
          class={`!-top-2 ${handleInletClass}`}
          nodeId={node.id}
        />

        <div
          class="flex w-full flex-col items-center justify-center gap-1 py-1"
          style={node.data.vertical || isResizable ? '' : `width: ${sliderWidth}px;`}
        >
          <div
            class={[
              'pb-2 font-mono text-sm transition-opacity',
              node.selected ? 'text-zinc-100 opacity-100' : 'text-zinc-300',
              node.data.vertical ? 'absolute -top-[40px] opacity-0 group-hover:opacity-100' : ''
            ]}
          >
            {displayValue}
          </div>

          <input
            bind:this={sliderElement}
            type="range"
            {min}
            {max}
            step={isFloat ? 0.01 : 1}
            value={currentValue}
            oninput={handleSliderChange}
            onpointerdown={valueTracker.onFocus}
            onpointerup={valueTracker.onBlur}
            style="background: linear-gradient(to right, #3b82f6 0%, #3b82f6 {((currentValue -
              min) /
              (max - min)) *
              100}%, #3f3f46 {((currentValue - min) / (max - min)) * 100}%, #3f3f46 100%); {node
              .data.vertical
              ? `writing-mode: vertical-lr; direction: rtl; height: ${sliderHeight}px;`
              : ''};"
            class={['nodrag', sliderClass]}
          />

          {#if !node.data.vertical}
            <div class="flex w-full justify-between font-mono text-[10px] text-zinc-500">
              <span>{isFloat ? min.toFixed(2) : min}</span>
              <span>{isFloat ? max.toFixed(2) : max}</span>
            </div>
          {/if}
        </div>

        <StandardHandle port="outlet" type="message" total={1} index={0} nodeId={node.id} />
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="absolute top-0" style="left: {settingsLeftOffset}px">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      {@render setting()}
    </div>
  {/if}
</div>

{#snippet setting()}
  <div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
    <div class="space-y-4">
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Mode</label>

        <div class="flex gap-2">
          <label class="flex items-center">
            <input
              type="radio"
              name="mode"
              value="int"
              checked={!isFloat}
              onchange={() => {
                const oldValue = isFloat;
                updateConfig({ isFloat: false });
                tracker.commit('isFloat', oldValue, false);
              }}
              class="mr-2 h-3 w-3"
            />
            <span class="text-xs text-zinc-300">Integer</span>
          </label>
          <label class="flex items-center">
            <input
              type="radio"
              name="mode"
              value="float"
              checked={isFloat}
              onchange={() => {
                const oldValue = isFloat;
                updateConfig({ isFloat: true });
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
            updateConfig({ min: newMin });
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
            updateConfig({ max: newMax });
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
            updateConfig({ defaultValue: newDefault });
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
            checked={node.data.vertical}
            onchange={(e) => {
              const oldVertical = node.data.vertical ?? false;
              const newVertical = e.currentTarget.checked;
              updateConfig({ vertical: newVertical });
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
              updateConfig({ resizable: newResizable });
              tracker.commit('resizable', oldResizable, newResizable);
            }}
            class="h-4 w-4 cursor-pointer"
          />
        </div>
      </div>

      <div class="pt-2">
        <button
          onclick={() => {
            updateNodeData(node.id, { ...node.data, value: defaultValue });

            if (sliderElement) {
              sliderElement.value = defaultValue.toString();
            }

            messageContext.send(defaultValue);
          }}
          class="w-full rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
        >
          Reset to Default
        </button>
      </div>
    </div>
  </div>
{/snippet}
