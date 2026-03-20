<script lang="ts">
  import { Settings, Play, Pause } from '@lucide/svelte/icons';
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
    enabled = true,
    onToggleEnabled,
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
    enabled?: boolean;
    onToggleEnabled?: () => void;
    schema: SettingsSchema;
    settingsData: object;
    onSettingChange: (key: string, value: unknown) => void;
    onRevertSettings: () => void;
    messageOutletCount?: number;
    hasVideoOutlet?: boolean;
  } = $props();

  let showSettings = $state(false);

  const handleClass = 'z-1';

  const totalOutlets = $derived(messageOutletCount + (hasVideoOutlet ? 1 : 0));

  const statusColor = $derived(
    match(status)
      .with('idle', () => 'bg-zinc-400')
      .with('initializing', () => 'bg-amber-500 animate-pulse')
      .with('running', () => (enabled ? 'bg-green-500' : 'bg-zinc-400'))
      .with('error', () => 'bg-red-500')
      .exhaustive()
  );
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <!-- Settings button (top-right) -->
    <div class="absolute -top-7 right-0 flex items-center gap-1">
      {#if onToggleEnabled}
        <button
          class="cursor-pointer rounded p-1 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
          onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleEnabled();
          }}
        >
          {#if enabled}
            <Pause class="h-4 w-4" />
          {:else}
            <Play class="h-4 w-4" />
          {/if}
        </button>
      {/if}

      <button
        class="cursor-pointer rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
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
        total={2}
        index={0}
        class={handleClass}
        {nodeId}
      />

      <!-- Enable/disable message inlet -->
      <TypedHandle
        port="inlet"
        spec={{ handleType: 'message' }}
        title="Enable (1/0/bang)"
        total={2}
        index={1}
        class={handleClass}
        {nodeId}
      />

      <!-- Node body -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class={`rounded-lg border-1 px-4 py-2 ${selected ? 'object-container-selected' : 'object-container'} ${!enabled && onToggleEnabled ? 'cursor-pointer' : ''}`}
        role={!enabled && onToggleEnabled ? 'button' : undefined}
        tabindex={!enabled && onToggleEnabled ? 0 : undefined}
      >
        <div class="flex items-center gap-2">
          <div class="flex w-3 shrink-0 items-center justify-center">
            <div class={`h-1.5 w-1.5 rounded-full ${statusColor}`}></div>
          </div>

          <span class={`font-mono text-xs ${!enabled ? 'text-zinc-400' : 'text-zinc-300'}`}
            >{title}</span
          >
        </div>

        {#if status === 'error' && error}
          <div class="mt-1 max-w-[140px] text-[9px] leading-tight break-words text-red-400">
            {error}
          </div>
        {/if}
      </div>

      {#if status === 'running' && fps !== undefined && enabled}
        <div class="pointer-events-none absolute right-0 -bottom-5">
          <span class="font-mono text-[9px] text-zinc-500">{fps}fps</span>
        </div>
      {/if}

      <!-- Message outlets -->
      <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
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
