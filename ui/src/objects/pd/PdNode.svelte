<script lang="ts">
  import { Code2, Settings, Terminal, Unlink } from '@lucide/svelte/icons';
  import { onDestroy } from 'svelte';
  import { useSvelteFlow, useUpdateNodeInternals, type NodeProps } from '@xyflow/svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { useNodeDataTracker } from '$lib/history';
  import { getPatchRuntimeViewRevisionTracker } from '$lib/runtime';
  import { VirtualFilesystem } from '$lib/vfs';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { toast } from 'svelte-sonner';
  import { PdAudioNode, type PdNodeData, type PdRuntimeStatus } from './PdAudioNode';
  import { getPdDisplayFilename } from './pd-display';
  import { resolvePdDropPath } from './pd-drop';
  import { getPdMessageInletLayout } from './pd-inlets';
  import { getDetachedPdData, getPdEditorMode, getPdMountedSource } from './pd-source';
  import PdSettings from './PdSettings.svelte';

  let node: NodeProps & { data: PdNodeData } = $props();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const audioService = AudioService.getInstance();
  const runtimeViewRevisionTracker = getPatchRuntimeViewRevisionTracker();
  const tracker = $derived.by(() => useNodeDataTracker(node.id));

  let runtimeNode: PdAudioNode | null = null;
  let status = $state<PdRuntimeStatus>({ state: 'idle' });
  let showSettings = $state(false);
  let showEditor = $state(false);
  let editorCode = $state('');
  let pathDraft = $state('');
  let hasInitializedPath = false;

  const ports = $derived(node.data.ports ?? []);
  const exposedPortIds = $derived(node.data.exposedPortIds ?? []);
  const messageInputs = $derived(
    ports.filter((port) => port.kind === 'message-in' && exposedPortIds.includes(port.id))
  );
  const messageInletLayout = $derived(getPdMessageInletLayout(messageInputs));
  const messageOutputs = $derived(
    ports.filter((port) => port.kind === 'message-out' && exposedPortIds.includes(port.id))
  );
  const inletCount = $derived(2 + messageInputs.length);
  const outletCount = $derived(1 + messageOutputs.length);
  const filename = $derived(getPdDisplayFilename(node.data, status));
  const editorMode = $derived(getPdEditorMode(node.data));
  const mountedSource = $derived(getPdMountedSource(node.data));
  const editorReadOnly = $derived(editorMode === 'readonly');
  const showConsole = $derived(node.data.showConsole ?? false);
  const summary = $derived(
    status.state === 'loading' ? 'Loading…' : status.state === 'error' ? 'Load error' : filename
  );

  async function loadVfsPath(nextPath: string) {
    const oldPath = node.data.vfsPath ?? '';
    if (nextPath !== oldPath) tracker.commit('vfsPath', oldPath, nextPath);

    pathDraft = nextPath;
    updateNodeData(node.id, {
      vfsPath: nextPath,
      sourceUrl: '',
      sourceCode: null,
      hasConfiguredPorts: false
    });
    showEditor = false;
    await runtimeNode?.setPath(nextPath);
  }

  async function loadPatch() {
    await loadVfsPath(pathDraft.trim());
  }

  function handleDragOver(event: DragEvent) {
    const types = event.dataTransfer?.types;
    if (!types?.includes('application/x-vfs-path') && !types?.includes('Files')) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    try {
      const path = await resolvePdDropPath(event.dataTransfer);
      if (path) await loadVfsPath(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load Pd patch');
    }
  }

  function toggleSettings() {
    showEditor = false;
    if (showConsole) updateNodeData(node.id, { showConsole: false });
    showSettings = !showSettings;
  }

  function toggleEditor() {
    const nextOpen = !showEditor;
    showSettings = false;
    if (showConsole) updateNodeData(node.id, { showConsole: false });

    if (nextOpen) {
      if (editorMode === 'patch' && node.data.vfsPath) {
        try {
          editorCode = VirtualFilesystem.getInstance().readEmbeddedFile(node.data.vfsPath);
        } catch {
          editorCode = runtimeNode?.getSourceCode() ?? '';
        }
      } else {
        editorCode = node.data.sourceCode ?? runtimeNode?.getSourceCode() ?? '';
      }
    }

    showEditor = nextOpen;
  }

  function toggleConsole() {
    showEditor = false;
    showSettings = false;
    updateNodeData(node.id, { showConsole: !showConsole });
  }

  async function commitCode(newCode: string) {
    if (editorReadOnly) return;

    if (editorMode === 'patch') {
      if (runtimeNode?.getSourceCode() === newCode) return;

      if (runtimeNode) {
        await runtimeNode.updateMountedPatch(newCode);
        return;
      }

      const path = node.data.vfsPath;
      if (!path) return;

      const vfs = VirtualFilesystem.getInstance();
      vfs.writeEmbeddedFile(path, newCode);
      vfs.objectFiles.setRuntimeContent(node.id, 'patch.pd', path, newCode);
      updateNodeData(node.id, { hasConfiguredPorts: false });
      return;
    }

    const oldCode = node.data.sourceCode ?? null;
    if (oldCode === newCode) return;

    tracker.commit('sourceCode', oldCode, newCode);

    if (runtimeNode) {
      await runtimeNode.setEditedCode(newCode);
      return;
    }

    updateNodeData(node.id, {
      vfsPath: '',
      sourceUrl: '',
      sourceCode: newCode,
      hasConfiguredPorts: false
    });
  }

  async function detachSource() {
    const updates = getDetachedPdData(editorCode);

    tracker.commitMany('Detach Pd patch', [
      { dataKey: 'vfsPath', oldValue: node.data.vfsPath ?? '', newValue: updates.vfsPath },
      { dataKey: 'sourceUrl', oldValue: node.data.sourceUrl ?? '', newValue: updates.sourceUrl },
      {
        dataKey: 'sourceCode',
        oldValue: node.data.sourceCode ?? null,
        newValue: updates.sourceCode
      },
      {
        dataKey: 'hasConfiguredPorts',
        oldValue: node.data.hasConfiguredPorts ?? false,
        newValue: updates.hasConfiguredPorts
      }
    ]);

    pathDraft = '';
    updateNodeData(node.id, updates);
    await runtimeNode?.detachSource(editorCode);
  }

  async function togglePort(portId: string) {
    const nextIds = exposedPortIds.includes(portId)
      ? exposedPortIds.filter((id) => id !== portId)
      : [...exposedPortIds, portId];

    updateNodeData(node.id, { exposedPortIds: nextIds, hasConfiguredPorts: true });
    tracker.commit('exposedPortIds', exposedPortIds, nextIds);
    await runtimeNode?.setExposedPortIds(nextIds);
  }

  function detachRuntimeNode() {
    if (runtimeNode) runtimeNode.onStatusChange = () => {};
    runtimeNode = null;
  }

  $effect(() => {
    runtimeViewRevisionTracker?.trackObjectViewRevision(node.id);

    if (!hasInitializedPath) {
      pathDraft = node.data.vfsPath ?? '';
      hasInitializedPath = true;
    }

    const nextNode = audioService.getNodeById(node.id);
    const pdNode = nextNode instanceof PdAudioNode ? nextNode : null;
    if (pdNode === runtimeNode) {
      if (runtimeNode) status = runtimeNode.getStatus();
      return;
    }

    detachRuntimeNode();
    if (!pdNode) return;

    runtimeNode = pdNode;
    status = pdNode.getStatus();
    if (showEditor && node.data.sourceCode == null) editorCode = pdNode.getSourceCode();

    pdNode.onStatusChange = (nextStatus) => {
      status = nextStatus;

      if (nextStatus.state === 'ready' && showEditor && node.data.sourceCode == null) {
        editorCode = pdNode.getSourceCode();
      }
    };
  });

  $effect(() => {
    void ports;
    void exposedPortIds;
    updateNodeInternals(node.id);
  });

  onDestroy(detachRuntimeNode);
</script>

<div
  class="relative"
  role="group"
  aria-label="Pure Data patch"
  ondragover={handleDragOver}
  ondrop={handleDrop}
>
  <div class="absolute -top-7 left-0 z-10 flex w-full justify-end gap-x-1">
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class={[
            'h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700',
            showConsole && 'bg-zinc-700'
          ]}
          aria-label="Pure Data console"
          onclick={toggleConsole}
        >
          <Terminal class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Pure Data console</Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class={[
            'h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40',
            showEditor && 'bg-zinc-700'
          ]}
          disabled={status.state === 'loading'}
          aria-label="Edit Pure Data code"
          onclick={toggleEditor}
        >
          <Code2 class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Edit Pure Data code</Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class={[
            'h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700',
            showSettings && 'bg-zinc-700'
          ]}
          aria-label="Pure Data settings"
          onclick={toggleSettings}
        >
          <Settings class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Pure Data settings</Tooltip.Content>
    </Tooltip.Root>
  </div>

  <StandardHandle
    port="inlet"
    type="audio"
    id={0}
    title="stereo audio"
    total={inletCount}
    index={0}
    nodeId={node.id}
  />
  {#each messageInletLayout as inlet (inlet.key)}
    <StandardHandle
      port="inlet"
      type="message"
      id={inlet.handleId}
      title={inlet.title}
      total={inletCount}
      index={inlet.position}
      nodeId={node.id}
    />
  {/each}

  <div
    class={[
      'min-w-44 rounded-md border bg-zinc-900/90 px-3 py-2 shadow-sm',
      node.selected ? 'border-zinc-400' : 'border-zinc-700'
    ]}
  >
    <div class="min-w-0">
      <div class="font-mono text-xs font-medium text-zinc-200">pd</div>

      <div
        class={[
          'mt-1 max-w-40 truncate font-mono text-[11px]',
          status.state === 'error'
            ? 'text-red-300'
            : status.state === 'loading'
              ? 'text-amber-300'
              : 'text-zinc-400'
        ]}
        title={status.state === 'error' ? status.message : filename}
      >
        {summary}
      </div>
    </div>
  </div>

  <StandardHandle
    port="outlet"
    type="audio"
    id={0}
    title="stereo audio"
    total={outletCount}
    index={0}
    nodeId={node.id}
  />
  {#each messageOutputs as port, index (port.id)}
    <StandardHandle
      port="outlet"
      type="message"
      id={index + 1}
      title={port.label}
      total={outletCount}
      index={index + 1}
      nodeId={node.id}
    />
  {/each}

  {#if showSettings}
    <div class="absolute top-0 left-full z-20 ml-3">
      <PdSettings
        path={pathDraft}
        {ports}
        {exposedPortIds}
        loading={status.state === 'loading'}
        onPathChange={(value) => (pathDraft = value)}
        onLoad={() => void loadPatch()}
        onTogglePort={(portId) => void togglePort(portId)}
        onClose={() => (showSettings = false)}
      />
    </div>
  {/if}

  {#if showEditor}
    <div class="absolute top-0 left-full z-20 ml-3">
      <div class="min-w-96 overflow-hidden rounded-md border border-zinc-600 bg-zinc-900 shadow-xl">
        {#if mountedSource}
          <div class="flex items-center gap-2 border-b border-zinc-700 px-2 py-1.5">
            <div class="min-w-0 flex-1">
              <div class="truncate font-mono text-[10px] text-zinc-300" title={mountedSource}>
                {mountedSource}
              </div>
              {#if editorReadOnly}
                <div class="text-[10px] text-zinc-500">Read-only until detached</div>
              {/if}
            </div>

            <button
              type="button"
              class="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={status.state === 'loading'}
              onclick={() => void detachSource()}
            >
              <Unlink class="h-3 w-3" />
              Detach
            </button>
          </div>
        {/if}

        <CodeEditor
          value={editorCode}
          onchange={(code) => (editorCode = code)}
          oncommit={({ newValue }) => void commitCode(newValue)}
          onrun={(code) => void commitCode(code ?? editorCode)}
          language="puredata"
          nodeType="pd"
          dataKey="sourceCode"
          placeholder="Pure Data patch source"
          class="nodrag h-72 w-full min-w-96 resize-none"
          lineWrap
          readOnly={editorReadOnly}
        />
      </div>
    </div>
  {/if}

  <div
    class={[
      'absolute top-full left-0 z-20 mt-3 w-96',
      !showConsole && 'pointer-events-none hidden'
    ]}
  >
    <VirtualConsole
      nodeId={node.id}
      placeholder="Pure Data output will appear here."
      showRunControls={false}
      initialWidth={384}
      class="shadow-xl"
    />
  </div>
</div>
