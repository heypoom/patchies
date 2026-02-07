<script lang="ts">
  import { BookOpen, Github, Heart, Info, Play } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';

  import demoImage from '$lib/images/startup-modal.webp';
  import QuickTips from './QuickTips.svelte';
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

      <!-- Getting Started -->
      <div class="rounded-lg bg-zinc-800/50 p-4">
        <h3 class="mb-3 text-xs font-medium text-zinc-200">New to Patchies?</h3>

        <ul class="grid gap-x-6 gap-y-2 text-sm text-zinc-300 sm:grid-cols-2">
          <li class="flex items-start gap-2">
            <Play class="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            <span>
              <a href="#!" class="text-orange-300 hover:underline" onclick={() => setTab('demos')}
                >Browse demos</a
              > for inspiration.
            </span>
          </li>

          <li class="flex items-start gap-2">
            <BookOpen class="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            <span>
              <a href="/docs" target="_blank" class="text-orange-300 hover:underline"
                >Read the guides</a
              > to learn the basics.
            </span>
          </li>
        </ul>
      </div>

      <!-- Shortcuts -->
      <QuickTips {isMac} />

      <!-- Open Source -->
      <p class="flex items-center gap-1.5 text-xs text-zinc-500">
        <Heart class="h-3.5 w-3.5" />
        Patchies is built on
        <a href="#!" class="text-zinc-400 hover:underline" onclick={() => setTab('thanks')}
          >amazing open source libraries.</a
        >
      </p>
    </div>
  </div>

  <!-- Resources and Show on startup - pushed to bottom -->
  <div class="mt-auto flex flex-col gap-y-4 pt-4 md:flex-row md:items-end md:justify-between">
    <!-- Links -->
    <div class="space-y-3">
      <h2 class="text-sm font-semibold text-zinc-200">Resources</h2>
      <div class="flex gap-4">
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-sm text-blue-400 hover:underline"
        >
          <BookOpen class="h-4 w-4" />
          Guides & References
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
