<script lang="ts">
  import Terminal from '@lucide/svelte/icons/terminal';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import CodeBlockActionButton from './CodeBlockActionButton.svelte';
  import CodeBlockOverflowMenu from './CodeBlockOverflowMenu.svelte';
  import type { PrimaryButton } from '$lib/eventbus/events';
  import type { SettingsSchema } from '$lib/settings';

  let {
    layout,
    showConsole,
    showSettings,
    settingsSchema,
    isRunning,
    showRunningIndicator,
    isLongRunningTaskActive,
    onConsoleToggle,
    onSettingsToggle,
    onCodeToggle,
    onRun
  }: {
    layout: { body: PrimaryButton; floating: PrimaryButton; codeInMenu: boolean };
    showConsole: boolean;
    showSettings: boolean;
    settingsSchema?: SettingsSchema;
    isRunning: boolean;
    showRunningIndicator: boolean;
    isLongRunningTaskActive: boolean;
    onConsoleToggle: () => void;
    onSettingsToggle: (event?: MouseEvent) => void;
    onCodeToggle: (event: MouseEvent) => void;
    onRun: () => void;
  } = $props();
</script>

<div class="node-floating-controls flex items-center sm:group-hover/header:opacity-100">
  {#if settingsSchema || layout.codeInMenu}
    <CodeBlockOverflowMenu
      {showConsole}
      {showSettings}
      {settingsSchema}
      {onConsoleToggle}
      {onSettingsToggle}
      onCodeToggle={layout.codeInMenu ? onCodeToggle : undefined}
      showSettingsAction={layout.body !== 'settings'}
    />
  {:else}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="cursor-pointer rounded p-1 hover:bg-zinc-700"
          onclick={onConsoleToggle}
          aria-label="Console"
        >
          <Terminal class="h-4 w-4 text-zinc-300" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Console</Tooltip.Content>
    </Tooltip.Root>
  {/if}

  <CodeBlockActionButton
    action={layout.floating}
    {isRunning}
    {showRunningIndicator}
    {isLongRunningTaskActive}
    {onRun}
    onCode={onCodeToggle}
    onSettings={onSettingsToggle}
  />
</div>
