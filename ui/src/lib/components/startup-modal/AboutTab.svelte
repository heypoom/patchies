<script lang="ts">
  import { BookOpen, Github, Info, Play, Diamond, Command } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';

  import QuickTips from './QuickTips.svelte';
  import type { Tab } from './types';

  let showOnStartup = $state(true);
  let isMac = $state(false);
  let {
    setTab,
    onOpenObjectBrowser
  }: { setTab: (tab: Tab) => void; onOpenObjectBrowser: () => void } = $props();

  onMount(() => {
    isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    const setting = localStorage.getItem('patchies-show-startup-modal');
    showOnStartup = setting !== 'false';
  });

  function toggleShowOnStartup() {
    showOnStartup = !showOnStartup;
    localStorage.setItem('patchies-show-startup-modal', String(showOnStartup));
  }

  const techNodes = ['hydra', 'strudel', 'p5', 'glsl', 'three', 'orca', 'tone~', 'asm', 'js'];
</script>

<div class="flex min-h-full flex-col gap-6">
  <!-- Hero -->
  <div class="pb-1">
    <p class="mb-3.5 font-mono text-[10px] tracking-[0.25em] text-orange-500/70 uppercase">
      patchies · creative environment
    </p>
    <h1
      id="modal-title"
      class="mb-3.5 font-['Instrument_Serif'] text-[clamp(2rem,6vw,2.8rem)] leading-[1.12] text-zinc-100 italic"
    >
      Patch the world together.
    </h1>

    <p class="mb-5 font-[Syne] text-[0.82rem] leading-[0.7] text-zinc-600">
      Code-first patcher for exploring computation through audio and visual.
    </p>

    <!-- Tech node chips -->
    <div class="flex flex-wrap gap-1.5">
      {#each techNodes as node (node)}
        <a
          href="/docs/objects/{node}"
          target="_blank"
          class="rounded-[3px] border border-orange-500/[0.22] bg-orange-500/[0.06] px-[9px] py-[3px] font-mono text-[10px] text-orange-500/75 no-underline transition-colors hover:border-orange-500/45 hover:bg-orange-500/[0.12] hover:text-orange-400"
          >{node}</a
        >
      {/each}
      <button
        class="cursor-pointer rounded-[3px] border border-white/[0.07] bg-transparent px-[9px] py-[3px] font-mono text-[10px] text-zinc-600 transition-colors hover:border-orange-500/30 hover:bg-orange-500/[0.06] hover:text-orange-500/60"
        onclick={onOpenObjectBrowser}>+ more</button
      >
    </div>
  </div>

  <!-- Divider -->
  <div class="flex items-center gap-2.5">
    <span class="h-px flex-1 bg-white/[0.06]"></span>
    <span class="font-mono text-[9px] tracking-[0.25em] text-zinc-700 uppercase">get started</span>
    <span class="h-px flex-1 bg-white/[0.06]"></span>
  </div>

  <!-- Getting started panel -->
  <div
    class="flex flex-col gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-[18px] py-4"
  >
    <div class="flex items-start gap-3">
      <Play class="mt-0.5 h-[13px] w-[13px] shrink-0 text-orange-500/50" />
      <span class="font-[Syne] text-[0.83rem] leading-[1.5] text-zinc-500">
        <button class="about-link" onclick={() => setTab('demos')}>Browse demos</button>
        for inspiration and working patches.
      </span>
    </div>
    <div class="flex items-start gap-3">
      <Diamond class="mt-0.5 h-[13px] w-[13px] shrink-0 text-orange-500/50" />
      <span class="font-[Syne] text-[0.83rem] leading-[1.5] text-zinc-500">
        <a href="/docs/adding-objects" target="_blank" class="about-link">Read the guide</a>
        to learn to patch and code objects.
      </span>
    </div>
    <div class="flex items-start gap-3">
      <Command class="mt-0.5 h-[13px] w-[13px] shrink-0 text-orange-500/50" />
      <span class="font-[Syne] text-[0.83rem] leading-[1.5] text-zinc-500">
        Check <button class="about-link" onclick={() => setTab('shortcuts')}>shortcuts</button>
        to move fast.
      </span>
    </div>
  </div>

  <!-- Quick tips -->
  <QuickTips {isMac} />

  <!-- Footer row -->
  <div
    class="mt-auto flex flex-col gap-4 border-t border-white/[0.05] pt-2 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex items-center gap-4">
      <a href="/docs/adding-objects" target="_blank" rel="noopener noreferrer" class="footer-link">
        <BookOpen class="h-3 w-3" />
        docs
      </a>
      <a
        href="https://github.com/heypoom/patchies"
        target="_blank"
        rel="noopener noreferrer"
        class="footer-link"
      >
        <Github class="h-3 w-3" />
        github
      </a>
      <button class="footer-link cursor-pointer" onclick={() => setTab('thanks')}>
        ♥ thanks
      </button>
    </div>

    <!-- Show on startup toggle -->
    <div class="flex items-center gap-2">
      <Info class="h-[13px] w-[13px] shrink-0 text-zinc-700" />
      <span class="font-mono text-[10px] tracking-[0.08em] whitespace-nowrap text-zinc-700"
        >show on startup</span
      >
      <button
        onclick={toggleShowOnStartup}
        class="toggle shrink-0"
        class:toggle--on={showOnStartup}
        role="switch"
        aria-checked={showOnStartup}
        aria-label="toggle show on startup"
      >
        <span class="toggle-thumb" class:toggle-thumb--on={showOnStartup}></span>
      </button>
    </div>
  </div>
</div>

<style>
  .about-link {
    color: #f97316;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    text-decoration: none;
    transition: color 0.15s;
  }
  .about-link:hover {
    color: #fb923c;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .footer-link {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    color: #3f3f46;
    text-decoration: none;
    background: none;
    border: none;
    padding: 0;
    transition: color 0.15s;
  }
  .footer-link:hover {
    color: #71717a;
  }

  /* Toggle switch — kept in CSS due to pseudo-element positioning */
  .toggle {
    position: relative;
    display: inline-flex;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: #27272a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition:
      background 0.2s,
      border-color 0.2s;
    flex-shrink: 0;
  }
  .toggle--on {
    background: rgba(249, 115, 22, 0.25);
    border-color: rgba(249, 115, 22, 0.4);
  }
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #52525b;
    transition:
      transform 0.2s,
      background 0.2s;
  }
  .toggle-thumb--on {
    transform: translateX(16px);
    background: #f97316;
  }
</style>
