<script lang="ts">
  import { Settings } from '@lucide/svelte/icons';
  import { match } from 'ts-pattern';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import ObjectSettings from '$lib/components/settings/ObjectSettings.svelte';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import type { SettingsSchema } from '$lib/settings/types';

  let {
    nodeId,
    selected,
    title,
    status,
    error,
    fps,
    schema,
    settingsData,
    onSettingChange,
    onRevertSettings,
    messageOutletCount = 1,
    hasVideoOutlet = false
  }: {
    nodeId: string;
    selected: boolean;
    title: string;
    status: 'idle' | 'initializing' | 'running' | 'error';
    error?: string;
    fps?: number;
    schema: SettingsSchema;
    settingsData: object;
    onSettingChange: (key: string, value: unknown) => void;
    onRevertSettings: () => void;
    messageOutletCount?: number;
    hasVideoOutlet?: boolean;
  } = $props();

  let showSettings = $state(false);

  const handleClass = $derived.by(() => {
    if (!selected && $shouldShowHandles) return 'z-1';

    return `z-1 ${selected ? '' : 'opacity-40'}`;
  });

  const totalOutlets = $derived(messageOutletCount + (hasVideoOutlet ? 1 : 0));

  const statusColor = $derived(
    match(status)
      .with('idle', () => 'bg-zinc-600')
      .with('initializing', () => 'bg-amber-500 animate-pulse')
      .with('running', () => 'bg-green-500')
      .with('error', () => 'bg-red-500')
      .exhaustive()
  );
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <!-- Settings button (top-right) -->
    <div class="absolute -top-7 right-0 flex items-center gap-1">
      {#if status === 'running' && fps !== undefined}
        <span class="text-[9px] text-zinc-500">{fps}fps</span>
      {/if}

      <button
        class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
        onclick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          showSettings = !showSettings;
        }}
      >
        <Settings class="h-4 w-4 text-zinc-300" />
      </button>
    </div>

    <div class="relative">
      <!-- Video inlet (orange) -->
      <TypedHandle
        port="inlet"
        spec={{ handleType: 'video' }}
        title="Video input"
        total={1}
        index={0}
        class={handleClass}
        {nodeId}
      />

      <!-- Node body -->
      <div
        class={`rounded-lg border-1 px-4 py-2 ${selected ? 'object-container-selected' : 'object-container'}`}
      >
        <div class="flex items-center gap-2">
          <!-- Status pill -->
          <div class={`h-1.5 w-1.5 rounded-full ${statusColor}`}></div>

          <!-- Node name -->
          <span class="font-mono text-xs text-zinc-300">{title}</span>
        </div>

        {#if status === 'error' && error}
          <div class="mt-1 max-w-[140px] text-[9px] leading-tight break-words text-red-400">
            {error}
          </div>
        {/if}
      </div>

      <!-- Message outlets -->
      {#each Array(messageOutletCount) as _, i (i)}
        <TypedHandle
          port="outlet"
          spec={{ handleType: 'message', handleId: String(i) }}
          title={messageOutletCount > 1 ? `Outlet ${i}` : 'Output'}
          total={totalOutlets}
          index={i}
          {nodeId}
          class={handleClass}
        />
      {/each}

      <!-- Video outlet (for vision.segment) -->
      {#if hasVideoOutlet}
        <TypedHandle
          port="outlet"
          spec={{ handleType: 'video', handleId: '0' }}
          title="Mask video"
          total={totalOutlets}
          index={messageOutletCount}
          {nodeId}
          class={handleClass}
        />
      {/if}
    </div>
  </div>

  <!-- Settings panel -->
  {#if showSettings}
    <div class="absolute top-0 left-full ml-2">
      <ObjectSettings
        {nodeId}
        {schema}
        values={settingsData as Record<string, unknown>}
        settingsPrefix=""
        onValueChange={onSettingChange}
        onRevertAll={onRevertSettings}
        onClose={() => (showSettings = false)}
      />
    </div>
  {/if}
</div>
