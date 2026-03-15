<script lang="ts">
  import { Ellipsis, Settings, Terminal } from '@lucide/svelte/icons';
  import * as Popover from '$lib/components/ui/popover';
  import type { SettingsSchema } from '$lib/settings';

  let {
    showConsole,
    showSettings,
    onConsoleToggle,
    onSettingsToggle,
    settingsSchema
  }: {
    showConsole: boolean;
    showSettings: boolean;
    onConsoleToggle: () => void;
    onSettingsToggle: () => void;
    settingsSchema: SettingsSchema;
  } = $props();
</script>

<Popover.Root>
  <Popover.Trigger>
    <button class="cursor-pointer rounded p-1 hover:bg-zinc-700" title="More">
      <Ellipsis class="h-4 w-4 text-zinc-300" />
    </button>
  </Popover.Trigger>

  <Popover.Content class="flex w-auto flex-col p-1" align="end" sideOffset={4}>
    {#if settingsSchema.length > 0}
      <Popover.Close class="contents">
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
          onclick={onSettingsToggle}
        >
          <Settings class="h-4 w-4 text-zinc-300" />

          <span>{showSettings ? 'Hide settings' : 'Show settings'}</span>
        </button>
      </Popover.Close>
    {/if}

    <Popover.Close class="contents">
      <button
        class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
        onclick={onConsoleToggle}
      >
        <Terminal class="h-4 w-4 text-zinc-300" />

        <span>{showConsole ? 'Hide console' : 'Show console'}</span>
      </button>
    </Popover.Close>
  </Popover.Content>
</Popover.Root>
