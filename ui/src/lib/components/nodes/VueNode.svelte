<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import ObjectPreviewLayout from '$lib/components/ObjectPreviewLayout.svelte';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { handleCodeError } from '$lib/js-runner/handleCodeError';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent } from '$lib/eventbus/events';
  import { JSRunner } from '$lib/js-runner/JSRunner';
  import { createIsolatedContainer } from '$lib/utils/tailwindBrowser';
  import { VUE_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      title: string;
      code: string;
      inletCount?: number;
      outletCount?: number;
      hidePorts?: boolean;
      executeCode?: number;
      showConsole?: boolean;
      width?: number;
      height?: number;
    };
    selected?: boolean;
  } = $props();

  let consoleRef: VirtualConsole | null = $state(null);

  // Track error line numbers for code highlighting
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);
  const eventBus = PatchiesEventBus.getInstance();
  const jsRunner = JSRunner.getInstance();

  // Vue instance
  let Vue: typeof import('vue') | null = null;
  let vueLoaded = $state(false);
  let currentApp: ReturnType<(typeof import('vue'))['createApp']> | null = null;

  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;

    if (event.messageType === 'error' && event.lineErrors) {
      lineErrors = event.lineErrors;
    }
  }

  // Create custom console for routing output to VirtualConsole
  const customConsole = createCustomConsole(nodeId);

  let rootContainer = $state<HTMLDivElement | undefined>();
  let dragEnabled = $state(true);
  let editorReady = $state(false);

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  let containerWidth = $derived(data.width);
  let containerHeight = $derived(data.height);

  let inletCount = $derived(data.inletCount ?? 1);
  let outletCount = $derived(data.outletCount ?? 0);
  let previousExecuteCode = $state<number | undefined>(undefined);

  // Watch for executeCode timestamp changes and re-run when it changes
  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;
      runCode();
    }
  });

  const setPortCount = (newInletCount = 1, newOutletCount = 0) => {
    updateNodeData(nodeId, { inletCount: newInletCount, outletCount: newOutletCount });
    updateNodeInternals(nodeId);
  };

  const setCodeAndUpdate = (newCode: string) => {
    updateNodeData(nodeId, { code: newCode });
    setTimeout(() => runCode());
  };

  const handleMessage: MessageCallbackFn = (message, _meta) => {
    try {
      match(message)
        .with({ type: 'set', code: P.string }, ({ code }) => {
          setCodeAndUpdate(code);
        })
        .with({ type: 'run' }, () => {
          runCode();
        })
        .with({ type: 'stop' }, () => {
          stopLongRunningTasks();
        })
        .otherwise(() => {
          // Messages are delivered via recv() callback set by user code
        });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  function setSize(width: number, height: number) {
    updateNodeData(nodeId, { width, height });
  }

  function stopLongRunningTasks() {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.clearTimers();
    messageContext.messageCallback = null;
  }

  function unmountVueApp() {
    if (currentApp) {
      try {
        currentApp.unmount();
      } catch {
        // Ignore unmount errors
      }
      currentApp = null;
    }
  }

  async function runCode() {
    if (!rootContainer) return;

    // Clear console and error highlighting on re-run
    consoleRef?.clearConsole();
    lineErrors = undefined;

    // Reset drag state
    dragEnabled = true;

    // Unmount previous Vue app
    unmountVueApp();

    try {
      // Create isolated shadow DOM container with Tailwind (enabled by default)
      const container = createIsolatedContainer(rootContainer);

      // Create a separate div for Vue to mount to
      const vueRoot = document.createElement('div');
      vueRoot.className = 'h-full w-full';
      container.root.appendChild(vueRoot);

      // Lazy load Vue if not already loaded
      // Use vue/dist/vue.esm-bundler.js which includes the template compiler
      if (!Vue) {
        // @ts-expect-error - vue.esm-bundler.js has no type declarations but works at runtime
        Vue = await import('vue/dist/vue.esm-bundler.js');
        vueLoaded = true;
        customConsole.log('Vue loaded!');
      }

      // Preprocess code for module support
      const processedCode = await jsRunner.preprocessCode(data.code, { nodeId });

      // If preprocessCode returns null, it means it's a library definition
      if (processedCode === null) {
        return;
      }

      const result = await jsRunner.executeJavaScript(nodeId, processedCode, {
        customConsole,
        setPortCount,
        setTitle: (title: string) => updateNodeData(nodeId, { title }),
        setHidePorts: (hidePorts: boolean) => updateNodeData(nodeId, { hidePorts }),
        extraContext: {
          root: vueRoot,
          width: containerWidth,
          height: containerHeight,
          setSize,
          noDrag: () => {
            dragEnabled = false;
          },
          tailwind: container.tailwind,
          // Vue globals
          Vue,
          createApp: Vue!.createApp,
          ref: Vue!.ref,
          reactive: Vue!.reactive,
          computed: Vue!.computed,
          watch: Vue!.watch,
          watchEffect: Vue!.watchEffect,
          onMounted: Vue!.onMounted,
          onUnmounted: Vue!.onUnmounted,
          nextTick: Vue!.nextTick,
          h: Vue!.h,
          defineComponent: Vue!.defineComponent
        }
      });

      // If the user returned an app instance, store it for cleanup
      if (result && typeof result.unmount === 'function') {
        currentApp = result;
      }
    } catch (error) {
      handleCodeError(error, data.code, nodeId, customConsole, VUE_WRAPPER_OFFSET);
    }
  }

  onMount(() => {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    setTimeout(() => {
      runCode();
    }, 50);
  });

  onDestroy(() => {
    unmountVueApp();
    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
    jsRunner.destroy(nodeId);
  });

  const handleClass = $derived.by(() => {
    // only apply the custom handles if setHidePorts(true) is set
    if (!data.hidePorts) return '';

    if (!selected && $shouldShowHandles) {
      return 'z-1 transition-opacity';
    }

    return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
  });
</script>

<ObjectPreviewLayout title={data.title ?? 'vue'} {nodeId} onrun={runCode} {editorReady}>
  {#snippet topHandle()}
    {#each Array.from({ length: inletCount }) as _, index}
      <StandardHandle
        port="inlet"
        id={index}
        title={`Inlet ${index}`}
        total={inletCount}
        {index}
        class={handleClass}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet preview()}
    <div
      class={[
        'overflow-hidden rounded-md',
        lineErrors !== undefined
          ? 'border-red-500/70'
          : selected
            ? 'shadow-glow-md ring ring-zinc-400'
            : 'hover:shadow-glow-sm',
        dragEnabled ? '' : 'nodrag'
      ]}
      style={containerWidth !== undefined && containerHeight !== undefined
        ? `width: ${containerWidth}px; height: ${containerHeight}px;`
        : ''}
    >
      <div bind:this={rootContainer} class="h-full w-full"></div>
    </div>
  {/snippet}

  {#snippet bottomHandle()}
    {#each Array.from({ length: outletCount }) as _, index}
      <StandardHandle
        port="outlet"
        id={index}
        title={`Outlet ${index}`}
        total={outletCount}
        {index}
        class={handleClass}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet codeEditor()}
    <CodeEditor
      value={data.code}
      language="javascript"
      nodeType="vue"
      placeholder="Write your Vue code here..."
      class="nodrag h-64 w-full resize-none"
      onrun={runCode}
      onchange={(newCode) => {
        updateNodeData(nodeId, { code: newCode });
      }}
      onready={() => (editorReady = true)}
      {lineErrors}
    />
  {/snippet}

  {#snippet console()}
    <div class="mt-3 w-full" class:hidden={!data.showConsole}>
      <VirtualConsole
        bind:this={consoleRef}
        {nodeId}
        placeholder="Vue output will appear here."
        maxHeight="200px"
      />
    </div>
  {/snippet}
</ObjectPreviewLayout>
