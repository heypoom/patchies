<script lang="ts">
  import {
    Check,
    Copy,
    LibraryBig,
    Link,
    Pencil,
    RefreshCw,
    RotateCcw,
    Save,
    Settings,
    X
  } from '@lucide/svelte/icons';
  import { onDestroy, tick } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { NodeResizer, useSvelteFlow, type NodeProps } from '@xyflow/svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { getPatchRuntimeViewRevisionTracker } from '$lib/runtime';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import ObjectSettings from '$lib/components/settings/ObjectSettings.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import { useNodeDataTracker } from '$lib/history';
  import { useSettingsSidebarTarget } from '$lib/settings/use-settings-sidebar-target.svelte';
  import {
    DEFAULT_WAM_URL,
    getWamDisplayName,
    shouldResetWamGuiSize,
    WamAudioNode,
    type WamNodeData,
    type WamParameter,
    type WamRuntimeStatus
  } from './WamAudioNode';
  import { getWamGuiMinimumSize, getWamGuiScale } from './wam-gui-scale';
  import WamCommunityBrowser from './WamCommunityBrowser.svelte';
  import type { WamCommunityPlugin } from './wam-community-plugins';

  type WamSettingsTab = 'general' | 'parameters';
  type WamSettingsSurface = 'floating' | 'sidebar';

  let node: NodeProps & { data: WamNodeData } = $props();

  const { updateNode, updateNodeData } = useSvelteFlow();
  const audioService = AudioService.getInstance();
  const runtimeViewRevisionTracker = getPatchRuntimeViewRevisionTracker();
  const tracker = $derived.by(() => useNodeDataTracker(node.id));

  let guiViewport = $state<HTMLDivElement | null>(null);
  let guiMountPoint = $state<HTMLDivElement | null>(null);
  let guiElement = $state<HTMLElement | null>(null);
  let guiMinimumSize = $state({ width: 64, height: 128 });
  let runtimeNode: WamAudioNode | null = null;
  let status = $state<WamRuntimeStatus>({ state: 'idle' });
  let showSettings = $state(false);
  let showCommunityBrowser = $state(false);
  let showCustomUrl = $state(false);
  let settingsTab = $state<WamSettingsTab>('general');
  let parametersLoading = $state(false);
  let parameters = $state<WamParameter[]>([]);
  let parameterLoadError = $state<string | null>(null);
  let editingParameterId = $state<string | null>(null);
  let parameterDraftValue = $state('');
  let parameterSavingId = $state<string | null>(null);
  let parameterInput = $state<HTMLInputElement | null>(null);
  let url = $state(DEFAULT_WAM_URL);
  let hasInitializedUrl = false;
  let guiFitFrame: number | null = null;
  let guiScaleFrame: number | null = null;

  const resizable = $derived(node.data.resizable ?? false);
  const muted = $derived(node.data.muted ?? false);
  const displayName = $derived(
    status.state === 'ready' ? status.name : getWamDisplayName(node.data.url ?? DEFAULT_WAM_URL)
  );
  const moduleStatus = $derived.by(() => {
    if (status.state === 'ready')
      return { label: 'Ready', dotClass: 'bg-emerald-400', textClass: 'text-emerald-300' };
    if (status.state === 'loading')
      return { label: 'Loading', dotClass: 'bg-amber-400', textClass: 'text-amber-300' };
    if (status.state === 'error')
      return { label: 'Error', dotClass: 'bg-red-400', textClass: 'text-red-300' };

    return { label: 'Not loaded', dotClass: 'bg-zinc-600', textClass: 'text-zinc-400' };
  });

  function fitNodeToGui(gui: HTMLElement) {
    if (guiFitFrame !== null) cancelAnimationFrame(guiFitFrame);

    guiFitFrame = requestAnimationFrame(() => {
      guiFitFrame = null;

      const { offsetWidth: width, offsetHeight: height } = gui;
      if (width === 0 || height === 0) return;

      const { width: nextWidth, height: nextHeight } = getWamGuiMinimumSize({ width, height });
      if (node.width === nextWidth && node.height === nextHeight) return;

      updateNode(node.id, { width: nextWidth, height: nextHeight });
    });
  }

  function updateGuiScale() {
    if (!guiViewport || !guiMountPoint || !guiElement) return;

    const scale = getWamGuiScale(
      { width: guiElement.offsetWidth, height: guiElement.offsetHeight },
      { width: guiViewport.clientWidth, height: guiViewport.clientHeight }
    );

    guiMountPoint.style.transform = `scale(${scale.x}, ${scale.y})`;
  }

  function scheduleGuiScale() {
    if (guiScaleFrame !== null) cancelAnimationFrame(guiScaleFrame);

    guiScaleFrame = requestAnimationFrame(() => {
      guiScaleFrame = null;
      updateGuiScale();
    });
  }

  function updateGuiMinimumSize() {
    if (!guiElement) {
      guiMinimumSize = getWamGuiMinimumSize({ width: 0, height: 0 });
      return;
    }

    guiMinimumSize = getWamGuiMinimumSize({
      width: guiElement.offsetWidth,
      height: guiElement.offsetHeight
    });
  }

  function handleGuiResize() {
    updateGuiMinimumSize();
    scheduleGuiScale();
  }

  function handleGuiMount(gui: HTMLElement, shouldFit: boolean) {
    guiElement = gui;
    updateGuiMinimumSize();

    if (shouldFit) fitNodeToGui(gui);
  }

  function resetNodeSizeForNewWam() {
    if (guiFitFrame !== null) cancelAnimationFrame(guiFitFrame);
    guiFitFrame = null;

    guiMountPoint?.style.removeProperty('transform');
    guiMinimumSize = getWamGuiMinimumSize({ width: 0, height: 0 });
    updateNode(node.id, { width: undefined, height: undefined });
  }

  async function mountRuntimeGui(wamNode: WamAudioNode) {
    await tick();

    if (guiMountPoint && runtimeNode === wamNode) await wamNode.mountGui(guiMountPoint);
  }

  function detachRuntimeNode() {
    runtimeNode?.unmountGui();

    if (guiFitFrame !== null) cancelAnimationFrame(guiFitFrame);
    guiFitFrame = null;

    if (guiScaleFrame !== null) cancelAnimationFrame(guiScaleFrame);
    guiScaleFrame = null;
    guiElement = null;
    updateGuiMinimumSize();

    if (runtimeNode) {
      runtimeNode.onStatusChange = () => {};
      runtimeNode.onGuiMount = () => {};
    }
    runtimeNode = null;
  }

  function updateSetting(key: string, value: unknown) {
    if (key === 'muted' && typeof value === 'boolean') setMuted(value);
    if (key === 'resizable' && typeof value === 'boolean') setResizable(value);
  }

  function setMuted(value: boolean) {
    if (value === muted) return;

    const previousMuted = muted;
    updateNodeData(node.id, { muted: value });
    tracker.commit('muted', previousMuted, value);
    runtimeNode?.setMuted(value);
  }

  function setResizable(value: boolean) {
    if (value === resizable) return;

    const previousResizable = resizable;
    updateNodeData(node.id, { resizable: value });
    tracker.commit('resizable', previousResizable, value);
  }

  function selectSettingsTab(tab: WamSettingsTab) {
    if (settingsTab === tab) return;

    settingsTab = tab;
    cancelParameterEdit();
  }

  function handleSettingsTabKeydown(event: KeyboardEvent, surface: WamSettingsSurface) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    event.stopPropagation();

    const nextTab =
      event.key === 'Home'
        ? 'general'
        : event.key === 'End'
          ? 'parameters'
          : settingsTab === 'general'
            ? 'parameters'
            : 'general';

    selectSettingsTab(nextTab);
    requestAnimationFrame(() =>
      document.getElementById(`wam-${node.id}-${surface}-${nextTab}-tab`)?.focus()
    );
  }

  async function loadWam(requestedUrl = url) {
    const nextUrl = requestedUrl.trim();
    if (!nextUrl) return;

    if (!runtimeNode) {
      console.warn('[wam~] load requested before the audio runtime was available', {
        nodeId: node.id,
        url: nextUrl
      });
      status = {
        state: 'error',
        url: nextUrl,
        message: 'Audio runtime is not ready yet. Try again in a moment.'
      };
      return;
    }

    const previousUrl = node.data.url ?? DEFAULT_WAM_URL;
    if (nextUrl !== previousUrl) tracker.commit('url', previousUrl, nextUrl);

    url = nextUrl;
    await runtimeNode.setUrl(nextUrl);
  }

  async function saveState() {
    if (!runtimeNode) return;

    try {
      await runtimeNode.saveState();
      await refreshParameters();
      toast.success('Saved WAM state to this patch.');
    } catch {
      toast.error('Unable to save WAM state.');
    }
  }

  async function refreshParameters() {
    const wamNode = runtimeNode;
    if (!wamNode) {
      parameters = [];
      parameterLoadError = 'Load a WAM to inspect its parameters.';
      return;
    }

    parametersLoading = true;
    parameterLoadError = null;

    try {
      const nextParameters = await wamNode.getParameters();
      if (runtimeNode !== wamNode) return;

      parameters = nextParameters;
    } catch (error) {
      if (runtimeNode !== wamNode) return;

      parameterLoadError =
        error instanceof Error ? error.message : 'Unable to read WAM parameters.';
    } finally {
      if (runtimeNode === wamNode) parametersLoading = false;
    }
  }

  async function copyParameterKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      toast.success(`Copied parameter key: ${key}`);
    } catch {
      toast.error('Unable to copy the parameter key.');
    }
  }

  async function editParameter(parameter: WamParameter) {
    editingParameterId = parameter.id;
    parameterDraftValue = parameter.value === null ? '' : String(parameter.value);

    await tick();
    parameterInput?.focus();
    parameterInput?.select();
  }

  function cancelParameterEdit() {
    editingParameterId = null;
    parameterDraftValue = '';
  }

  async function applyParameterEdit(parameterId: string) {
    if (editingParameterId !== parameterId || parameterSavingId === parameterId) return;

    const nextValue = Number(parameterDraftValue.trim());
    if (!parameterDraftValue.trim() || !Number.isFinite(nextValue)) {
      toast.error('Enter a valid number.');
      parameterInput?.focus();
      return;
    }

    const wamNode = runtimeNode;
    if (!wamNode) {
      toast.error('Load a WAM before editing its parameters.');
      return;
    }

    parameterSavingId = parameterId;

    try {
      await wamNode.setParameter(parameterId, nextValue);
      if (runtimeNode !== wamNode) return;

      parameters = parameters.map((parameter) =>
        parameter.id === parameterId ? { ...parameter, value: nextValue } : parameter
      );
      cancelParameterEdit();
    } catch {
      toast.error(`Unable to update ${parameterId}.`);
      parameterInput?.focus();
    } finally {
      if (parameterSavingId === parameterId) parameterSavingId = null;
    }
  }

  function handleParameterKeydown(event: KeyboardEvent, parameterId: string) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void applyParameterEdit(parameterId);
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelParameterEdit();
    }
  }

  function handleParameterBlur(event: FocusEvent, parameterId: string) {
    const editor = (event.currentTarget as HTMLElement).closest('[data-parameter-editor]');
    if (event.relatedTarget instanceof Node && editor?.contains(event.relatedTarget)) return;

    void applyParameterEdit(parameterId);
  }

  async function copyWamState() {
    try {
      const state = await runtimeNode?.getState();
      if (state === undefined) {
        toast.error('This WAM does not expose its state.');
        return;
      }

      const serializedState: string | undefined = JSON.stringify(state, null, 2);
      if (serializedState === undefined) {
        toast.error('This WAM state cannot be serialized.');
        return;
      }

      await navigator.clipboard.writeText(serializedState);
      toast.success('Copied WAM state.');
    } catch {
      toast.error('Unable to copy WAM state.');
    }
  }

  function revertSettings() {
    url = DEFAULT_WAM_URL;
    setMuted(false);
    setResizable(false);
  }

  function selectCommunityPlugin(plugin: WamCommunityPlugin) {
    url = plugin.url;
    void loadWam(plugin.url);
  }

  $effect(() => {
    runtimeViewRevisionTracker?.trackObjectViewRevision(node.id);

    const persistedUrl = node.data.url ?? DEFAULT_WAM_URL;
    if (!hasInitializedUrl) {
      url = persistedUrl;
      hasInitializedUrl = true;
    }

    const nextRuntimeNode = audioService.getNodeById(node.id);
    const wamNode = nextRuntimeNode instanceof WamAudioNode ? nextRuntimeNode : null;

    if (wamNode === runtimeNode) {
      if (runtimeNode) {
        status = runtimeNode.getStatus();
        if (guiMountPoint) void runtimeNode.mountGui(guiMountPoint);
      }

      return;
    }

    detachRuntimeNode();
    if (!wamNode) return;

    runtimeNode = wamNode;
    status = wamNode.getStatus();
    wamNode.onStatusChange = (nextStatus) => {
      const previousStatus = status;
      if (shouldResetWamGuiSize(previousStatus, nextStatus)) resetNodeSizeForNewWam();

      status = nextStatus;

      if (nextStatus.state === 'loading') {
        guiElement = null;
        parameters = [];
        parameterLoadError = null;
      }

      if (nextStatus.state === 'ready' && guiMountPoint && runtimeNode === wamNode) {
        void mountRuntimeGui(wamNode);
      }

      if (nextStatus.state === 'ready' && settingsTab === 'parameters') void refreshParameters();
    };
    wamNode.onGuiMount = handleGuiMount;

    if (guiMountPoint) void wamNode.mountGui(guiMountPoint);
  });

  $effect(() => {
    if (runtimeNode && guiMountPoint) void runtimeNode.mountGui(guiMountPoint);
  });

  $effect(() => {
    if (settingsTab === 'parameters') void refreshParameters();
  });

  $effect(() => {
    if (!guiViewport || !guiElement) return;

    const resizeObserver = new ResizeObserver(handleGuiResize);
    resizeObserver.observe(guiViewport);
    resizeObserver.observe(guiElement);
    handleGuiResize();

    return () => resizeObserver.disconnect();
  });

  const settingsSidebarTarget = useSettingsSidebarTarget({
    getTarget: () => ({ id: node.id, label: displayName, content: sidebarSettingsContent }),
    floating: {
      isOpen: () => showSettings,
      setOpen: (open) => (showSettings = open)
    }
  });

  onDestroy(() => {
    detachRuntimeNode();
  });
</script>

{#snippet wamSettings(surface: WamSettingsSurface)}
  <div class={surface === 'sidebar' ? '-mx-4 -mt-3' : ''}>
    <div
      class="grid grid-cols-2 border-b border-zinc-700 bg-zinc-950/70"
      role="tablist"
      tabindex="-1"
      aria-label="WAM settings"
      onkeydown={(event) => handleSettingsTabKeydown(event, surface)}
    >
      <button
        id={`wam-${node.id}-${surface}-general-tab`}
        type="button"
        role="tab"
        aria-selected={settingsTab === 'general'}
        aria-controls={`wam-${node.id}-${surface}-general-panel`}
        tabindex={settingsTab === 'general' ? 0 : -1}
        class={[
          'flex h-9 cursor-pointer items-center justify-center border-b-2 px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none focus-visible:ring-inset',
          settingsTab === 'general'
            ? 'border-zinc-100 bg-zinc-800 text-zinc-100'
            : 'border-transparent text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
        ]}
        onclick={() => selectSettingsTab('general')}
      >
        General
      </button>
      <button
        id={`wam-${node.id}-${surface}-parameters-tab`}
        type="button"
        role="tab"
        aria-selected={settingsTab === 'parameters'}
        aria-controls={`wam-${node.id}-${surface}-parameters-panel`}
        tabindex={settingsTab === 'parameters' ? 0 : -1}
        class={[
          'flex h-9 cursor-pointer items-center justify-center gap-1.5 border-b-2 px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none focus-visible:ring-inset',
          settingsTab === 'parameters'
            ? 'border-zinc-100 bg-zinc-800 text-zinc-100'
            : 'border-transparent text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
        ]}
        onclick={() => selectSettingsTab('parameters')}
      >
        Parameters
        {#if parameters.length > 0}
          <span
            class={[
              'rounded-sm px-1.5 py-0.5 font-mono text-[10px]',
              settingsTab === 'parameters'
                ? 'bg-zinc-600 text-zinc-200'
                : 'bg-zinc-800 text-zinc-400'
            ]}
          >
            {parameters.length}
          </span>
        {/if}
      </button>
    </div>

    {#if settingsTab === 'general'}
      <div
        id={`wam-${node.id}-${surface}-general-panel`}
        class="space-y-5 p-4"
        role="tabpanel"
        aria-labelledby={`wam-${node.id}-${surface}-general-tab`}
      >
        <div class="flex min-w-0 items-start justify-between gap-3 pb-1">
          <div class="min-w-0 pt-0.5">
            <p class="truncate font-mono text-sm font-medium text-zinc-100">{displayName}</p>
            <div
              class={[
                'mt-1 flex items-center gap-1.5 font-mono text-[10px]',
                moduleStatus.textClass
              ]}
              aria-live="polite"
            >
              <span class={['h-1.5 w-1.5 rounded-full', moduleStatus.dotClass]}></span>
              {moduleStatus.label}
            </div>
          </div>

          {#if muted || resizable}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button
                  type="button"
                  class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none"
                  aria-label="Reset WAM settings"
                  onclick={revertSettings}
                >
                  <RotateCcw class="h-4 w-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>Reset output and canvas settings</Tooltip.Content>
            </Tooltip.Root>
          {/if}
        </div>

        <section class="space-y-2" aria-label="WAM source">
          <button
            type="button"
            class="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-zinc-100 px-3 text-xs font-medium text-zinc-950 transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:outline-none"
            onclick={() => (showCommunityBrowser = true)}
          >
            <LibraryBig class="h-4 w-4" />
            Browse community WAMs
          </button>

          <button
            type="button"
            class="flex h-8 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-700 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none"
            aria-expanded={showCustomUrl}
            onclick={() => (showCustomUrl = !showCustomUrl)}
          >
            <Link class="h-3.5 w-3.5" />
            {showCustomUrl ? 'Hide module URL' : 'Load from URL'}
          </button>

          {#if showCustomUrl}
            <div class="space-y-2 rounded-md bg-zinc-950/70 p-3">
              <label
                class="block font-mono text-[10px] text-zinc-400"
                for={`wam-${node.id}-${surface}-custom-url`}
              >
                Module URL
              </label>
              <input
                id={`wam-${node.id}-${surface}-custom-url`}
                class="nodrag nowheel h-8 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 font-mono text-[11px] text-zinc-100 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
                placeholder="https://example.com/wam/index.js"
                bind:value={url}
              />
              <button
                type="button"
                class="h-8 w-full cursor-pointer rounded-md bg-zinc-800 px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                disabled={status.state === 'loading'}
                onclick={() => void loadWam()}
              >
                Load WAM
              </button>
            </div>
          {/if}
        </section>

        <section class="space-y-1 pt-1" aria-label="Output and canvas">
          <h3
            class="mb-2 font-mono text-[10px] font-medium tracking-[0.05em] text-zinc-400 uppercase"
          >
            Output &amp; canvas
          </h3>

          <button
            type="button"
            role="switch"
            aria-checked={muted}
            class="flex w-full cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-2 text-left transition-colors hover:bg-zinc-800/80 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none"
            onclick={() => setMuted(!muted)}
          >
            <span class="min-w-0">
              <span class="block text-xs font-medium text-zinc-200">Mute output</span>
              <span class="mt-0.5 block text-[10px] leading-4 text-zinc-400">
                Silence audio without stopping the WAM
              </span>
            </span>
            <span
              class={[
                'flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition-colors',
                muted ? 'border-zinc-300 bg-zinc-200' : 'border-zinc-600 bg-zinc-800'
              ]}
              aria-hidden="true"
            >
              <span
                class={[
                  'h-3.5 w-3.5 rounded-full transition-transform',
                  muted ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-500'
                ]}
              ></span>
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={resizable}
            class="flex w-full cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-2 text-left transition-colors hover:bg-zinc-800/80 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none"
            onclick={() => setResizable(!resizable)}
          >
            <span class="min-w-0">
              <span class="block text-xs font-medium text-zinc-200">Enable resizing</span>
              <span class="mt-0.5 block text-[10px] leading-4 text-zinc-400">
                Show handles when this node is selected
              </span>
            </span>
            <span
              class={[
                'flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition-colors',
                resizable ? 'border-zinc-300 bg-zinc-200' : 'border-zinc-600 bg-zinc-800'
              ]}
              aria-hidden="true"
            >
              <span
                class={[
                  'h-3.5 w-3.5 rounded-full transition-transform',
                  resizable ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-500'
                ]}
              ></span>
            </span>
          </button>
        </section>
      </div>
    {:else}
      <div
        id={`wam-${node.id}-${surface}-parameters-panel`}
        class="space-y-4 p-4"
        role="tabpanel"
        aria-labelledby={`wam-${node.id}-${surface}-parameters-tab`}
      >
        <section class="space-y-2" aria-label="WAM state">
          <h3 class="font-mono text-[10px] font-medium tracking-[0.05em] text-zinc-400 uppercase">
            State
          </h3>

          <div class="grid grid-cols-2 gap-2">
            <Tooltip.Root>
              <Tooltip.Trigger class="w-full">
                <button
                  type="button"
                  class="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-zinc-800 px-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={status.state !== 'ready'}
                  onclick={saveState}
                >
                  <Save class="h-3.5 w-3.5" />
                  Save state
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>Save WAM state to this patch</Tooltip.Content>
            </Tooltip.Root>

            <Tooltip.Root>
              <Tooltip.Trigger class="w-full">
                <button
                  type="button"
                  class="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-zinc-800 px-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={status.state !== 'ready'}
                  onclick={() => void copyWamState()}
                >
                  <Copy class="h-3.5 w-3.5" />
                  Copy state
                </button>
              </Tooltip.Trigger>

              <Tooltip.Content>Copy current WAM state</Tooltip.Content>
            </Tooltip.Root>
          </div>
        </section>

        <section class="space-y-2" aria-label="WAM parameters">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-mono text-[10px] font-medium tracking-[0.05em] text-zinc-400 uppercase">
              Parameters
            </h3>

            <button
              type="button"
              class="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 font-mono text-[10px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={parametersLoading}
              onclick={() => void refreshParameters()}
            >
              <RefreshCw class={['h-3 w-3', parametersLoading && 'animate-spin']} />
              Refresh
            </button>
          </div>

          {#if parameterLoadError}
            <p class="font-mono text-[10px] leading-4 text-zinc-400">{parameterLoadError}</p>
          {:else if parametersLoading && parameters.length === 0}
            <p class="font-mono text-[10px] leading-4 text-zinc-400">Reading parameters…</p>
          {:else if parameters.length === 0}
            <p class="font-mono text-[10px] leading-4 text-zinc-400">
              This WAM exposes no parameters.
            </p>
          {:else}
            <div class="space-y-1">
              {#each parameters as parameter (parameter.id)}
                <div class="flex min-w-0 items-center gap-2 rounded-md bg-zinc-950/70 px-2 py-1.5">
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-xs text-zinc-300">
                      {parameter.label ?? parameter.id}
                    </div>

                    {#if parameter.label !== null && parameter.label !== parameter.id}
                      <div class="truncate font-mono text-[10px] text-zinc-400">
                        {parameter.id}
                      </div>
                    {/if}
                  </div>

                  {#if editingParameterId === parameter.id}
                    <div class="flex shrink-0 items-center gap-1" data-parameter-editor>
                      <input
                        bind:this={parameterInput}
                        type="number"
                        step="any"
                        inputmode="decimal"
                        value={parameterDraftValue}
                        class="nodrag nowheel h-7 w-20 rounded-md border border-zinc-600 bg-zinc-900 px-2 text-right font-mono text-[10px] text-zinc-100 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Value for ${parameter.label ?? parameter.id}`}
                        disabled={parameterSavingId === parameter.id}
                        oninput={(event) => (parameterDraftValue = event.currentTarget.value)}
                        onkeydown={(event) => handleParameterKeydown(event, parameter.id)}
                        onblur={(event) => handleParameterBlur(event, parameter.id)}
                      />
                      <Tooltip.Root>
                        <Tooltip.Trigger
                          type="button"
                          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Apply value for ${parameter.label ?? parameter.id}`}
                          disabled={parameterSavingId === parameter.id}
                          onclick={() => void applyParameterEdit(parameter.id)}
                        >
                          <Check class="h-3 w-3" />
                        </Tooltip.Trigger>
                        <Tooltip.Content>Apply value</Tooltip.Content>
                      </Tooltip.Root>
                      <Tooltip.Root>
                        <Tooltip.Trigger
                          type="button"
                          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Cancel editing ${parameter.label ?? parameter.id}`}
                          disabled={parameterSavingId === parameter.id}
                          onclick={cancelParameterEdit}
                        >
                          <X class="h-3 w-3" />
                        </Tooltip.Trigger>
                        <Tooltip.Content>Cancel</Tooltip.Content>
                      </Tooltip.Root>
                    </div>
                  {:else}
                    <span class="font-mono text-[10px] text-zinc-400">
                      {parameter.value ?? '—'}
                    </span>
                    <Tooltip.Root>
                      <Tooltip.Trigger
                        type="button"
                        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none"
                        aria-label={`Edit ${parameter.label ?? parameter.id}`}
                        onclick={() => void editParameter(parameter)}
                      >
                        <Pencil class="h-3 w-3" />
                      </Tooltip.Trigger>
                      <Tooltip.Content>Edit value</Tooltip.Content>
                    </Tooltip.Root>
                  {/if}
                  <Tooltip.Root>
                    <Tooltip.Trigger class="-ml-1">
                      <button
                        type="button"
                        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none"
                        aria-label={`Copy parameter key ${parameter.id}`}
                        onclick={() => void copyParameterKey(parameter.id)}
                      >
                        <Copy class="h-3 w-3" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Copy parameter key</Tooltip.Content>
                  </Tooltip.Root>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet floatingSettingsContent()}
  {@render wamSettings('floating')}
{/snippet}

{#snippet sidebarSettingsContent()}
  {@render wamSettings('sidebar')}
{/snippet}

<ContextMenu.Root>
  <ContextMenu.Trigger>
    <div
      class="relative min-w-16"
      style:width={node.width ? `${node.width}px` : undefined}
      style:height={node.height ? `${node.height}px` : undefined}
    >
      <NodeResizer
        isVisible={node.selected && resizable}
        minWidth={guiMinimumSize.width}
        minHeight={guiMinimumSize.height}
        keepAspectRatio
      />
      <div class="absolute -top-7 left-0 z-10 rounded-lg bg-black/60 px-2 py-1">
        <div
          class={[
            'node-title-drag-handle max-w-72 truncate font-mono text-xs font-medium',
            status.state === 'error' ? 'text-red-300' : 'text-zinc-400'
          ]}
        >
          {displayName}
        </div>
      </div>

      <div class="absolute -top-7 right-0 z-10">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              type="button"
              class="node-floating-button !opacity-100"
              aria-label="Settings"
              onclick={(event) => settingsSidebarTarget.toggle(event)}
            >
              <Settings class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Settings</Tooltip.Content>
        </Tooltip.Root>
      </div>

      <StandardHandle
        port="inlet"
        type="audio"
        title="Audio signal input"
        total={2}
        index={0}
        nodeId={node.id}
        class="!z-20"
      />
      <StandardHandle
        port="inlet"
        type="message"
        title="messages"
        total={2}
        index={1}
        nodeId={node.id}
        class="!z-20"
      />

      <div
        class={[
          'relative z-0 overflow-visible rounded border bg-zinc-950 shadow-sm',
          node.width ? 'w-full' : 'w-fit',
          node.height ? 'flex h-full flex-col' : '',
          node.selected ? 'border-zinc-400' : 'border-zinc-800/80'
        ]}
      >
        {#if status.state === 'error'}
          <div
            class="border-b border-red-900/70 bg-red-950/30 px-3 py-2 font-mono text-[10px] text-red-200"
          >
            {status.message}
          </div>
        {:else if status.state === 'loading'}
          <div class="border-b border-zinc-800 px-3 py-2 font-mono text-[10px] text-amber-300">
            Loading WAM…
          </div>
        {/if}

        <div
          class={['nodrag relative min-h-32 overflow-visible', node.height ? 'flex-1' : '']}
          bind:this={guiViewport}
        >
          <div class="origin-top-left" bind:this={guiMountPoint}></div>
        </div>
      </div>

      <StandardHandle
        port="outlet"
        type="audio"
        title="WAM audio output"
        total={1}
        index={0}
        nodeId={node.id}
        class="!z-20"
      />

      {#if showSettings}
        <div class="nowheel absolute top-0 left-full z-20 ml-3">
          <ObjectSettings
            nodeId={node.id}
            schema={[]}
            values={{}}
            onValueChange={updateSetting}
            onRevertAll={revertSettings}
            onClose={() => (showSettings = false)}
            showRevertButton={false}
            content={floatingSettingsContent}
            class="!w-[22rem] max-w-[calc(100dvw-2rem)] [&>div]:!max-h-[min(34rem,calc(100dvh-4rem))] [&>div]:!p-0"
          />
        </div>
      {/if}

      <WamCommunityBrowser bind:open={showCommunityBrowser} onSelect={selectCommunityPlugin} />
    </div>
  </ContextMenu.Trigger>
  <ContextMenu.Content>
    <ContextMenu.Item class="cursor-pointer" onclick={() => setResizable(!resizable)}>
      {resizable ? 'Disable resizing' : 'Enable resizing'}
    </ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu.Root>
