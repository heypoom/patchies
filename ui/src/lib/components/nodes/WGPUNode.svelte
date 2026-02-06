<script lang="ts">
  import { Code, X, Settings } from '@lucide/svelte/icons';
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { match, P } from 'ts-pattern';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { parseWGSL, serializeStructToBuffer } from '$lib/webgpu/wgsl-parser';
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
      outputSize?: number;
      dispatchCount?: [number, number, number];
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
  let isCompiling = $state(false);
  let isDispatching = $state(false);
  let hasCompileError = $state(false);
  let hasCompiledSuccessfully = $state(false);

  let contentContainer: HTMLDivElement | null = null;
  let contentWidth = $state(100);
  let sidebarView = $state<'code' | 'settings' | null>(null);

  // Inferred values from last dispatch (for placeholder display)
  let inferredOutputSize = $state<number | null>(null);
  let inferredDispatch = $state<[number, number, number] | null>(null);

  const code = $derived(data.code || '');
  const parseResult = $derived(parseWGSL(code));
  const inputBindings = $derived(parseResult.inputs);
  const outputBindings = $derived(parseResult.outputs);
  const uniformBindings = $derived(parseResult.uniforms);

  // Total inlet count: 1 bang inlet + uniform bindings + input bindings
  const totalInlets = $derived(1 + uniformBindings.length + inputBindings.length);
  const totalOutlets = $derived(outputBindings.length);

  // Track previous binding count to detect handle changes
  let prevInputCount = $state(0);
  let prevOutputCount = $state(0);
  let prevUniformCount = $state(0);

  $effect(() => {
    const newInputCount = inputBindings.length;
    const newOutputCount = outputBindings.length;
    const newUniformCount = uniformBindings.length;

    if (
      newInputCount !== prevInputCount ||
      newOutputCount !== prevOutputCount ||
      newUniformCount !== prevUniformCount
    ) {
      prevInputCount = newInputCount;
      prevOutputCount = newOutputCount;
      prevUniformCount = newUniformCount;
      updateNodeInternals(nodeId);
    }
  });

  const borderColor = $derived.by(() => {
    if (hasCompileError && selected) return 'border-red-400';
    if (hasCompileError) return 'border-red-500';
    if (hasCompiledSuccessfully && selected) return 'border-emerald-300';
    if (hasCompiledSuccessfully) return 'border-emerald-500';
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

    isCompiling = true;
    consoleRef?.clearConsole();

    try {
      const result = await system.compile(nodeId, code);
      if (result.error) {
        hasCompileError = true;
        hasCompiledSuccessfully = false;
        logToConsole('error', result.error);
      } else {
        hasCompileError = false;
        hasCompiledSuccessfully = true;
        logToConsole('log', 'Shader compiled successfully.');
      }
    } finally {
      isCompiling = false;
    }
  }

  async function handleDispatch() {
    if (!system || !isSupported) {
      logToConsole('warn', 'WebGPU not ready. Cannot dispatch.');
      return;
    }

    isDispatching = true;
    try {
      const result = await system.dispatch(nodeId);
      if (result.error) {
        logToConsole('error', result.error);
        return;
      }

      // Store inferred values for placeholder display
      if (result.actualOutputSize !== undefined) {
        inferredOutputSize = result.actualOutputSize;
      }
      if (result.actualDispatch !== undefined) {
        inferredDispatch = result.actualDispatch;
      }

      if (!result.outputs || Object.keys(result.outputs).length === 0) {
        logToConsole('warn', 'Dispatch completed but no outputs produced.');
        return;
      }

      for (const [bindingStr, buffer] of Object.entries(result.outputs)) {
        const bindingNum = Number(bindingStr);
        const bindingInfo = outputBindings.find((b) => b.binding === bindingNum);
        const ArrayConstructor = bindingInfo?.arrayConstructor ?? Float32Array;
        const typedArray = new ArrayConstructor(buffer);

        if (bindingInfo) {
          messageContext.send(typedArray, { to: bindingNum });
        }
      }
    } catch (e) {
      logToConsole('error', `Dispatch failed: ${e}`);
    } finally {
      isDispatching = false;
    }
  }

  const handleMessage: MessageCallbackFn = (message, meta) => {
    const inletKey = meta.inletKey ?? '';

    // Bang inlet or "bang" string message
    if (inletKey === 'message-in-bang' || message === 'bang') {
      handleDispatch().catch((e) => logToConsole('error', `Dispatch error: ${e}`));
      return;
    }

    // Uniform inlet (message-in-uniform-{binding})
    if (inletKey.startsWith('message-in-uniform-')) {
      const bindingNum = parseInt(inletKey.replace('message-in-uniform-', ''), 10);
      const uniformBinding = uniformBindings.find((u) => u.binding === bindingNum);

      if (!isNaN(bindingNum) && system && uniformBinding?.struct) {
        // Handle JSON object for struct uniforms
        if (typeof message === 'object' && message !== null && !ArrayBuffer.isView(message)) {
          const bufferData = serializeStructToBuffer(
            message as Record<string, number>,
            uniformBinding.struct
          );

          system.setUniform(nodeId, bindingNum, bufferData);
        }
      }
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

    // setCode / run / settings messages
    match(message)
      .with({ type: 'setCode', code: P.string }, ({ code }) => {
        updateNodeData(nodeId, { code });
      })
      .with({ type: 'run' }, () => {
        compileShader();
      })
      .with({ type: 'setOutputSize', size: P.number }, ({ size }) => {
        updateNodeData(nodeId, { outputSize: size });
      })
      .with({ type: 'setDispatchCount', count: P.array(P.number) }, ({ count }) => {
        if (count.length >= 3) {
          updateNodeData(nodeId, { dispatchCount: [count[0], count[1], count[2]] });
        }
      })
      .otherwise(() => {});
  };

  function updateContentWidth() {
    if (!contentContainer) return;
    contentWidth = contentContainer.offsetWidth;
  }

  function applySettings() {
    if (!system || !isSupported) return;
    if (data.outputSize !== undefined) {
      system.setOutputSize(nodeId, data.outputSize);
    }
    if (data.dispatchCount !== undefined) {
      system.setDispatchCount(nodeId, data.dispatchCount);
    }
  }

  // Sync settings to system when they change
  $effect(() => {
    if (data.outputSize !== undefined && system && isSupported) {
      system.setOutputSize(nodeId, data.outputSize);
    }
  });

  $effect(() => {
    if (data.dispatchCount !== undefined && system && isSupported) {
      system.setDispatchCount(nodeId, data.dispatchCount);
    }
  });

  onMount(() => {
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      system = WebGPUComputeSystem.getInstance();
      const supported = await system.init();
      isSupported = supported;

      messageContext = new MessageContext(nodeId);
      messageContext.queue.addCallback(handleMessage);

      updateContentWidth();

      resizeObserver = new ResizeObserver(() => {
        updateContentWidth();
      });

      if (contentContainer) {
        resizeObserver.observe(contentContainer);
      }

      if (!supported) {
        logToConsole('error', 'WebGPU is not supported in this browser.');
        return;
      }

      await compileShader();
      applySettings();
    })();

    return () => {
      resizeObserver?.disconnect();
    };
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
          class="flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-hover/header:opacity-100"
        >
          <button
            class="rounded p-1 hover:bg-zinc-700"
            onclick={() => (sidebarView = sidebarView === 'settings' ? null : 'settings')}
            title="Settings"
          >
            <Settings class="h-4 w-4 text-zinc-300" />
          </button>
          <button
            class="rounded p-1 hover:bg-zinc-700"
            onclick={() => (sidebarView = sidebarView === 'code' ? null : 'code')}
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
          <StandardHandle
            port="inlet"
            type="message"
            id="bang"
            title="bang (dispatch)"
            index={0}
            total={totalInlets}
            class="top-0"
            {nodeId}
          />
          {#each uniformBindings as uniform, i}
            <StandardHandle
              port="inlet"
              type="message"
              id={`uniform-${uniform.binding}`}
              title={`${uniform.name} (${uniform.structName})`}
              index={i + 1}
              total={totalInlets}
              class="top-0"
              {nodeId}
            />
          {/each}
          {#each inputBindings as binding, i}
            <StandardHandle
              port="inlet"
              type="message"
              id={`in-${binding.binding}`}
              title={`${binding.name} (${binding.type})`}
              index={i + 1 + uniformBindings.length}
              total={totalInlets}
              class="top-0"
              {nodeId}
            />
          {/each}
        </div>

        <VirtualConsole
          bind:this={consoleRef}
          {nodeId}
          {borderColor}
          {selected}
          onrun={compileShader}
          isRunning={hasCompiledSuccessfully}
          onResize={updateContentWidth}
          initialHeight={data.consoleHeight}
          initialWidth={data.consoleWidth}
          onHeightChange={(height) => updateNodeData(nodeId, { consoleHeight: height })}
          onWidthChange={(width) => updateNodeData(nodeId, { consoleWidth: width })}
        />

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

  <!-- Settings panel -->
  {#if sidebarView === 'settings'}
    <div class="absolute" style="left: {contentWidth + 10}px; top: 0">
      <div class="nodrag rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-xl">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-xs font-medium text-zinc-400">Settings</span>
          <button onclick={() => (sidebarView = null)} class="rounded p-0.5 hover:bg-zinc-700">
            <X class="h-3 w-3 text-zinc-400" />
          </button>
        </div>

        <div class="flex flex-col gap-3">
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="mb-1 block text-xs text-zinc-500">Output Size (elements)</label>

            <input
              type="number"
              class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
              value={data.outputSize ?? ''}
              placeholder={inferredOutputSize ? `auto (${inferredOutputSize})` : 'auto'}
              onchange={(e) => {
                const value = e.currentTarget.value;
                if (value === '') {
                  updateNodeData(nodeId, { outputSize: undefined });
                } else {
                  updateNodeData(nodeId, { outputSize: parseInt(value) });
                }
              }}
            />
          </div>

          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="mb-1 block text-xs text-zinc-500">Dispatch Count (x, y, z)</label>

            <div class="flex gap-1">
              {#each [0, 1, 2] as i}
                <input
                  type="number"
                  class="w-14 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                  value={data.dispatchCount?.[i] ?? ''}
                  placeholder={inferredDispatch ? String(inferredDispatch[i]) : ['x', 'y', 'z'][i]}
                  onchange={(e) => {
                    const value = e.currentTarget.value;
                    const current = data.dispatchCount ?? [1, 1, 1];
                    if (value === '') {
                      // If all empty, clear dispatchCount
                      const newCount = [...current] as [number, number, number];
                      newCount[i] = 1;
                      const allDefault = newCount.every((v) => v === 1);
                      updateNodeData(nodeId, { dispatchCount: allDefault ? undefined : newCount });
                    } else {
                      const newCount = [...current] as [number, number, number];
                      newCount[i] = parseInt(value);
                      updateNodeData(nodeId, { dispatchCount: newCount });
                    }
                  }}
                />
              {/each}
            </div>
          </div>

          <div class="text-xs text-zinc-500">
            Workgroup: {parseResult.workgroupSize?.join('×') ?? 'unknown'}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Code editor (absolute, to the right of content) -->
  {#if sidebarView === 'code'}
    <div class="absolute" style="left: {contentWidth + 10}px">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button onclick={() => (sidebarView = null)} class="rounded p-1 hover:bg-zinc-700">
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
