<script lang="ts">
  import { page } from '$app/state';
  import { CircleX } from '@lucide/svelte/icons';
</script>

<svelte:head>
  <title>Topic Not Found | Patchies Docs</title>
</svelte:head>

<div class="flex flex-col items-center justify-center py-24 text-center">
  <CircleX class="mb-4 h-12 w-12 text-zinc-600" />
  <h1 class="mb-2 text-2xl font-bold text-zinc-200">Topic Not Found</h1>
  <p class="mb-6 text-zinc-400">{page.error?.message ?? 'This topic does not exist.'}</p>
  <a
    href="/docs/demos"
    class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
  >
    Back to Docs
  </a>
</div>
