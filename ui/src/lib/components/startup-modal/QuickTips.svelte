<script lang="ts">
  import { Cable, CirclePlus, PanelLeftOpen, Play } from '@lucide/svelte/icons';

  let { isMac }: { isMac: boolean } = $props();
</script>

<div class="rounded-lg bg-zinc-800/50 p-4">
  <ul class="grid gap-x-6 gap-y-1.5 text-xs text-zinc-400 sm:grid-cols-2">
    <li class="hidden sm:block">
      Add object: <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs">Enter</kbd>
    </li>

    <li>
      Browse objects: <CirclePlus class="inline h-3.5 w-3.5" />
      <span class="hidden md:inline">
        / <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs"
          >{isMac ? 'Cmd' : 'Ctrl'} + O</kbd
        >
      </span>
    </li>

    <li class="hidden md:block">Connect objects: drag between handles</li>

    <li class="md:hidden">
      Connect objects: <Cable class="inline h-3.5 w-3.5" />
    </li>

    <li>
      Open sidebar: <PanelLeftOpen class="inline h-3.5 w-3.5" />
      <span class="hidden md:inline">
        / <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs"
          >{isMac ? 'Cmd' : 'Ctrl'} + B</kbd
        >
      </span>
    </li>

    <li class="hidden sm:block">
      Command palette:
      <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs"
        >{isMac ? 'Cmd' : 'Ctrl'} + K</kbd
      >
    </li>

    <li>
      Run code: <Play class="inline h-3.5 w-3.5" />
      <span class="hidden md:inline">
        / <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs">Shift + Enter</kbd>
      </span>
    </li>
  </ul>
</div>
