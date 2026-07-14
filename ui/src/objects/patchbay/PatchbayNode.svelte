<script lang="ts">
  import { Expand, Play, Settings, X } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
  import { onDestroy, onMount } from 'svelte';

  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { useNodeDataTracker } from '$lib/history';
  import {
    activeCodeEditorTarget,
    closeCodeEditorOverlay,
    openCodeEditorOverlay,
    syncActiveCodeEditorTargetLineErrors
  } from '../../stores/code-editor-layout.store';
  import { editorFontFamily } from '../../stores/editor.store';
  import {
    getPatchbayChannelLinkRanges,
    getPatchbayDiagnosticRanges,
    getPatchbayLocalChannelRanges,
    getPatchbayObjectAliasHintRanges,
    getPatchbayObjectAssignmentRanges,
    getPatchbayObjectKeywordRanges,
    getPatchbayObjectLinkRanges,
    getPatchbayObjectNameRanges,
    getPatchbayVirtualExpressionAssignmentRanges,
    getPatchbayVirtualExpressionKeywordRanges,
    getPatchbayVirtualExpressionNameRanges,
    getPatchbayVirtualExpressionOperatorRanges,
    patchbayContextualCompletionSource
  } from '$lib/codemirror/patchbay/patchbay.codemirror';
  import { AudioChannelRegistry } from '$lib/audio/AudioChannelRegistry';
  import { VideoChannelRegistry } from '$lib/canvas/VideoChannelRegistry';
  import { PatchbayObject } from '$objects/patchbay/PatchbayObject';
  import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
  import { getPatchbayObjectPorts } from '$objects/patchbay/patchbay-object-ports';
  import { requestFitView } from '../../stores/ui.store';

  import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
  import type { PatchbayDiagnostic } from '$lib/patchbay/patchbay-parser';

  let {
    id: nodeId,
    data,
    selected,
    width,
    height
  }: {
    id: string;
    data: { code: string; runOnEdit?: boolean; allowResize?: boolean };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData, getNodes } = useSvelteFlow();
  const tracker = $derived.by(() => useNodeDataTracker(nodeId));
  const [defaultWidth, defaultHeight] = [320, 220];
  const channelRegistry = MessageChannelRegistry.getInstance();
  const audioChannelRegistry = AudioChannelRegistry.getInstance();
  const videoChannelRegistry = VideoChannelRegistry.getInstance();
  const patchbayCompletionExtensions = [
    patchbayContextualCompletionSource(() => ({
      channels: {
        message: {
          senders: new Set(channelRegistry.getSenderChannelNames()),
          receivers: new Set(channelRegistry.getReceiverChannelNames())
        },
        audio: {
          senders: new Set(audioChannelRegistry.getSenderChannelNames()),
          receivers: new Set(audioChannelRegistry.getReceiverChannelNames())
        },
        video: {
          senders: new Set(videoChannelRegistry.getSenderChannelNames()),
          receivers: new Set(videoChannelRegistry.getReceiverChannelNames())
        }
      },
      objects: getPatchbayObjectPorts(getNodes())
    }))
  ];

  let patchbay: PatchbayObject | null = null;
  let unsubscribeRegistryChange: (() => void) | null = null;
  let unsubscribeAudioRegistryChange: (() => void) | null = null;
  let unsubscribeVideoRegistryChange: (() => void) | null = null;
  let contentContainer: HTMLDivElement | null = null;
  let contentWidth = $state(defaultWidth);
  let showSettings = $state(false);
  let diagnostics = $state<PatchbayDiagnostic[]>([]);
  const code = $derived(data.code ?? '');
  const runOnEdit = $derived(data.runOnEdit ?? true);
  const allowResize = $derived(data.allowResize ?? true);

  const isCodeEditorDetached = $derived(
    $activeCodeEditorTarget?.nodeId === nodeId && $activeCodeEditorTarget.dataKey === 'code'
  );

  const lineErrors = $derived.by(() => {
    const errors: Record<number, string[]> = {};

    for (const diagnostic of diagnostics) {
      if (diagnostic.severity !== 'error') continue;
      errors[diagnostic.line] ??= [];
      errors[diagnostic.line].push(diagnostic.message);
    }

    return errors;
  });
  const inlineDecorations = $derived([
    ...getPatchbayDiagnosticRanges(code, diagnostics).map((range) => ({
      from: range.from,
      to: range.to,
      className: range.className
    })),
    ...getPatchbayObjectNameRanges(code),
    ...getPatchbayObjectAssignmentRanges(code),
    ...getPatchbayObjectKeywordRanges(code),
    ...getPatchbayVirtualExpressionNameRanges(code),
    ...getPatchbayVirtualExpressionAssignmentRanges(code),
    ...getPatchbayVirtualExpressionKeywordRanges(code),
    ...getPatchbayVirtualExpressionOperatorRanges(code),
    ...getPatchbayLocalChannelRanges(code),
    ...getPatchbayObjectAliasHintRanges(code),
    ...getPatchbayChannelLinkRanges(code, {
      message: {
        senders: new Set(channelRegistry.getSenderChannelNames()),
        receivers: new Set(channelRegistry.getReceiverChannelNames())
      },
      audio: {
        senders: new Set(audioChannelRegistry.getSenderChannelNames()),
        receivers: new Set(audioChannelRegistry.getReceiverChannelNames())
      },
      video: {
        senders: new Set(videoChannelRegistry.getSenderChannelNames()),
        receivers: new Set(videoChannelRegistry.getReceiverChannelNames())
      }
    }).map((range) => ({
      from: range.from,
      to: range.to,
      className: range.className,
      data: JSON.stringify({ type: 'channel', section: range.section, channel: range.channel })
    })),
    ...getPatchbayObjectLinkRanges(code).map((range) => ({
      from: range.from,
      to: range.to,
      className: range.className,
      data: JSON.stringify({ type: 'object', nodeId: range.nodeId })
    }))
  ]);

  const context = {
    getParam(indexOrName: number | string) {
      return indexOrName === 'code' || indexOrName === 0 ? data.code : undefined;
    },
    setParam(indexOrName: number | string, value: unknown) {
      if (indexOrName === 'code' || indexOrName === 0) {
        updateNodeData(nodeId, { code: typeof value === 'string' ? value : '' });
      }
    },
    onParamsChange() {
      return () => {};
    }
  } as unknown as ObjectContext;

  function applyPatchbayCode() {
    patchbay?.applyCode();
    diagnostics = patchbay?.diagnostics ?? [];
  }

  function applyPatchbayCodeIfRunOnEdit() {
    if (runOnEdit) {
      applyPatchbayCode();
    }
  }

  function handleCodeChange(nextCode: string) {
    updateNodeData(nodeId, { code: nextCode });
  }

  function handleRunOnEditChange(nextRunOnEdit: boolean) {
    const oldRunOnEdit = runOnEdit;
    updateNodeData(nodeId, { runOnEdit: nextRunOnEdit });
    tracker.commit('runOnEdit', oldRunOnEdit, nextRunOnEdit);
  }

  function handleAllowResizeChange(nextAllowResize: boolean) {
    const oldAllowResize = allowResize;
    updateNodeData(nodeId, { allowResize: nextAllowResize });
    tracker.commit('allowResize', oldAllowResize, nextAllowResize);
  }

  function openExpandedEditor() {
    openCodeEditorOverlay({
      nodeId,
      dataKey: 'code',
      language: 'patchbay',
      nodeType: 'patchbay',
      title: 'patchbay',
      placeholder: '[Message]\nchan Logger\nClock -> Logger',
      onchange: handleCodeChange,
      onrun: applyPatchbayCode,
      lineErrors,
      inlineDecorations,
      extraExtensions: patchbayCompletionExtensions,
      onAltDecorationClick: focusPatchbayReference,
      lineWrap: true
    });
  }

  function updateContentWidth() {
    if (!contentContainer) return;
    contentWidth = contentContainer.offsetWidth;
  }

  function focusPatchbayReference(data: string) {
    const payload = JSON.parse(data) as
      | { type: 'channel'; section: string; channel: string }
      | { type: 'object'; nodeId: string };

    if (payload.type === 'object') {
      requestFitView.set({
        nodes: [{ id: payload.nodeId }],
        duration: 500,
        padding: 0.3,
        maxZoom: 1.5
      });
      return;
    }

    const { section, channel } = payload;
    const nodeIds =
      section === 'audio'
        ? audioChannelRegistry.getChannelNodeIds(channel)
        : section === 'video'
          ? videoChannelRegistry.getChannelNodeIds(channel)
          : channelRegistry.getChannelNodeIds(channel);

    if (nodeIds.length === 0) return;

    requestFitView.set({
      nodes: nodeIds.map((id) => ({ id })),
      duration: 500,
      padding: 0.3,
      maxZoom: 1.5
    });
  }

  $effect(() => {
    void code;
    applyPatchbayCodeIfRunOnEdit();
  });

  $effect(() => {
    syncActiveCodeEditorTargetLineErrors({
      nodeId,
      dataKey: 'code',
      lineErrors,
      inlineDecorations
    });
  });

  onMount(() => {
    patchbay = new PatchbayObject(nodeId, context, { getNodes });
    patchbay.create([]);
    unsubscribeRegistryChange = channelRegistry.onChannelsChange(() => {
      applyPatchbayCodeIfRunOnEdit();
    });
    unsubscribeAudioRegistryChange = audioChannelRegistry.onChannelsChange(() => {
      applyPatchbayCodeIfRunOnEdit();
    });
    unsubscribeVideoRegistryChange = videoChannelRegistry.onChannelsChange(() => {
      applyPatchbayCodeIfRunOnEdit();
    });
    applyPatchbayCode();

    updateContentWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateContentWidth();
    });

    if (contentContainer) {
      resizeObserver.observe(contentContainer);
    }

    return () => {
      resizeObserver.disconnect();
    };
  });

  onDestroy(() => {
    unsubscribeRegistryChange?.();
    unsubscribeRegistryChange = null;
    unsubscribeAudioRegistryChange?.();
    unsubscribeAudioRegistryChange = null;
    unsubscribeVideoRegistryChange?.();
    unsubscribeVideoRegistryChange = null;

    if (isCodeEditorDetached) {
      closeCodeEditorOverlay();
    }

    patchbay?.destroy();
    patchbay = null;
  });
</script>

<div class="group relative" style:--patchies-patchbay-node-font-family={$editorFontFamily}>
  <NodeResizer class="z-1" isVisible={selected && allowResize} minWidth={260} minHeight={160} />

  <div
    class="absolute -top-7 left-0 z-10 flex items-center justify-between"
    style="width: {contentWidth}px"
  >
    <div class="node-title-drag-handle rounded-lg bg-zinc-900 px-2 py-1">
      <div class="font-mono text-xs font-medium text-zinc-400">patchbay</div>
    </div>

    <div class="node-floating-controls flex gap-1">
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class="node-floating-button cursor-pointer"
            onclick={applyPatchbayCode}
            type="button"
            aria-label="Apply patchbay routes"
          >
            <Play class="h-4 w-4 text-zinc-300" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Apply Routes</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class="node-floating-button cursor-pointer"
            onclick={openExpandedEditor}
            type="button"
            aria-label="Expand patchbay editor"
          >
            <Expand class="h-4 w-4 text-zinc-300" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Expand Editor</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class="node-floating-button cursor-pointer"
            onclick={() => (showSettings = !showSettings)}
            type="button"
            aria-label={showSettings ? 'Close settings' : 'Open settings'}
            aria-pressed={showSettings}
          >
            <Settings class="h-4 w-4 text-zinc-300" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Settings</Tooltip.Content>
      </Tooltip.Root>
    </div>
  </div>

  <div
    bind:this={contentContainer}
    class={[
      'nodrag nowheel nopan flex flex-col overflow-hidden rounded-lg border bg-zinc-950 shadow-lg',
      selected ? 'border-zinc-400' : 'border-zinc-700'
    ]}
    style="width: {width ?? defaultWidth}px; height: {height ?? defaultHeight}px"
  >
    {#if !isCodeEditorDetached}
      <CodeEditor
        value={code}
        onchange={handleCodeChange}
        language="patchbay"
        placeholder={'[Message]\nchan Logger\nClock -> Logger'}
        class="patchbay-editor min-h-0 w-full flex-1"
        {nodeId}
        dataKey="code"
        {lineErrors}
        {inlineDecorations}
        extraExtensions={patchbayCompletionExtensions}
        onrun={applyPatchbayCode}
        onaltdecorationclick={focusPatchbayReference}
        lineWrap
      />
    {/if}
  </div>

  {#if showSettings}
    <div class="absolute top-0 z-20" style="left: {contentWidth + 10}px">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button
          onclick={() => (showSettings = false)}
          class="cursor-pointer rounded p-1 hover:bg-zinc-700"
          type="button"
          aria-label="Close patchbay settings"
        >
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
        <label class="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            class="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-950 accent-violet-400"
            checked={runOnEdit}
            onchange={(event) => handleRunOnEditChange(event.currentTarget.checked)}
          />
          <span>Run on Edit</span>
        </label>

        <label class="mt-3 flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            class="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-950 accent-violet-400"
            checked={allowResize}
            onchange={(event) => handleAllowResizeChange(event.currentTarget.checked)}
          />
          <span>Allow Resize</span>
        </label>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.patchbay-editor .cm-content) {
    min-height: 132px !important;
    max-width: none !important;
    font-family: var(--patchies-patchbay-node-font-family, var(--font-mono));
  }
</style>
