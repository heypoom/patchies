<script lang="ts">
  import { Play, Settings, Square } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import MusicCodeContainer from '$lib/music-code-layout/MusicCodeContainer.svelte';
  import { resolveStrudelFontSizes, type StrudelNodeData } from './strudel-settings';
  import StrudelControls from './StrudelControls.svelte';
  import { portal } from '$lib/dom/portal';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { onMount, onDestroy } from 'svelte';
  import StrudelEditor from '$lib/components/StrudelEditor.svelte';
  import StrudelEditorSurface from '$objects/strudel/StrudelEditorSurface.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { strudelMessages } from '$lib/objects/schemas';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { useAudioOutletWarning } from '$lib/composables/useAudioOutletWarning';
  import { useNodeDataTracker } from '$lib/history';
  import { StrudelTransportSync } from '$lib/strudel/StrudelTransportSync';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { isFullscreenActive } from '$lib/canvas/SurfaceOverlay';
  import { isSidebarOpen } from '../../stores/ui.store';
  import {
    activeDetachedStrudelNodeId,
    closeDetachedStrudelEditor,
    openDetachedStrudelEditor
  } from '../../stores/detached-strudel-editor.store';
  import {
    editorFontFamily,
    editorFontSize,
    editorFullscreenFontSize
  } from '../../stores/editor.store';
  import { useCodeSidebarTarget } from '$lib/code-editor/use-code-sidebar-target.svelte';
  import { openCodeEditorSidebar } from '../../stores/code-editor-layout.store';
  import {
    getExpandedDismissShortcutLabel,
    isExpandedDismissKey,
    isNativeFullscreen
  } from '$lib/keyboard/dismiss';

  // Get node data from XY Flow - nodes receive their data as props
  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    selected: boolean;
    data: StrudelNodeData;
  } = $props();

  function initialNodeId() {
    return nodeId;
  }

  // Get flow utilities to update node data
  const { updateNodeData } = useSvelteFlow();
  const { warnIfNoAudioConnection } = useAudioOutletWarning(initialNodeId());

  let container: MusicCodeContainer;
  let controls: StrudelControls;
  let settingsAnchor = $state<HTMLDivElement>();
  let strudelEditor: StrudelEditor | null = null;
  let messageContext: MessageContext | undefined = $state();
  let consoleRef: VirtualConsole | null = $state(null);
  let initTimeout: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  let hasError = $state(false);
  let isPlaying = $state(false);
  let isInitialized = $state(false);

  const isDetached = $derived($activeDetachedStrudelNodeId === nodeId);
  const code = $derived(data.code || '');
  const fontFamily = $derived(data.fontFamily ?? $editorFontFamily);
  const fontSizes = $derived(
    resolveStrudelFontSizes(data, $editorFontSize, $editorFullscreenFontSize)
  );
  const fontSize = $derived(isDetached ? fontSizes.expanded : fontSizes.normal);
  const dismissShortcutLabel = $derived(getExpandedDismissShortcutLabel($isNativeFullscreen));
  const customConsole = createCustomConsole(initialNodeId());

  useCodeSidebarTarget(() => ({
    nodeId,
    dataKey: 'code',
    language: 'plain',
    nodeType: 'strudel',
    label: 'strudel',
    title: 'strudel',
    value: code,
    onchange: setCode,
    onrun: evaluate
  }));

  const setCode = (newCode: string) => {
    updateNodeData(nodeId, { code: newCode });
    strudelEditor?.editor?.setCode(newCode);
  };

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with(strudelMessages.string, (code) => {
          setCode(code);
        })
        .with(strudelMessages.setCode, ({ value }) => {
          setCode(value);
        })
        .with(strudelMessages.bang, evaluate)
        .with(strudelMessages.run, evaluate)
        .with(strudelMessages.expand, openExpandedEditor)
        .with(strudelMessages.collapse, closeExpandedEditor)
        .with(strudelMessages.setStyles, ({ value }) => {
          updateNodeData(nodeId, { styles: value as Record<string, string> });
        })
        .with(strudelMessages.setFontFamily, ({ value }) => {
          strudelEditor?.editor?.setFontFamily(value);
          updateNodeData(nodeId, { fontFamily: value });
        })
        .with(strudelMessages.setFontSize, ({ value }) => {
          updateNodeData(nodeId, { fontSize: value });
        })
        .with(strudelMessages.setExpandedFontSize, ({ value }) => {
          updateNodeData(nodeId, { expandedFontSize: value });
        })
        .with(strudelMessages.stop, stop)
        .with(strudelMessages.mute, () => setMuted(true))
        .with(strudelMessages.unmute, () => setMuted(false));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      customConsole.error(errorMsg);
      hasError = true;
    }
  };

  // Listen for Strudel log events (errors come through CustomEvent)
  function handleStrudelLog(event: Event) {
    const detail = (event as CustomEvent).detail;

    if (detail?.type === 'error') {
      customConsole.error(detail.message);
      hasError = true;
    } else if (detail?.message) {
      customConsole.log(detail.message);
    }
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    // Listen for Strudel's log events
    document.addEventListener('strudel.log', handleStrudelLog);

    // Wait for the StrudelEditor to be ready
    initTimeout = setTimeout(() => {
      initTimeout = null;
      if (destroyed || !strudelEditor?.editor) return;

      isInitialized = true;

      transportSync = new StrudelTransportSync({
        getScheduler: () => strudelEditor?.editor?.repl.scheduler,
        evaluate,
        stop,
        onPlayingChange: (playing) => {
          isPlaying = playing;
        }
      });

      // @ts-expect-error -- for debugging
      window.strudel = strudelEditor.editor;
    }, 1000);
  });

  onDestroy(() => {
    destroyed = true;

    if (initTimeout) {
      clearTimeout(initTimeout);
      initTimeout = null;
    }

    transportSync?.destroy();
    transportSync = null;

    stop();

    document.removeEventListener('strudel.log', handleStrudelLog);

    if (messageContext) {
      messageContext.queue.removeCallback(handleMessage);
      messageContext.destroy();
    }
  });

  function stop() {
    if (strudelEditor?.editor) {
      try {
        strudelEditor.editor.stop();
        isPlaying = false;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        customConsole.error(errorMsg);
        hasError = true;
      }
    }
  }

  function evaluate() {
    if (strudelEditor?.editor) {
      // Clear previous errors on new evaluation
      consoleRef?.clearConsole();
      hasError = false;

      // Warn if audio outlet is not connected
      warnIfNoAudioConnection();

      try {
        strudelEditor.editor.evaluate();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        customConsole.error(errorMsg);

        hasError = true;
        isPlaying = false;
      }
    }
  }

  function handleUpdateState(state: unknown) {
    isPlaying =
      typeof state === 'object' && state !== null && 'started' in state && state.started === true;
  }

  const syncTransport = $derived(data.syncTransport ?? false);
  const muted = $derived(data.muted ?? false);
  const runtimeStatus = $derived.by(() => {
    if (muted) return 'muted';
    if (isPlaying) return 'playing';

    return 'stopped';
  });

  const tracker = useNodeDataTracker(initialNodeId());

  function setMuted(value: boolean) {
    const oldValue = muted;
    updateNodeData(nodeId, { muted: value });
    tracker.commit('muted', oldValue, value);
  }

  // Apply mute to the gain node
  $effect(() => {
    const audioService = AudioService.getInstance();
    const gainNode = audioService.getNodeById(nodeId);

    if (gainNode?.audioNode && 'gain' in gainNode.audioNode) {
      (gainNode.audioNode as GainNode).gain.value = muted ? 0 : 1;
    }
  });

  // Transport sync (CPS, phase, play/pause/stop)
  let transportSync: StrudelTransportSync | null = null;

  $effect(() => {
    if (!isInitialized || !transportSync) return;

    if (syncTransport) {
      transportSync.subscribe();
    } else {
      transportSync.unsubscribe();
    }
  });

  function openExpandedEditor() {
    openDetachedStrudelEditor(nodeId);
  }

  function openSidebarEditor() {
    openCodeEditorSidebar({
      nodeId,
      dataKey: 'code',
      language: 'plain',
      nodeType: 'strudel',
      title: 'strudel',
      onchange: setCode,
      onrun: evaluate
    });
  }

  function closeExpandedEditor() {
    closeDetachedStrudelEditor();
  }

  $effect(() => {
    if (!isDetached) return;

    isSidebarOpen.set(false);
    isFullscreenActive.set(true);

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!isExpandedDismissKey(event)) return;
      if (document.querySelector('[data-strudel-panel][data-state="open"]')) return;

      event.preventDefault();
      event.stopPropagation();

      closeExpandedEditor();
    };

    window.addEventListener('keydown', handleKeydown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeydown, { capture: true });
      isFullscreenActive.set(false);
    };
  });

  onDestroy(() => {
    if (isDetached) {
      closeDetachedStrudelEditor();
    }
  });
</script>

{#snippet strudelHandles()}
  <TypedHandle
    port="inlet"
    spec={{ handleType: 'message', handleId: nodeId }}
    total={1}
    index={0}
    {nodeId}
  />
{/snippet}

{#snippet strudelOutlets()}
  <TypedHandle port="outlet" spec={{ handleType: 'audio' }} total={1} index={0} {nodeId} />
{/snippet}

{#snippet strudelActions()}
  {#if isInitialized && !syncTransport}
    <Tooltip.Root>
      <Tooltip.Trigger
        class="cursor-pointer rounded p-1 hover:bg-zinc-700"
        onclick={isPlaying ? stop : evaluate}
        aria-label={isPlaying ? 'Stop Strudel' : 'Play Strudel'}
      >
        {#if isPlaying}<Square class="h-4 w-4" />{:else}<Play class="h-4 w-4" />{/if}
      </Tooltip.Trigger>
      <Tooltip.Content>{isPlaying ? 'Stop' : 'Play'}</Tooltip.Content>
    </Tooltip.Root>
  {/if}
{/snippet}

{#snippet strudelControls(expanded: boolean)}
  <StrudelControls
    bind:this={controls}
    {nodeId}
    {data}
    {expanded}
    sidePanelTarget={settingsAnchor}
    onCompactSettings={() => container.closeInspection()}
    onExpand={openExpandedEditor}
    onLayoutChange={(collapsed) => {
      container.setEditorCollapsed(collapsed);
      if (isDetached) closeExpandedEditor();
    }}
  />
{/snippet}

{#snippet inlineStrudelControls()}
  {@render strudelControls(false)}
{/snippet}

{#snippet expandedStrudelControls()}
  {@render strudelControls(true)}
{/snippet}

{#snippet strudelEditorControls()}
  <Tooltip.Root>
    <Tooltip.Trigger
      class="cursor-pointer rounded p-1 text-zinc-300 hover:bg-zinc-700"
      aria-label="Strudel settings"
      onclick={(event) => controls.toggleSettings(event.currentTarget)}
      ><Settings class="h-4 w-4" /></Tooltip.Trigger
    >
    <Tooltip.Content>Settings</Tooltip.Content>
  </Tooltip.Root>
{/snippet}

{#snippet strudelSidePanel()}
  <div bind:this={settingsAnchor}></div>

  <!-- Virtual Console (right side, absolutely positioned) -->

  <div
    use:portal={isDetached ? document.body : null}
    class={isDetached
      ? 'fixed top-[calc(env(safe-area-inset-top,0px)+4.25rem)] right-6 z-[70] w-80 max-w-[calc(100vw-3rem)]'
      : ''}
    class:hidden={!data.showConsole}
  >
    <VirtualConsole
      bind:this={consoleRef}
      {nodeId}
      class="pt-1"
      onrun={evaluate}
      placeholder="Strudel logs and errors will appear here."
      shouldAutoShowConsoleOnError
    />
  </div>
{/snippet}

<div class="relative">
  <MusicCodeContainer
    bind:this={container}
    {nodeId}
    {data}
    {selected}
    {hasError}
    label="strudel"
    viewportStyle={data.styles?.container}
    status={runtimeStatus}
    expanded={isDetached}
    onExpand={openExpandedEditor}
    onOpenSidebar={openSidebarEditor}
    onInspect={() => controls.hideSettings()}
    actions={strudelActions}
    controls={inlineStrudelControls}
    editorControls={strudelEditorControls}
    handles={strudelHandles}
    outlets={strudelOutlets}
    sidePanel={strudelSidePanel}
  >
    <StrudelEditorSurface
      {isDetached}
      {muted}
      {isInitialized}
      {syncTransport}
      {isPlaying}
      {dismissShortcutLabel}
      {evaluate}
      {stop}
      {closeExpandedEditor}
      controls={expandedStrudelControls}
      containerStyle={data.styles?.container}
    >
      <StrudelEditor
        {code}
        {fontFamily}
        {fontSize}
        bind:this={strudelEditor}
        onUpdateState={handleUpdateState}
        onBeforeEvaluate={() => {
          consoleRef?.clearConsole();
          hasError = false;
        }}
        onchange={(newCode) => {
          updateNodeData(nodeId, { code: newCode });
        }}
        class="h-full w-full"
        {nodeId}
        {messageContext}
        {customConsole}
      />
    </StrudelEditorSurface>
  </MusicCodeContainer>
</div>
