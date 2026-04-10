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

  const techNodes = ['hydra', 'strudel', 'p5', 'glsl', 'three', 'orca', 'tone~'];
</script>

<div class="about-root">
  <!-- Hero -->
  <div class="about-hero">
    <p class="about-eyebrow">patchies · creative environment</p>

    <h1 id="modal-title" class="about-headline">Patch the world together.</h1>

    <p class="about-subhead">
      Connect computational, audio and visual objects in real time - on the web.
    </p>

    <!-- Tech node chips -->
    <div class="about-chips">
      {#each techNodes as node (node)}
        <a href="/docs/objects/{node}" target="_blank" class="about-chip">{node}</a>
      {/each}
      <button class="about-chip about-chip--more cursor-pointer" onclick={onOpenObjectBrowser}
        >+ more</button
      >
    </div>
  </div>

  <!-- Divider -->
  <div class="about-divider">
    <span class="about-divider-line"></span>
    <span class="about-divider-label">get started</span>
    <span class="about-divider-line"></span>
  </div>

  <!-- Getting started panel -->
  <div class="about-panel">
    <div class="about-panel-row">
      <Play class="about-panel-icon" />
      <span class="about-panel-text">
        <button class="about-link" onclick={() => setTab('demos')}>Browse demos</button>
        for inspiration and working patches.
      </span>
    </div>
    <div class="about-panel-row">
      <Diamond class="about-panel-icon" />
      <span class="about-panel-text">
        <a href="/docs/adding-objects" target="_blank" class="about-link">Read the guide</a>
        to learn to patch and code objects.
      </span>
    </div>
    <div class="about-panel-row">
      <Command class="about-panel-icon" />
      <span class="about-panel-text">
        Check <button class="about-link" onclick={() => setTab('shortcuts')}>shortcuts</button>
        to move fast.
      </span>
    </div>
  </div>

  <!-- Quick tips -->
  <QuickTips {isMac} />

  <!-- Footer row -->
  <div class="about-footer">
    <!-- Links -->
    <div class="about-footer-links">
      <a
        href="/docs/adding-objects"
        target="_blank"
        rel="noopener noreferrer"
        class="about-footer-link"
      >
        <BookOpen class="about-footer-icon" />
        docs
      </a>
      <a
        href="https://github.com/heypoom/patchies"
        target="_blank"
        rel="noopener noreferrer"
        class="about-footer-link"
      >
        <Github class="about-footer-icon" />
        github
      </a>
      <button class="about-footer-link cursor-pointer" onclick={() => setTab('thanks')}>
        ♥ thanks
      </button>
    </div>

    <!-- Show on startup toggle -->
    <div class="about-toggle-row">
      <Info class="about-toggle-icon" />
      <span class="about-toggle-label">show on startup</span>
      <button
        onclick={toggleShowOnStartup}
        class="about-toggle"
        class:about-toggle--on={showOnStartup}
        role="switch"
        aria-checked={showOnStartup}
        aria-label="toggle show on startup"
      >
        <span class="about-toggle-thumb" class:about-toggle-thumb--on={showOnStartup}></span>
      </button>
    </div>
  </div>
</div>

<style>
  .about-root {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: 100%;
  }

  /* Hero */
  .about-hero {
    padding-bottom: 4px;
  }

  .about-eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: rgba(249, 115, 22, 0.7);
    margin-bottom: 14px;
  }

  .about-headline {
    font-family: 'Instrument Serif', serif;
    font-style: italic;
    font-size: clamp(2rem, 6vw, 2.8rem);
    line-height: 1.12;
    color: #f4f4f5;
    margin-bottom: 14px;
  }

  .about-subhead {
    font-family: 'Syne', sans-serif;
    font-size: 0.85rem;
    line-height: 1.7;
    color: #52525b;
    margin-bottom: 20px;
  }

  /* Tech chips */
  .about-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .about-chip {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    padding: 3px 9px;
    border-radius: 3px;
    border: 1px solid rgba(249, 115, 22, 0.22);
    background: rgba(249, 115, 22, 0.06);
    color: rgba(249, 115, 22, 0.75);
    text-decoration: none;
    transition:
      border-color 0.15s,
      background 0.15s,
      color 0.15s;
    cursor: pointer;
  }

  .about-chip:hover {
    border-color: rgba(249, 115, 22, 0.45);
    background: rgba(249, 115, 22, 0.12);
    color: #fb923c;
  }

  .about-chip--more {
    border-color: rgba(255, 255, 255, 0.07);
    background: transparent;
    color: #3f3f46;
  }

  .about-chip--more:hover {
    border-color: rgba(249, 115, 22, 0.3);
    background: rgba(249, 115, 22, 0.06);
    color: rgba(249, 115, 22, 0.6);
  }

  /* Divider */
  .about-divider {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .about-divider-line {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
  }

  .about-divider-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #3f3f46;
  }

  /* Getting started panel */
  .about-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 16px 18px;
  }

  .about-panel-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  :global(.about-panel-icon) {
    color: rgba(249, 115, 22, 0.5);
    margin-top: 2px;
    flex-shrink: 0;
    width: 13px;
    height: 13px;
  }

  .about-panel-text {
    font-family: 'Syne', sans-serif;
    font-size: 0.83rem;
    color: #71717a;
    line-height: 1.5;
  }

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

  /* Footer */
  .about-footer {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  @media (min-width: 480px) {
    .about-footer {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  .about-footer-links {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .about-footer-link {
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

  .about-footer-link:hover {
    color: #71717a;
  }

  :global(.about-footer-icon) {
    width: 12px;
    height: 12px;
  }

  /* Toggle */
  .about-toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.about-toggle-icon) {
    width: 13px;
    height: 13px;
    color: #3f3f46;
    flex-shrink: 0;
  }

  .about-toggle-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: #3f3f46;
    white-space: nowrap;
  }

  .about-toggle {
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

  .about-toggle--on {
    background: rgba(249, 115, 22, 0.25);
    border-color: rgba(249, 115, 22, 0.4);
  }

  .about-toggle-thumb {
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

  .about-toggle-thumb--on {
    transform: translateX(16px);
    background: #f97316;
  }
</style>
