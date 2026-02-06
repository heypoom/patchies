<script lang="ts">
  import { Code, Loader, Play, Terminal, X } from '@lucide/svelte/icons';
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { match, P } from 'ts-pattern';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { parseWGSL } from '$lib/webgpu/wgsl-parser';
  import { WebGPUComputeSystem } from '$lib/webgpu/WebGPUComputeSystem';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      title?: string;
      code: string;
      showConsole?: boolean;
      consoleHeight?: number;
      consoleWidth?: number;
    };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const eventBus = PatchiesEventBus.getInstance();

  let system: WebGPUComputeSystem;
  let messageContext: MessageContext;
  let consoleRef: VirtualConsole | null = $state(null);
  let isSupported = $state<boolean | null>(null);
  let isRunning = $state(false);

  let contentContainer: HTMLDivElement | null = null;
  let contentWidth = $state(100);
  let showEditor = $state(false);

  const code = $derived(data.code || '');
  const parseResult = $derived(parseWGSL(code));
  const inputBindings = $derived(parseResult.inputs);
  const outputBindings = $derived(parseResult.outputs);

  // Total inlet count: input bindings + 1 bang inlet
  const totalInlets = $derived(inputBindings.length + 1);
  const totalOutlets = $derived(outputBindings.length);

  // Track previous binding count to detect handle changes
  let prevInputCount = $state(0);
  let prevOutputCount = $state(0);

  $effect(() => {
    const newInputCount = inputBindings.length;
    const newOutputCount = outputBindings.length;

    if (newInputCount !== prevInputCount || newOutputCount !== prevOutputCount) {
      prevInputCount = newInputCount;
      prevOutputCount = newOutputCount;
      updateNodeInternals(nodeId);
    }
  });

  const borderColor = $derived.by(() => {
    if (isRunning && selected) return 'border-pink-300';
    if (isRunning) return 'border-pink-500';
    if (selected) return 'border-zinc-400';
    return 'border-zinc-600';
  });

  function logToConsole(msgType: 'log' | 'error' | 'warn', text: string) {
    eventBus.dispatch({
      type: 'consoleOutput',
      nodeId,
      args: [text],
      messageType: msgType,
      timestamp: Date.now()
    });
  }

  async function compileShader() {
    if (!system || !isSupported) return;

    isRunning = true;
    consoleRef?.clearConsole();

    try {
      const result = await system.compile(nodeId, code);
      if (result.error) {
        logToConsole('error', result.error);
      } else {
        logToConsole('log', 'Shader compiled successfully.');
      }
    } finally {
      isRunning = false;
    }
  }

  async function handleDispatch() {
    if (!system || !isSupported) {
      logToConsole('warn', 'WebGPU not ready. Cannot dispatch.');
      return;
    }

    try {
      const result = await system.dispatch(nodeId);
      if (result.error) {
        logToConsole('error', result.error);
        return;
      }

      if (!result.outputs || Object.keys(result.outputs).length === 0) {
        logToConsole('warn', 'Dispatch completed but no outputs produced.');
        return;
      }

      for (const [bindingStr, buffer] of Object.entries(result.outputs)) {
        const bindingNum = Number(bindingStr);
        const bindingInfo = outputBindings.find((b) => b.binding === bindingNum);
        const ArrayCtor = bindingInfo?.arrayConstructor ?? Float32Array;
        const typedArray = new ArrayCtor(buffer);

        logToConsole(
          'log',
          `Output binding ${bindingNum} (${bindingInfo?.name ?? '?'}): ${typedArray.length} elements`
        );

        const outletIndex = outputBindings.findIndex((b) => b.binding === bindingNum);
        if (outletIndex >= 0) {
          messageContext.send(typedArray, { to: outletIndex });
        }
      }
    } catch (e) {
      logToConsole('error', `Dispatch failed: ${e}`);
    }
  }

  const handleMessage: MessageCallbackFn = (message, meta) => {
    const inletKey = meta.inletKey ?? '';

    // Bang inlet or "bang" string message
    if (inletKey === 'message-in-bang' || message === 'bang') {
      handleDispatch().catch((e) => logToConsole('error', `Dispatch error: ${e}`));
      return;
    }

    // Data inlet (message-in-in-{binding})
    if (inletKey.startsWith('message-in-in-')) {
      const bindingNum = parseInt(inletKey.replace('message-in-in-', ''), 10);
      if (!isNaN(bindingNum) && system) {
        const bufferData = match(message)
          .with(P.instanceOf(Float32Array), (v) => v.buffer.slice(0))
          .with(P.instanceOf(Uint32Array), (v) => v.buffer.slice(0))
          .with(P.instanceOf(Int32Array), (v) => v.buffer.slice(0))
          .with(P.instanceOf(ArrayBuffer), (v) => v.slice(0))
          .with(P.array(P.number), (arr) => new Float32Array(arr).buffer)
          .otherwise(() => null);

        if (bufferData) {
          system.setBuffer(nodeId, bindingNum, bufferData);
          logToConsole(
            'log',
            `Buffer set for binding ${bindingNum} (${bufferData.byteLength} bytes)`
          );
        }
      }
      return;
    }

    // setCode / run messages
    match(message)
      .with({ type: 'setCode', code: P.string }, ({ code }) => {
        updateNodeData(nodeId, { code });
      })
      .with({ type: 'run' }, () => {
        compileShader();
      })
      .otherwise(() => {});
  };

  function updateContentWidth() {
    if (!contentContainer) return;
    contentWidth = contentContainer.offsetWidth;
  }

  const minContainerWidth = $derived.by(() => {
    const baseWidth = 70;
    const inletWidth = 15;
    return baseWidth + Math.max(Math.max(totalInlets, 2), Math.max(totalOutlets, 2)) * inletWidth;
  });

  onMount(async () => {
    system = WebGPUComputeSystem.getInstance();
    const supported = await system.init();
    isSupported = supported;

    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    updateContentWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateContentWidth();
    });

    if (contentContainer) {
      resizeObserver.observe(contentContainer);
    }

    if (!supported) {
      logToConsole('error', 'WebGPU is not supported in this browser.');
      return () => resizeObserver.disconnect();
    }

    await compileShader();

    return () => resizeObserver.disconnect();
  });

  onDestroy(() => {
    if (messageContext) {
      messageContext.queue.removeCallback(handleMessage);
      messageContext.destroy();
    }
    system?.destroy(nodeId);
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2" bind:this={contentContainer}>
      <!-- Floating header -->
      <div
        class="group/header absolute -top-7 left-0 z-20 flex w-full items-center justify-between"
      >
        <div class="z-10 w-fit rounded-lg bg-zinc-900 px-2 py-1 text-nowrap whitespace-nowrap">
          <div class="font-mono text-xs font-medium text-zinc-400">
            {data.title ?? 'wgpu'}
          </div>
        </div>

        <div
          class="flex items-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-hover/header:opacity-100"
        >
          <button
            class="rounded p-1 hover:bg-zinc-700"
            onclick={() => {
              updateNodeData(nodeId, { showConsole: !data.showConsole });
              setTimeout(() => updateContentWidth(), 10);
            }}
            title="Console"
          >
            <Terminal class="h-4 w-4 text-zinc-300" />
          </button>

          <button
            class="rounded p-1 hover:bg-zinc-700"
            onclick={() => (showEditor = !showEditor)}
            title="Edit code"
          >
            <Code class="h-4 w-4 text-zinc-300" />
          </button>
        </div>
      </div>

      <!-- Main content -->
      <div class="relative">
        <!-- Inlet handles -->
        <div>
          {#each inputBindings as binding, i}
            <StandardHandle
              port="inlet"
              type="message"
              id={`in-${binding.binding}`}
              title={`${binding.name} (${binding.type})`}
              index={i}
              total={totalInlets}
              class="top-0"
              {nodeId}
            />
          {/each}
          <StandardHandle
            port="inlet"
            type="message"
            id="bang"
            title="bang (dispatch)"
            index={inputBindings.length}
            total={totalInlets}
            class="top-0"
            {nodeId}
          />
        </div>

        {#if data.showConsole}
          <VirtualConsole
            bind:this={consoleRef}
            {nodeId}
            {borderColor}
            {selected}
            onrun={compileShader}
            {isRunning}
            onResize={updateContentWidth}
            initialHeight={data.consoleHeight}
            initialWidth={data.consoleWidth}
            onHeightChange={(height) => updateNodeData(nodeId, { consoleHeight: height })}
            onWidthChange={(width) => updateNodeData(nodeId, { consoleWidth: width })}
          />
        {:else}
          <button
            class={[
              'flex w-full justify-center rounded-md border py-3 text-zinc-300 hover:bg-zinc-700',
              isRunning ? 'cursor-not-allowed' : 'cursor-pointer',
              borderColor,
              selected ? 'shadow-glow-md bg-zinc-800' : 'hover:shadow-glow-sm bg-zinc-900'
            ]}
            style={`min-width: ${minContainerWidth}px`}
            onclick={compileShader}
            aria-disabled={isRunning}
            aria-label="Run shader"
          >
            <div class={[isRunning ? 'animate-spin opacity-30' : '']}>
              <svelte:component this={isRunning ? Loader : Play} size="16px" />
            </div>
          </button>

          <div
            class={[
              'pointer-events-none absolute mt-1 ml-1 w-fit min-w-[200px] font-mono text-[8px] text-zinc-300 opacity-0',
              selected ? '' : 'group-hover:opacity-100'
            ]}
          >
            <div>click to compile</div>
          </div>
        {/if}

        <!-- Outlet handles -->
        <div>
          {#each outputBindings as binding, i}
            <StandardHandle
              port="outlet"
              type="message"
              id={`out-${binding.binding}`}
              title={`${binding.name} (${binding.type})`}
              index={i}
              total={totalOutlets}
              class="bottom-0"
              {nodeId}
            />
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Code editor (absolute, to the right of content) -->
  {#if showEditor}
    <div class="absolute" style="left: {contentWidth + 10}px">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
        <CodeEditor
          value={code}
          onchange={(newCode) => {
            updateNodeData(nodeId, { code: newCode });
          }}
          language="wgsl"
          placeholder="Write your WGSL compute shader here..."
          class="nodrag h-64 w-full resize-none"
          onrun={compileShader}
        />
      </div>
    </div>
  {/if}
</div>
