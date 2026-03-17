<script lang="ts">
  import { X, Youtube } from '@lucide/svelte/icons';
  import { toast } from 'svelte-sonner';
  import type { StagedImage } from '$lib/ai/chat/types';

  let {
    stagedImages = $bindable([]),
    stagedYouTubeUrls = $bindable([]),
    addingYouTubeUrl = $bindable(false)
  }: {
    stagedImages: StagedImage[];
    stagedYouTubeUrls: string[];
    addingYouTubeUrl: boolean;
  } = $props();

  const YOUTUBE_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?|youtu\.be\/)/;

  function getYouTubeLabel(url: string): string {
    try {
      const u = new URL(url);

      const id = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : (u.searchParams.get('v') ?? url);

      return id;
    } catch {
      return url;
    }
  }

  let youtubeUrlInput = $state('');

  function stageYouTubeUrl() {
    const url = youtubeUrlInput.trim();
    if (!url) return;

    const isYouTubeUrl = YOUTUBE_REGEX.test(url);

    if (!isYouTubeUrl) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }

    stagedYouTubeUrls = [...stagedYouTubeUrls, url];
    youtubeUrlInput = '';
    addingYouTubeUrl = false;
  }
</script>

{#if stagedImages.length > 0 || stagedYouTubeUrls.length > 0}
  <div class="mb-1.5 flex flex-wrap gap-1.5">
    {#each stagedImages as img, i (i)}
      <div class="relative">
        <img
          src={img.previewUrl}
          alt="Staged image {i + 1}"
          class="h-16 w-16 rounded border border-zinc-700 object-cover"
        />

        <button
          onclick={() => {
            stagedImages = stagedImages.filter((_, idx) => idx !== i);
          }}
          class="absolute -top-1 -right-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
        >
          <X class="h-2.5 w-2.5" />
        </button>
      </div>
    {/each}

    {#each stagedYouTubeUrls as url, i (i)}
      <div
        class="relative flex w-full items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
      >
        <Youtube class="h-4 w-4 shrink-0 text-red-400" />

        <span class="truncate font-mono text-xs text-zinc-300">YouTube: {getYouTubeLabel(url)}</span
        >

        <button
          aria-label="Remove YouTube URL"
          onclick={() => {
            stagedYouTubeUrls = stagedYouTubeUrls.filter((_, idx) => idx !== i);
          }}
          class="absolute -top-1 -right-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
        >
          <X class="h-2.5 w-2.5" />
        </button>
      </div>
    {/each}
  </div>
{/if}

{#if addingYouTubeUrl}
  <div class="mb-1.5 flex gap-1.5">
    <!-- svelte-ignore a11y_autofocus -->
    <input
      autofocus
      bind:value={youtubeUrlInput}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          stageYouTubeUrl();
        } else if (e.key === 'Escape') {
          addingYouTubeUrl = false;
          youtubeUrlInput = '';
        }
      }}
      placeholder="https://www.youtube.com/watch?v=..."
      class="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500"
    />

    <button
      aria-label="Add YouTube URL"
      onclick={stageYouTubeUrl}
      class="cursor-pointer rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600 hover:text-white"
    >
      Add
    </button>

    <button
      aria-label="Cancel YouTube URL input"
      onclick={() => {
        addingYouTubeUrl = false;
        youtubeUrlInput = '';
      }}
      class="cursor-pointer rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
    >
      Cancel
    </button>
  </div>
{/if}
