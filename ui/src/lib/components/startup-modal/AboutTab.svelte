<script lang="ts">
  import { ArrowRight, Command, Diamond } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';

  import QuickTips from './QuickTips.svelte';
  import type { Tab } from './types';

  let isMac = $state(false);
  let {
    setTab,
    onOpenObjectBrowser
  }: { setTab: (tab: Tab) => void; onOpenObjectBrowser: () => void } = $props();

  onMount(() => {
    isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  });

  const techNodes = ['hydra', 'strudel', 'p5', 'glsl', 'three', 'orca', 'chuck~', 'asm', 'js'];
</script>

<div class="about-content">
  <section class="hero-stage">
    <div class="hero-copy">
      <h1 class="hero-title">
        <span>Patch the world</span>
        <span class="text-orange-500">together.</span>
      </h1>

      <p class="hero-description">
        Connect code, sound, and visuals into systems you can see, hear, and play.
      </p>

      <div class="hero-actions">
        <button class="hero-action hero-action--primary" onclick={() => setTab('demos')}>
          Explore demos
          <ArrowRight class="h-4 w-4" />
        </button>
        <button class="hero-action hero-action--secondary" onclick={onOpenObjectBrowser}>
          Browse objects
        </button>
      </div>
    </div>

    <div class="patch-visual" aria-hidden="true">
      <svg class="patch-diagram" viewBox="0 0 320 260" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="hydra-stripes" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="5" height="10" fill="#27272a" />
          </pattern>
        </defs>

        <path class="patch-cable patch-cable--quiet" d="M 120 51 C 164 51, 78 130, 110 130" />
        <path class="patch-cable patch-cable--active" d="M 202 130 C 226 130, 214 94, 238 94" />
        <path class="patch-cable patch-cable--quiet" d="M 202 130 C 236 130, 82 216, 110 216" />
        <path class="patch-cable patch-cable--quiet" d="M 170 216 C 180 216, 188 216, 198 216" />

        <g class="diagram-node">
          <text class="code-node-label" x="16" y="23">strudel</text>
          <rect x="16" y="30" width="104" height="42" rx="6" />
          <text class="node-value node-value--code" x="30" y="56">s("bd sd")</text>
          <circle class="node-port" cx="120" cy="51" r="4" />
        </g>

        <g class="diagram-node diagram-node--active">
          <rect x="110" y="102" width="92" height="56" rx="8" />
          <text class="node-name" x="124" y="125">gain~</text>
          <text class="node-value" x="124" y="144">0.72</text>
          <circle class="node-port" cx="110" cy="130" r="4" />
          <circle class="node-port" cx="202" cy="130" r="4" />
        </g>

        <g class="diagram-node">
          <rect x="238" y="66" width="68" height="56" rx="8" />
          <text class="node-name" x="250" y="90">out~</text>
          <circle class="node-port" cx="238" cy="94" r="4" />
          <g class="signal-bars">
            <rect x="251" y="104" width="3" height="8" rx="1" />
            <rect x="257" y="99" width="3" height="13" rx="1" />
            <rect x="263" y="94" width="3" height="18" rx="1" />
            <rect x="269" y="101" width="3" height="11" rx="1" />
            <rect x="275" y="106" width="3" height="6" rx="1" />
          </g>
        </g>

        <g class="diagram-node diagram-node--analyser">
          <rect x="110" y="200" width="60" height="32" rx="7" />
          <text class="node-name" x="124" y="220">fft~</text>
          <circle class="node-port node-port--neutral" cx="110" cy="216" r="4" />
          <circle class="node-port node-port--neutral" cx="170" cy="216" r="4" />
        </g>

        <g class="diagram-visual">
          <text class="visual-label" x="198" y="192">hydra</text>
          <rect class="visual-output" x="198" y="198" width="76" height="36" rx="2" />
          <circle class="node-port node-port--neutral" cx="198" cy="216" r="4" />
        </g>
      </svg>
    </div>

    <div class="tech-rail">
      {#each techNodes as node (node)}
        <a href="/docs/objects/{node}" target="_blank" class="tech-link">{node}</a>
      {/each}
    </div>

    <div class="starter-deck">
      <nav class="learning-paths" aria-label="Getting started">
        <a href="/docs/adding-objects" target="_blank" class="learning-path">
          <Diamond class="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Learn the basics</strong>
            <small>Read the guide to patching and code objects.</small>
          </span>
          <ArrowRight class="ml-auto h-3.5 w-3.5 shrink-0" />
        </a>
        <button class="learning-path" onclick={() => setTab('shortcuts')}>
          <Command class="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>All shortcuts</strong>
            <small>Keyboard and mouse reference.</small>
          </span>
          <ArrowRight class="ml-auto h-3.5 w-3.5 shrink-0" />
        </button>
      </nav>

      <div class="quick-reference">
        <QuickTips {isMac} />
      </div>
    </div>
  </section>
</div>

<style>
  .about-content {
    width: 100%;
    min-height: 100%;
    background: #0b0b0d;
  }

  .hero-stage {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1.12fr) minmax(250px, 0.88fr);
    overflow: hidden;
    background: #0b0b0d;
  }

  .hero-copy {
    position: relative;
    z-index: 2;
    display: flex;
    min-height: 274px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    padding: 22px 18px 22px 32px;
  }

  .hero-title {
    display: flex;
    flex-direction: column;
    margin: 0 0 14px;
    max-width: 12ch;
    font-size: clamp(2.25rem, 6vw, 3.35rem);
    font-weight: 400;
    line-height: 0.98;
    letter-spacing: -0.035em;
    text-wrap: balance;
    color: #f4f4f5;
  }

  .hero-description {
    max-width: 39ch;
    margin: 0 0 22px;
    color: #d4d4d8;
    font-size: 0.875rem;
    line-height: 1.55;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .hero-action {
    display: inline-flex;
    min-height: 36px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 6px;
    padding: 8px 13px;
    cursor: pointer;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.8125rem;
    font-weight: 500;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .hero-action:focus-visible,
  .learning-path:focus-visible,
  .tech-link:focus-visible {
    outline: 2px solid rgba(251, 146, 60, 0.8);
    outline-offset: 2px;
  }

  .hero-action--primary {
    border: 1px solid #f4f4f5;
    background: #f4f4f5;
    color: #18181b;
  }

  .hero-action--primary:hover {
    border-color: #ffffff;
    background: #ffffff;
  }

  .hero-action--secondary {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #d4d4d8;
  }

  .hero-action--secondary:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: #f4f4f5;
  }

  .patch-visual {
    position: relative;
    min-height: 274px;
    overflow: hidden;
    border-left: 1px solid rgba(255, 255, 255, 0.07);
    background-color: #0e0e10;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  .patch-diagram {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .patch-cable {
    fill: none;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .patch-cable--quiet {
    stroke: #52525b;
  }

  .patch-cable--active {
    stroke: #f97316;
  }

  .diagram-node > rect {
    fill: #18181b;
    stroke: rgba(255, 255, 255, 0.18);
  }

  .diagram-node--active > rect {
    stroke: rgba(249, 115, 22, 0.55);
  }

  .diagram-node--analyser > rect {
    stroke: rgba(255, 255, 255, 0.18);
  }

  .node-name,
  .node-value,
  .code-node-label,
  .visual-label {
    font-family: 'IBM Plex Mono', monospace;
  }

  .node-name {
    fill: #f4f4f5;
    font-size: 11px;
    font-weight: 500;
  }

  .node-value {
    fill: #a1a1aa;
    font-size: 8px;
  }

  .node-value--code {
    font-size: 9px;
  }

  .code-node-label {
    fill: #a1a1aa;
    font-size: 9px;
    font-weight: 500;
  }

  .node-port {
    fill: #f97316;
    stroke: #18181b;
    stroke-width: 2;
  }

  .node-port--neutral {
    fill: #71717a;
  }

  .visual-label {
    fill: #a1a1aa;
    font-size: 9px;
    font-weight: 500;
  }

  .visual-output {
    fill: url('#hydra-stripes');
    stroke: rgba(255, 255, 255, 0.2);
    vector-effect: non-scaling-stroke;
  }

  .signal-bars rect {
    fill: #f97316;
    transform-box: fill-box;
    transform-origin: center bottom;
    animation: signal-bars 0.9s ease-in-out infinite alternate;
  }

  .signal-bars rect:nth-child(2) {
    animation-delay: -0.3s;
  }

  .signal-bars rect:nth-child(3) {
    animation-delay: -0.6s;
  }

  .signal-bars rect:nth-child(4) {
    animation-delay: -0.15s;
  }

  .signal-bars rect:nth-child(5) {
    animation-delay: -0.45s;
  }

  .tech-rail {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    padding: 9px 24px;
    background: #111113;
  }

  .tech-link {
    border-radius: 3px;
    padding: 3px 7px;
    color: #a1a1aa;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.625rem;
    text-decoration: none;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .tech-link:hover {
    background: rgba(249, 115, 22, 0.12);
    color: #fb923c;
  }

  .starter-deck {
    grid-column: 1 / -1;
    display: grid;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    background: #111113;
  }

  .learning-paths {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .learning-path {
    display: flex;
    min-height: 72px;
    align-items: center;
    gap: 10px;
    border: 0;
    background: transparent;
    padding: 15px 28px;
    color: #fb923c;
    cursor: pointer;
    text-align: left;
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .learning-path + .learning-path {
    border-left: 1px solid rgba(255, 255, 255, 0.07);
  }

  .learning-path:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .learning-path:focus-visible {
    outline-offset: -3px;
  }

  .learning-path span {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }

  .learning-path strong {
    color: #e4e4e7;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .learning-path small {
    overflow: hidden;
    color: #a1a1aa;
    font-size: 0.6875rem;
    line-height: 1.35;
    text-overflow: ellipsis;
  }

  .quick-reference {
    min-width: 0;
  }

  @keyframes signal-bars {
    to {
      transform: scaleY(0.42);
    }
  }

  @media (max-width: 600px) {
    .hero-stage {
      grid-template-columns: 1fr;
    }

    .hero-copy {
      min-height: auto;
      padding: 24px 22px 22px;
    }

    .hero-title {
      max-width: 11ch;
      font-size: clamp(2rem, 10vw, 2.8rem);
    }

    .patch-visual {
      min-height: 244px;
      border-top: 1px solid rgba(255, 255, 255, 0.07);
      border-left: 0;
    }

    .tech-rail {
      padding-inline: 14px;
    }

    .learning-paths {
      grid-template-columns: 1fr;
    }

    .learning-path {
      padding-inline: 16px;
    }

    .learning-path + .learning-path {
      border-top: 1px solid rgba(255, 255, 255, 0.07);
      border-left: 0;
    }
  }

  @media (min-width: 601px) and (max-height: 760px) {
    .hero-copy {
      padding-block: 14px;
    }

    .hero-title {
      margin-bottom: 10px;
      font-size: 3rem;
    }

    .hero-description {
      margin-bottom: 16px;
    }

    .learning-path {
      min-height: 64px;
      padding: 11px 24px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .signal-bars rect {
      animation: none;
    }
  }
</style>
