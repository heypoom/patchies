<script lang="ts">
  import {
    BookOpen,
    Cable,
    CircleDot,
    CirclePlus,
    Command,
    Github,
    Info,
    PanelLeftOpen,
    Play
  } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';

  import demoImage from '$lib/images/startup-modal.webp';
  import type { Tab } from './types';

  let showOnStartup = $state(true);
  let isMac = $state(false);
  let { setTab }: { setTab: (tab: Tab) => void } = $props();

  onMount(() => {
    isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    // Load the current setting from localStorage
    const setting = localStorage.getItem('patchies-show-startup-modal');
    showOnStartup = setting !== 'false'; // Default to true if not set
  });

  function toggleShowOnStartup() {
    showOnStartup = !showOnStartup;
    localStorage.setItem('patchies-show-startup-modal', String(showOnStartup));
  }
</script>

<div class="flex min-h-[calc(85vh-120px)] w-full flex-col">
  <img
    src={demoImage}
    alt="patch demo"
    class="mb-[20px] h-[10dvh] w-full object-cover object-center"
  />

  <div class="space-y-4">
    <!-- Header -->
    <div>
      <h1 id="modal-title" class="text-xl font-semibold text-zinc-100">Patchies</h1>
    </div>

    <!-- Description -->
    <div class="space-y-4 text-zinc-300">
      <p class="text-sm">
        Patchies is a patcher for things that runs on the web. Patch together <a
          class="text-orange-300"
          href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#audio-chaining"
          target="_blank">audio</a
        >,
        <a
          class="text-orange-300"
          href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#video-chaining"
          target="_blank">visual</a
        >
        and
        <a
          class="text-orange-300"
          href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#message-passing"
          target="_blank">computational</a
        >
        objects e.g.
        <a
          class="text-orange-300"
          href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#p5-creates-a-p5js-sketch"
          target="_blank">P5</a
        >,
        <a
          class="text-orange-300"
          href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#hydra-creates-a-hydra-video-synthesizer"
          target="_blank">Hydra</a
        >,
        <a
          class="text-orange-300"
          href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#strudel-strudel-music-environment"
          target="_blank">Strudel</a
        >,
        <a
          class="text-orange-300"
          href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#chuck-creates-a-chuck-audio-programming-environment"
          target="_blank">ChucK</a
        >,
        <a
          class="text-orange-300"
          href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#orca-orca-livecoding-sequencer"
          target="_blank">Orca</a
        >,
        <a
          class="text-orange-300"
          href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#tone-tonejs-synthesis-and-processing"
          target="_blank">Tone.js</a
        >,
        <a
          class="text-orange-300"
          href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#glsl-creates-a-glsl-fragment-shader"
          target="_blank">GLSL</a
        >, etc.
      </p>

      <div class="rounded-lg bg-zinc-800/50 p-4">
        <ul class="grid gap-2 text-xs sm:grid-cols-2">
          <li class="hidden items-start gap-2 sm:flex">
            <CircleDot class="mt-0.5 h-4 w-4 text-orange-500" />
            <span
              >Add object: <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs"
                >Enter</kbd
              >
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
            <span>Connect nodes: drag between handles</span>
          </li>

          <li class="flex items-start gap-2 md:hidden">
            <CircleDot class="mt-0.5 h-4 w-4 text-orange-500" />
            <span>Connect nodes: <Cable class="inline h-4 w-4" /></span>
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

      <!-- License Link -->
      <div>
        <p class="text-sm text-zinc-300">
          New to Patchies? Check out the
          <a href="#!" class="text-orange-300 hover:underline" onclick={() => setTab('demos')}
            >demos tab</a
          >
          to get some inspirations! Patchies is open source and built upon many
          <a href="#!" class="text-orange-300 hover:underline" onclick={() => setTab('thanks')}
            >amazing creative coding libraries</a
          >
        </p>
      </div>
    </div>
  </div>

  <!-- Resources and Show on startup - pushed to bottom -->
  <div class="mt-auto flex flex-col gap-y-4 pt-4 md:flex-row md:items-end md:justify-between">
    <!-- Links -->
    <div class="space-y-3">
      <h2 class="text-sm font-semibold text-zinc-200">Resources</h2>
      <div class="flex gap-4">
        <a
          href="https://github.com/heypoom/patchies/blob/main/README.md"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-sm text-blue-400 hover:underline"
        >
          <BookOpen class="h-4 w-4" />
          Guide & Docs
        </a>

        <a
          href="https://github.com/heypoom/patchies"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-sm text-blue-400 hover:underline"
        >
          <Github class="h-4 w-4" />
          GitHub
        </a>
      </div>
    </div>

    <!-- Show on startup toggle -->
    <div class="flex max-w-xs items-center justify-between gap-x-10 rounded-lg border p-3">
      <div class="flex items-center gap-2">
        <Info class="h-4 w-4 text-zinc-400" />
        <span class="text-sm text-zinc-300">show on startup?</span>
      </div>

      <button
        onclick={toggleShowOnStartup}
        class="relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors {showOnStartup
          ? 'bg-orange-500'
          : 'bg-zinc-700'}"
        role="switch"
        aria-checked={showOnStartup}
        aria-label="toggle show on startup"
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {showOnStartup
            ? 'translate-x-6'
            : 'translate-x-1'}"
        ></span>
      </button>
    </div>
  </div>
</div>
