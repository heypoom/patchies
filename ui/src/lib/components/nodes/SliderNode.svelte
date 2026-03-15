<script lang="ts">
  import { Lock, LockOpen, Settings, X } from '@lucide/svelte/icons';
  import {
    NodeResizer,
    useSvelteFlow,
    useUpdateNodeInternals,
    useStore,
    useEdges
  } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { sliderSchema } from '$lib/objects/schemas/slider';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import { useNodeDataTracker } from '$lib/history';
  import { checkMessageConnections } from '$lib/composables/checkHandleConnections';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import SliderSettings from '$lib/components/settings/SliderSettings.svelte';
  const HIDDEN_HANDLE_CLASS = 'opacity-30 group-hover:opacity-100 sm:opacity-0';

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
      locked?: boolean;
    };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData, updateNode } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const store = useStore();
  const edges = useEdges();

  // Check if handles have connections (for smart auto mode)
  const connections = $derived(checkMessageConnections(edges.current, node.id));

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

  // Combined lock state: internal lock OR global interactivity disabled
  const isLocked = $derived((node.data.locked ?? false) || !store.nodesDraggable);

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
        const newValue = isFloat ? Math.round(value * 100) / 100 : Math.round(value);
        const clamped = Math.min(Math.max(newValue, min), max);

        updateNodeData(node.id, { ...node.data, value: clamped });

        if (sliderElement) sliderElement.value = clamped.toString();
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
    void sliderWidth;
    void sliderHeight;

    setTimeout(() => {
      updateNodeInternals();
    }, 0);
  });

  const sliderClass = $derived.by(() => {
    if (node.data.vertical) {
      return '';
    }

    return [
      'slider-input h-1 w-full cursor-pointer appearance-none rounded-lg [&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-lg [&::-moz-range-progress]:bg-blue-500 [&::-moz-range-thumb:hover]:bg-zinc-100 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-zinc-300 [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-lg [&::-moz-range-track]:border-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-300 [&::-webkit-slider-track]:h-1 [&::-webkit-slider-track]:rounded-lg'
    ];
  });

  // Hide inlet when locked (unless easy connect is enabled or connected)
  const showInlet = $derived(connections.hasInlet || !isLocked || $shouldShowHandles);

  const handleInletClass = $derived(
    node.selected || $shouldShowHandles || connections.hasInlet ? '' : HIDDEN_HANDLE_CLASS
  );

  const handleOutletClass = $derived(
    node.selected || $shouldShowHandles || connections.hasOutlet ? '' : HIDDEN_HANDLE_CLASS
  );
</script>

<div class={['relative', isLocked && 'nodrag']}>
  {#if isResizable && !isLocked}
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
      {#if store.nodesDraggable}
        <div
          class={[
            'absolute -top-7 left-0 flex w-full items-center justify-between',
            isLocked && 'nodrag'
          ]}
        >
          <div></div>

          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class={[
                  'z-4 cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
                  node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                  node.data.vertical && 'absolute top-[30px] right-[30px]'
                ]}
                onclick={() => (showSettings = !showSettings)}
              >
                <Settings class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Settings</Tooltip.Content>
          </Tooltip.Root>
        </div>
      {/if}

      <div class="relative">
        {#if showInlet}
          <TypedHandle
            port="inlet"
            spec={sliderSchema.inlets[0].handle!}
            total={1}
            index={0}
            class={`!-top-2 ${handleInletClass}`}
            nodeId={node.id}
          />
        {/if}

        <div
          class="flex w-full flex-col items-center justify-center"
          style={node.data.vertical || isResizable ? '' : `width: ${sliderWidth}px;`}
        >
          <div class="w-full text-center">
            <div
              class={[
                'font-mono text-sm transition-opacity',
                isLocked ? 'cursor-default' : 'cursor-move',
                node.selected ? 'text-zinc-100 opacity-100' : 'text-zinc-300',
                node.data.vertical ? 'absolute -top-[40px] opacity-0 group-hover:opacity-100' : ''
              ]}
            >
              {displayValue}
            </div>
          </div>

          <div class="nodrag flex cursor-default pt-3 pb-2">
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
              class={[sliderClass, 'cursor-pointer']}
            />
          </div>

          {#if !node.data.vertical}
            <div class="flex w-full justify-between font-mono text-[10px] text-zinc-500">
              <span>{isFloat ? min.toFixed(2) : min}</span>
              <span>{isFloat ? max.toFixed(2) : max}</span>
            </div>
          {/if}
        </div>

        <TypedHandle
          port="outlet"
          spec={sliderSchema.outlets[0].handle!}
          total={1}
          index={0}
          nodeId={node.id}
          class={handleOutletClass}
        />
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="absolute top-0" style="left: {settingsLeftOffset}px">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={() => {
                const oldLocked = node.data.locked ?? false;

                updateConfig({ locked: !oldLocked });
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

      <SliderSettings
        nodeId={node.id}
        data={node.data}
        {tracker}
        onUpdate={updateConfig}
        onReset={() => {
          updateNodeData(node.id, { ...node.data, value: defaultValue });

          if (sliderElement) {
            sliderElement.value = defaultValue.toString();
          }

          messageContext.send(defaultValue);
        }}
      />
    </div>
  {/if}
</div>

<style>
  @media (pointer: coarse) {
    :global(.slider-input)::-webkit-slider-thumb {
      height: 1.1rem !important;
      width: 1.1rem !important;
    }

    :global(.slider-input)::-moz-range-thumb {
      height: 1.1rem !important;
      width: 1.1rem !important;
    }
  }
</style>
