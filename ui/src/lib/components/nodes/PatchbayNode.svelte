<script lang="ts">
  import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
  import { onDestroy, onMount } from 'svelte';

  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { editorFontFamily } from '../../../stores/editor.store';
  import {
    getPatchbayChannelLinkRanges,
    getPatchbayDiagnosticRanges,
    getPatchbayLocalChannelRanges
  } from '$lib/codemirror/patchbay.codemirror';
  import { PatchbayObject } from '$lib/objects/v2/nodes/PatchbayObject';
  import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
  import { requestFitView } from '../../../stores/ui.store';

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
    data: { code: string };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const [defaultWidth, defaultHeight] = [320, 220];
  const channelRegistry = MessageChannelRegistry.getInstance();

  let patchbay: PatchbayObject | null = null;
  let unsubscribeRegistryChange: (() => void) | null = null;
  let diagnostics = $state<PatchbayDiagnostic[]>([]);
  const code = $derived(data.code ?? '');
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
    ...getPatchbayLocalChannelRanges(code),
    ...getPatchbayChannelLinkRanges(code, {
      senders: new Set(channelRegistry.getSenderChannelNames()),
      receivers: new Set(channelRegistry.getReceiverChannelNames())
    }).map((range) => ({
      from: range.from,
      to: range.to,
      className: range.className,
      data: range.channel
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

  function handleCodeChange(nextCode: string) {
    updateNodeData(nodeId, { code: nextCode });
  }

  function focusChannelNodes(channel: string) {
    const nodeIds = channelRegistry.getChannelNodeIds(channel);
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
    applyPatchbayCode();
  });

  onMount(() => {
    patchbay = new PatchbayObject(nodeId, context);
    patchbay.create([]);
    unsubscribeRegistryChange = channelRegistry.onChannelsChange(() => {
      applyPatchbayCode();
    });
    applyPatchbayCode();
  });

  onDestroy(() => {
    unsubscribeRegistryChange?.();
    unsubscribeRegistryChange = null;
    patchbay?.destroy();
    patchbay = null;
  });
</script>

<div class="relative" style:--patchies-patchbay-node-font-family={$editorFontFamily}>
  <NodeResizer class="z-1" isVisible={selected} minWidth={260} minHeight={160} />

  <div class="node-title-drag-handle absolute -top-7 z-10 w-fit rounded-lg bg-zinc-900 px-2 py-1">
    <div class="font-mono text-xs font-medium text-zinc-400">patchbay</div>
  </div>

  <div
    class={[
      'nodrag nowheel nopan flex flex-col overflow-hidden rounded-lg border bg-zinc-950 shadow-lg',
      selected ? 'border-zinc-400' : 'border-zinc-700'
    ]}
    style="width: {width ?? defaultWidth}px; height: {height ?? defaultHeight}px"
  >
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
      onaltdecorationclick={focusChannelNodes}
      lineWrap
    />
  </div>
</div>

<style>
  :global(.patchbay-editor .cm-content) {
    min-height: 132px !important;
    max-width: none !important;
    font-family: var(--patchies-patchbay-node-font-family, var(--font-mono));
  }
</style>
