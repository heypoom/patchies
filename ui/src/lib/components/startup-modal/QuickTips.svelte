<script lang="ts">
  import { Cable, CircleDot, CirclePlus, PanelLeftOpen, Play } from '@lucide/svelte/icons';

  let { isMac }: { isMac: boolean } = $props();
</script>

<div class="rounded-lg bg-zinc-800/50 p-4">
  <ul class="grid gap-2 text-xs sm:grid-cols-2">
    <li class="hidden items-start gap-2 sm:flex">
      <CircleDot class="mt-0.5 h-4 w-4 text-orange-500" />
      <span
        >Add object: <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs">Enter</kbd>
      </span>
    </li>

    <li class="flex items-start gap-2">
      <CircleDot class="mt-0.5 h-4 w-4 text-orange-500" />
      <span
        >Browse objects: <CirclePlus class="inline h-4 w-4" />
        <span class="hidden md:inline">
          /
          <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs"
            >{isMac ? 'Cmd' : 'Ctrl'} + O</kbd
          >
        </span>
      </span>
    </li>

    <li class="hidden items-start gap-2 md:flex">
      <CircleDot class="mt-0.5 h-4 w-4 text-orange-500" />
      <span>Connect objects: drag between handles</span>
    </li>

    <li class="flex items-start gap-2 md:hidden">
      <CircleDot class="mt-0.5 h-4 w-4 text-orange-500" />
      <span>Connect objects: <Cable class="inline h-4 w-4" /></span>
    </li>

    <li class="flex items-start gap-2">
      <CircleDot class="mt-0.5 h-4 w-4 text-orange-500" />
      <span
        >Open sidebar: <PanelLeftOpen class="inline h-4 w-4" />
        <span class="hidden md:inline">
          /
          <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs"
            >{isMac ? 'Cmd' : 'Ctrl'} + B</kbd
          >
        </span>
      </span>
    </li>

    <li class="hidden items-start gap-2 sm:flex">
      <CircleDot class="mt-0.5 h-4 w-4 text-orange-500" />
      <span
        >Command palette:
        <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs"
          >{isMac ? 'Cmd' : 'Ctrl'} + K</kbd
        >
      </span>
    </li>

    <li class="flex items-start gap-2">
      <CircleDot class="mt-0.5 h-4 w-4 text-orange-500" />
      <span
        >Run code in editor: <Play class="inline h-4 w-4" />
        <span class="hidden md:inline">
          /

          <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs">Shift + Enter</kbd>
        </span>
      </span>
    </li>
  </ul>
</div>
