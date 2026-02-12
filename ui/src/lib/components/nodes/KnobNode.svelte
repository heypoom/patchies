<script lang="ts">
  import { Settings, X } from '@lucide/svelte/icons';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import { useNodeDataTracker } from '$lib/history';
  import { useSvelteFlow } from '@xyflow/svelte';

  let node: {
    id: string;
    data: {
      min?: number;
      max?: number;
      defaultValue?: number;
      isFloat?: boolean;
      value?: number;
      runOnMount?: boolean;
      size?: number;
    };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  // Undo/redo tracking for node data changes
  const tracker = useNodeDataTracker(node.id);
  const valueTracker = tracker.track('value', () => node.data.value ?? defaultValue);

  let messageContext: MessageContext;
  let showSettings = $state(false);
  let isDragging = $state(false);
  let dragStartY = $state(0);
  let dragStartValue = $state(0);

  // Configuration values with defaults
  const min = $derived(node.data.min ?? 0);
  const max = $derived(node.data.max ?? (node.data.isFloat ? 1 : 100));
  const defaultValue = $derived(node.data.defaultValue ?? min);
  const isFloat = $derived(node.data.isFloat ?? false);
  const currentValue = $derived(node.data.value ?? defaultValue);
  const size = $derived(node.data.size ?? 50);

  // SVG arc calculations
  const radius = $derived(size / 2 - 4);
  const centerX = $derived(size / 2);
  const centerY = $derived(size / 2);
  const strokeWidth = 4;

  // Arc spans 270° with gap at bottom
  // 225° = bottom-left (7:30), 495° = bottom-right (4:30)
  const startAngle = 225;
  const endAngle = 495;
  const totalArcAngle = endAngle - startAngle;

  // Calculate the value arc end angle
  const valueAngle = $derived(startAngle + ((currentValue - min) / (max - min)) * totalArcAngle);

  // Convert angle to SVG arc coordinates
  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad)
    };
  }

  // Create arc path
  function describeArc(
    cx: number,
    cy: number,
    r: number,
    startAngleDeg: number,
    endAngleDeg: number
  ) {
    const start = polarToCartesian(cx, cy, r, endAngleDeg);
    const end = polarToCartesian(cx, cy, r, startAngleDeg);
    const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  }

  const backgroundArc = $derived(describeArc(centerX, centerY, radius, startAngle, endAngle));
  const valueArc = $derived(
    currentValue > min ? describeArc(centerX, centerY, radius, startAngle, valueAngle) : ''
  );

  // Display formatting based on mode
  const displayValue = $derived(
    isFloat ? Number(currentValue).toFixed(2) : Math.round(currentValue).toString()
  );

  // Apply precision based on mode (2 decimal places for float, integer for int)
  function applyPrecision(value: number): number {
    return isFloat ? Math.round(value * 100) / 100 : Math.round(value);
  }

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with(P.number, (value) => {
        const newValue = applyPrecision(Math.min(Math.max(value, min), max));
        updateNodeData(node.id, { ...node.data, value: newValue });
        messageContext.send(newValue);
      })
      .with(messages.reset, () => {
        updateNodeData(node.id, { ...node.data, value: defaultValue });
        messageContext.send(defaultValue);
      })
      .with(messages.bang, () => {
        messageContext.send(currentValue);
      });
  };

  function handlePointerDown(event: PointerEvent) {
    isDragging = true;
    dragStartY = event.clientY;
    dragStartValue = currentValue;
    valueTracker.onFocus();

    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isDragging) return;

    // Moving up increases value, moving down decreases
    const deltaY = dragStartY - event.clientY;
    const sensitivity = 0.005; // Adjust for smoother/faster control
    const deltaValue = deltaY * sensitivity * (max - min);
    const rawValue = Math.min(Math.max(dragStartValue + deltaValue, min), max);
    const newValue = applyPrecision(rawValue);

    if (newValue !== currentValue) {
      updateNodeData(node.id, { ...node.data, value: newValue });
      messageContext.send(newValue);
    }
  }

  function handlePointerUp() {
    if (isDragging) {
      isDragging = false;
      valueTracker.onBlur();
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

    updateNodeData(node.id, newData);
  }

  onMount(() => {
    messageContext = new MessageContext(node.id);
    messageContext.queue.addCallback(handleMessage);

    // Run on mount by default
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

  const handleInletClass = $derived.by(() => {
    if (node.selected || $shouldShowHandles) {
      return '';
    }
    return 'opacity-30 group-hover:opacity-100 sm:opacity-0';
  });
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col items-center gap-1">
      <div class="absolute -top-7 right-0">
        <button
          class={[
            'z-4 cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0'
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

        <!-- Knob SVG -->
        <div
          class="nodrag cursor-ns-resize select-none"
          style="width: {size}px; height: {size}px;"
          onpointerdown={handlePointerDown}
          onpointermove={handlePointerMove}
          onpointerup={handlePointerUp}
          onpointercancel={handlePointerUp}
          role="slider"
          aria-valuenow={currentValue}
          aria-valuemin={min}
          aria-valuemax={max}
          tabindex={0}
        >
          <svg width={size} height={size} class="overflow-visible">
            <!-- Background arc -->
            <path
              d={backgroundArc}
              fill="none"
              stroke="#3f3f46"
              stroke-width={strokeWidth}
              stroke-linecap="round"
            />
            <!-- Value arc -->
            {#if currentValue > min}
              <path
                d={valueArc}
                fill="none"
                stroke="#2C7FFF"
                stroke-width={strokeWidth}
                stroke-linecap="round"
              />
            {/if}
            <!-- Center value display -->
            <text
              x={centerX}
              y={centerY}
              text-anchor="middle"
              dominant-baseline="central"
              class="font-mono text-[10px]"
              fill={node.selected ? '#f4f4f5' : '#a1a1aa'}
            >
              {displayValue}
            </text>
          </svg>
        </div>

        <StandardHandle port="outlet" type="message" total={1} index={0} nodeId={node.id} />
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="absolute top-0" style="left: {size + 10}px">
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
  <div class="nodrag w-52 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
    <div class="space-y-4">
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Mode</label>

        <div class="flex gap-2">
          <label class="flex items-center">
            <input
              type="radio"
              name="mode-{node.id}"
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
              name="mode-{node.id}"
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

      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Size (px)</label>

        <input
          type="number"
          step={10}
          min={30}
          max={100}
          value={size}
          onchange={(e) => {
            const oldSize = size;
            const newSize = parseInt((e.target as HTMLInputElement).value);
            updateConfig({ size: newSize });
            tracker.commit('size', oldSize, newSize);
          }}
          class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
        />
      </div>

      <div class="pt-2">
        <button
          onclick={() => {
            updateNodeData(node.id, { ...node.data, value: defaultValue });
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
