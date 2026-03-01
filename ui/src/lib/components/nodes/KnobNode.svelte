<script lang="ts">
  import { GripHorizontal, Lock, LockOpen, Settings, X } from '@lucide/svelte/icons';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import KnobSettings from '$lib/components/settings/KnobSettings.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import { useNodeDataTracker } from '$lib/history';
  import { useSvelteFlow, useStore, useEdges } from '@xyflow/svelte';
  import { checkMessageConnections } from '$lib/composables/checkHandleConnections';
  import * as Tooltip from '$lib/components/ui/tooltip';

  const HIDDEN_HANDLE_CLASS = 'opacity-30 group-hover:opacity-100 sm:opacity-0';

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
      locked?: boolean;
      showInlet?: boolean;
      showOutlet?: boolean;
    };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const store = useStore();
  const edges = useEdges();

  // Check if handles have connections (for smart auto mode)
  const connections = $derived(checkMessageConnections(edges.current, node.id));

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

  // Combined lock state: internal lock OR global interactivity disabled
  const isLocked = $derived((node.data.locked ?? false) || !store.nodesDraggable);

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
      })
      .with(messages.setMin, ({ value }) => {
        const clampedValue = Math.min(Math.max(currentValue, value), max);
        updateNodeData(node.id, { ...node.data, min: value, value: clampedValue });
      })
      .with(messages.setMax, ({ value }) => {
        const clampedValue = Math.min(Math.max(currentValue, min), value);
        updateNodeData(node.id, { ...node.data, max: value, value: clampedValue });
      })
      .with(messages.setDefault, ({ value }) => {
        updateNodeData(node.id, { ...node.data, defaultValue: value });
      })
      .with(messages.setValue, ({ value }) => {
        const newValue = applyPrecision(Math.min(Math.max(value, min), max));
        updateNodeData(node.id, { ...node.data, value: newValue });
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

  // Handle visibility: 3 states
  // - undefined (auto): show with fade, respects lock; always show if connected
  // - true (always show): always visible, overrides lock
  // - false (always hide): never visible
  const inletVisible = $derived.by(() => {
    if (node.data.showInlet === false) return false;
    if (node.data.showInlet === true) return true;

    // Auto: always show if connected, otherwise respect lock
    return connections.hasInlet || !isLocked || $shouldShowHandles;
  });

  const outletVisible = $derived(node.data.showOutlet !== false);

  const handleInletClass = $derived(
    node.data.showInlet === true || node.selected || $shouldShowHandles || connections.hasInlet
      ? ''
      : HIDDEN_HANDLE_CLASS
  );

  const handleOutletClass = $derived(
    node.data.showOutlet === true || node.selected || $shouldShowHandles || connections.hasOutlet
      ? ''
      : HIDDEN_HANDLE_CLASS
  );
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col items-center gap-1">
      {#if store.nodesDraggable}
        <div class={['absolute -top-5 -right-4', isLocked && 'nodrag']}>
          <button
            class={[
              'z-4 cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
              node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            ]}
            onclick={() => (showSettings = !showSettings)}
            title="Settings"
          >
            <Settings class="h-4 w-4 text-zinc-300" />
          </button>
        </div>
      {/if}

      <!-- Drag handle for moving the node (hidden when locked or interactivity is disabled) -->
      {#if !isLocked}
        <div
          class={[
            'absolute left-1/2 -translate-x-1/2 cursor-move rounded px-1 py-1 transition-opacity hover:bg-zinc-700/50',
            node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            node.data.showInlet === false ? '-top-7' : '-top-9'
          ]}
          title="Drag to move"
        >
          <GripHorizontal class="h-4 w-4 text-zinc-500" />
        </div>
      {/if}

      <div class="relative">
        {#if inletVisible}
          <StandardHandle
            port="inlet"
            type="message"
            total={1}
            index={0}
            class={`!-top-2 ${handleInletClass}`}
            nodeId={node.id}
          />
        {/if}

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
              class="font-mono"
              font-size={size * 0.2}
              fill={node.selected ? '#f4f4f5' : '#a1a1aa'}
            >
              {displayValue}
            </text>
          </svg>
        </div>

        {#if outletVisible}
          <StandardHandle
            port="outlet"
            type="message"
            total={1}
            index={0}
            nodeId={node.id}
            class={handleOutletClass}
          />
        {/if}
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="absolute top-0" style="left: {size + 10}px">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={() => {
                const oldLocked = node.data.locked ?? false;
                updateNodeData(node.id, { ...node.data, locked: !oldLocked });
                tracker.commit('locked', oldLocked, !oldLocked);
              }}
              class={[
                'h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 hover:bg-zinc-700',
                node.data.locked ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              ]}
            >
              {#if node.data.locked}
                <Lock class="h-4 w-4" />
              {:else}
                <LockOpen class="h-4 w-4" />
              {/if}
            </button>
          </Tooltip.Trigger>

          <Tooltip.Content>
            <p class="text-xs">Prevent moving and hide inlet</p>
          </Tooltip.Content>
        </Tooltip.Root>

        <button
          onclick={() => (showSettings = false)}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <KnobSettings
        nodeId={node.id}
        data={node.data}
        {tracker}
        onUpdate={updateConfig}
        onReset={() => {
          updateNodeData(node.id, { ...node.data, value: defaultValue });
          messageContext.send(defaultValue);
        }}
      />
    </div>
  {/if}
</div>
