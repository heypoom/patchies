<script lang="ts">
  import { Settings } from '@lucide/svelte/icons';
  import { onDestroy, onMount } from 'svelte';
  import { useSvelteFlow, type NodeProps } from '@xyflow/svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import ObjectSettings from '$lib/components/settings/ObjectSettings.svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { getPatchRuntimeViewRevisionTracker } from '$lib/runtime';
  import type { SettingsSchema } from '$lib/settings';
  import {
    openObjectSettingsInSidebarIfPreferred,
    registerSettingsSidebarTarget
  } from '../../stores/settings-sidebar.store';

  import type { SmplrRuntimeStatus } from './SmplrInstrumentAudioNode';
  import type { GmRuntimeStatus } from './GmAudioNode';
  import type { SmplrInstrumentDescriptor } from './descriptors';

  type SmplrLayoutDescriptor = Pick<
    SmplrInstrumentDescriptor,
    'title' | 'defaultSettings' | 'settingsSchema' | 'getDisplayName' | 'getInstrumentNames'
  > & {
    type: string;
  };

  interface SmplrLayoutRuntime {
    onStatusChange?: (status: SmplrRuntimeStatus | GmRuntimeStatus) => void;
    onSettingsPatch?: (patch: Record<string, unknown>) => void;
  }

  interface SmplrNodeData {
    settings?: Record<string, unknown>;
    settingsSchema?: SettingsSchema;
  }

  let {
    descriptor,
    node
  }: {
    descriptor: SmplrLayoutDescriptor;
    node: NodeProps & { data: SmplrNodeData };
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const audioService = AudioService.getInstance();
  const runtimeViewRevisionTracker = getPatchRuntimeViewRevisionTracker();

  let runtimeNode: SmplrLayoutRuntime | null = null;

  let status = $state<SmplrRuntimeStatus | GmRuntimeStatus>({ state: 'idle' });
  let showSettings = $state(false);

  let settings = $derived({ ...descriptor.defaultSettings, ...(node.data.settings ?? {}) });

  const settingsSchema = $derived.by(() => createSettingsSchema(descriptor, settings));
  const instrumentName = $derived(descriptor.getDisplayName(settings));

  const loadingText = $derived.by(() => {
    if (status.state === 'loading') {
      if ('total' in status) {
        return status.total > 0 ? `loading ${status.loaded}/${status.total}` : 'loading';
      }

      return `ch ${status.channel} program ${status.program}`;
    }

    if (status.state === 'error') {
      return status.message;
    }

    return instrumentName;
  });

  function persistSettings(nextSettings: Record<string, unknown>) {
    settings = nextSettings;

    updateNodeData(node.id, {
      settings: nextSettings,
      settingsSchema: createSettingsSchema(descriptor, nextSettings)
    });
  }

  async function updateSetting(key: string, value: unknown) {
    const nextSettings = { ...settings, [key]: value };
    persistSettings(nextSettings);

    audioService.send(node.id, 'settings', nextSettings);
  }

  async function applySettingsPatch(patch: Record<string, unknown>) {
    const nextSettings = { ...settings, ...patch };
    persistSettings(nextSettings);
  }

  function revertSettings() {
    persistSettings(descriptor.defaultSettings);

    audioService.send(node.id, 'settings', descriptor.defaultSettings);
  }

  function toggleSettings() {
    if (openObjectSettingsInSidebarIfPreferred()) {
      showSettings = false;
      return;
    }

    showSettings = !showSettings;
  }

  $effect(() => {
    if (settingsSchema.length === 0) return;

    return registerSettingsSidebarTarget({
      id: node.id,
      label: descriptor.title,
      schema: settingsSchema,
      values: settings,
      onValueChange: updateSetting,
      onRevertAll: revertSettings
    });
  });

  function createSettingsSchema(
    descriptor: SmplrLayoutDescriptor,
    settings: Record<string, unknown>
  ): SettingsSchema {
    const instrumentNames = Array.isArray(settings.instrumentNames)
      ? settings.instrumentNames.filter((name): name is string => typeof name === 'string')
      : [];

    if (instrumentNames.length === 0) {
      return descriptor.settingsSchema;
    }

    return descriptor.settingsSchema.map((field) =>
      field.key === 'instrument'
        ? {
            key: field.key,
            label: field.label,
            description: field.description,
            persistence: field.persistence,
            type: 'combobox' as const,
            options: instrumentNames,
            default: instrumentNames[0] ?? '',
            searchPlaceholder:
              descriptor.type === 'soundfont2~'
                ? 'Search SF2 instruments...'
                : 'Search instruments...',
            emptyMessage: 'No instrument found.'
          }
        : field
    );
  }

  async function loadInstrumentCatalogPatch(): Promise<Record<string, unknown>> {
    if (!descriptor.getInstrumentNames) return {};

    try {
      const module = await import('smplr');

      const instrumentNames = await descriptor.getInstrumentNames(module);
      if (instrumentNames.length === 0) return {};

      const currentInstrument =
        typeof settings.instrument === 'string' ? settings.instrument : undefined;

      const instrument =
        currentInstrument && instrumentNames.includes(currentInstrument)
          ? currentInstrument
          : instrumentNames[0];

      return { instrument, instrumentNames };
    } catch (error) {
      console.warn(`Failed to load ${descriptor.type} instrument catalog`, error);
      return {};
    }
  }

  function detachRuntimeNode() {
    if (!runtimeNode) return;

    runtimeNode.onStatusChange = undefined;
    runtimeNode.onSettingsPatch = undefined;
    runtimeNode = null;
  }

  $effect(() => {
    runtimeViewRevisionTracker?.trackObjectViewRevision(node.id);

    const nextRuntimeNode = audioService.getNodeById(node.id) as SmplrLayoutRuntime | null;
    if (nextRuntimeNode === runtimeNode) return;

    detachRuntimeNode();
    if (!nextRuntimeNode) return;

    runtimeNode = nextRuntimeNode;
    runtimeNode.onStatusChange = (nextStatus) => {
      status = nextStatus;

      if (
        nextStatus.state === 'ready' &&
        'instrumentNames' in nextStatus &&
        nextStatus.instrumentNames?.length
      ) {
        const current = node.data.settings ?? {};
        const currentInstrumentNames = Array.isArray(current.instrumentNames)
          ? current.instrumentNames
          : [];

        const hasSameInstrumentNames =
          currentInstrumentNames.length === nextStatus.instrumentNames.length &&
          currentInstrumentNames.every(
            (name, index) => name === nextStatus.instrumentNames?.[index]
          );

        if (!hasSameInstrumentNames) {
          persistSettings({ ...current, instrumentNames: nextStatus.instrumentNames });
        }
      }
    };

    runtimeNode.onSettingsPatch = (patch) => {
      void applySettingsPatch(patch);
    };
  });

  onMount(async () => {
    const catalogPatch = await loadInstrumentCatalogPatch();
    const initialSettings = { ...settings, ...catalogPatch };
    const hasCatalogPatch = Object.keys(catalogPatch).length > 0;

    if (!node.data.settings || !node.data.settingsSchema || hasCatalogPatch) {
      persistSettings(initialSettings);
    }
  });

  onDestroy(() => {
    detachRuntimeNode();
  });
</script>

<div class="relative">
  <StandardHandle
    port="inlet"
    type="message"
    title="MIDI and trigger messages"
    total={1}
    index={0}
    nodeId={node.id}
  />

  <div
    class={[
      'min-w-44 rounded-md border bg-zinc-900/90 px-3 py-2 shadow-sm',
      node.selected ? 'border-zinc-400' : 'border-zinc-700'
    ]}
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="font-mono text-xs font-medium text-zinc-200">{descriptor.title}</div>

        <div
          class={[
            'mt-1 max-w-40 truncate text-[11px]',
            status.state === 'error' ? 'text-red-300' : 'text-zinc-400'
          ]}
        >
          {loadingText}
        </div>
      </div>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            type="button"
            class="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Settings"
            onclick={toggleSettings}
          >
            <Settings class="h-4 w-4" />
          </button>
        </Tooltip.Trigger>

        <Tooltip.Content>Settings</Tooltip.Content>
      </Tooltip.Root>
    </div>
  </div>

  <StandardHandle
    port="outlet"
    type="audio"
    title="Audio output"
    total={1}
    index={0}
    nodeId={node.id}
  />

  {#if showSettings}
    <div class="absolute top-0 left-full z-20 ml-3">
      <ObjectSettings
        nodeId={node.id}
        schema={settingsSchema}
        values={settings}
        onValueChange={updateSetting}
        onRevertAll={revertSettings}
        onClose={() => (showSettings = false)}
      />
    </div>
  {/if}
</div>
