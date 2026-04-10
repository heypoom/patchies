<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { Vision } from './types';

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  interface Props {
    vision: Vision;
    index: number;
    accentColor: string;
    glowColor: string;
    textColor: string;
    onClose: () => void;
  }

  let { vision, index, accentColor, glowColor, textColor, onClose }: Props = $props();

  const roman = $derived(ROMAN[index] ?? 'I');

  function focusOnMount(el: HTMLElement) {
    el.focus();
  }
</script>

<div
  class="flip-backdrop"
  onclick={onClose}
  onkeydown={(e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Esc') && onClose()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  use:focusOnMount
>
  <div
    class="flip-card"
    style:--card-accent={accentColor}
    style:--card-glow={glowColor}
    onclick={(e) => e.stopPropagation()}
    role="presentation"
  >
    <!-- Corner ornaments -->
    <span class="fc fc-tl" aria-hidden="true"></span>
    <span class="fc fc-tr" aria-hidden="true"></span>
    <span class="fc fc-bl" aria-hidden="true"></span>
    <span class="fc fc-br" aria-hidden="true"></span>

    <!-- Roman numeral watermark -->
    <span class="flip-roman sparks-mono" aria-hidden="true">{roman}</span>

    <!-- Close -->
    <button class="flip-close sparks-mono cursor-pointer" onclick={onClose}>✕</button>

    <!-- Accent glow -->
    <div class="flip-glow" aria-hidden="true"></div>

    <!-- Content -->
    <div class="flip-content">
      <p class="flip-eyebrow sparks-mono">vision · {roman}</p>
      <h3 class="sparks-serif flip-title" style:color={textColor}>{vision.title}</h3>
      <p class="flip-vision-text">{vision.vision}</p>
    </div>

    <!-- Aspects divider -->
    <div class="flip-divider" aria-hidden="true">
      <span class="flip-divider-line"></span>
      <span class="flip-divider-label sparks-mono">aspects</span>
      <span class="flip-divider-line"></span>
    </div>

    <!-- Node chips -->
    <div class="flip-nodes">
      {#each vision.nodes as node (node)}
        <span class="sparks-mono flip-node-chip">{node}</span>
      {/each}
    </div>

    <!-- CTA pill row -->
    <div class="flip-ctas">
      <Tooltip.Root>
        <Tooltip.Trigger class="flex-1">
          <button class="flip-cta sparks-mono w-full cursor-pointer">⊞ scatter</button>
        </Tooltip.Trigger>
        <Tooltip.Content class="z-[200]">Scatter nodes onto your board</Tooltip.Content>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger class="flex-1">
          <button class="flip-cta sparks-mono w-full cursor-pointer">✦ chat</button>
        </Tooltip.Trigger>
        <Tooltip.Content class="z-[200]">Open this idea in AI chat</Tooltip.Content>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger class="flex-1">
          <button class="flip-cta sparks-mono w-full cursor-pointer">⎘ copy</button>
        </Tooltip.Trigger>
        <Tooltip.Content class="z-[200]">Copy idea to clipboard</Tooltip.Content>
      </Tooltip.Root>
    </div>
  </div>
</div>

<style>
  .flip-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 24px;
    animation: fade-in 0.2s ease both;
    perspective: 1200px;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .flip-card {
    position: relative;
    background: #0a0a0e;
    border: 1px solid color-mix(in srgb, var(--card-accent) 40%, transparent);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.04),
      0 0 80px color-mix(in srgb, var(--card-accent) 15%, transparent),
      0 32px 64px rgba(0, 0, 0, 0.7);
    border-radius: 12px;
    padding: 32px 32px 24px;
    max-width: 400px;
    width: 100%;
    overflow: hidden;
    animation: flip-in 0.38s cubic-bezier(0.22, 0.61, 0.36, 1) both;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  @keyframes flip-in {
    from {
      opacity: 0;
      transform: rotateY(-80deg) scale(0.9);
    }
    to {
      opacity: 1;
      transform: rotateY(0deg) scale(1);
    }
  }

  .fc {
    position: absolute;
    width: 14px;
    height: 14px;
    opacity: 0.35;
    pointer-events: none;
  }
  .fc-tl {
    top: 10px;
    left: 10px;
    border-top: 1px solid var(--card-accent);
    border-left: 1px solid var(--card-accent);
  }
  .fc-tr {
    top: 10px;
    right: 10px;
    border-top: 1px solid var(--card-accent);
    border-right: 1px solid var(--card-accent);
  }
  .fc-bl {
    bottom: 10px;
    left: 10px;
    border-bottom: 1px solid var(--card-accent);
    border-left: 1px solid var(--card-accent);
  }
  .fc-br {
    bottom: 10px;
    right: 10px;
    border-bottom: 1px solid var(--card-accent);
    border-right: 1px solid var(--card-accent);
  }

  .flip-roman {
    position: absolute;
    top: 18px;
    right: 40px;
    font-size: 10px;
    letter-spacing: 0.3em;
    color: color-mix(in srgb, var(--card-accent) 20%, transparent);
    user-select: none;
    pointer-events: none;
  }

  .flip-glow {
    position: absolute;
    top: -40px;
    left: -40px;
    right: -40px;
    height: 220px;
    background: radial-gradient(
      ellipse 70% 60% at 50% 40%,
      var(--card-glow, rgba(249, 115, 22, 0.08)),
      transparent 70%
    );
    pointer-events: none;
  }

  .flip-close {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 11px;
    color: #3f3f46;
    background: none;
    border: none;
    padding: 4px 6px;
    transition: color 0.15s;
    line-height: 1;
    z-index: 2;
  }
  .flip-close:hover {
    color: #71717a;
  }

  .flip-content {
    position: relative;
    z-index: 1;
    padding-bottom: 22px;
  }

  .flip-eyebrow {
    font-size: 9px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--card-accent) 50%, transparent);
    margin-bottom: 12px;
  }

  .flip-title {
    font-size: clamp(1.25rem, 3vw, 1.55rem);
    line-height: 1.2;
    margin-bottom: 14px;
    padding-right: 12px;
  }

  .flip-vision-text {
    font-family: 'Syne', sans-serif;
    font-size: 0.82rem;
    line-height: 1.75;
    color: #52525b;
  }

  .flip-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .flip-divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.07));
  }
  .flip-divider-line:first-child {
    background: linear-gradient(270deg, transparent, rgba(255, 255, 255, 0.07));
  }
  .flip-divider-label {
    font-size: 9px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #3f3f46;
  }

  .flip-nodes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 22px;
  }
  .flip-node-chip {
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 3px;
    border: 1px solid color-mix(in srgb, var(--card-accent) 22%, transparent);
    background: color-mix(in srgb, var(--card-accent) 7%, transparent);
    color: color-mix(in srgb, var(--card-accent) 70%, #71717a);
  }

  .flip-ctas {
    display: flex;
    gap: 6px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
  .flip-cta {
    flex: 1;
    padding: 7px 6px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.02);
    color: #52525b;
    font-size: 10px;
    letter-spacing: 0.04em;
    transition:
      border-color 0.15s,
      background 0.15s,
      color 0.15s;
  }
  .flip-cta:hover {
    border-color: color-mix(in srgb, var(--card-accent) 30%, transparent);
    background: color-mix(in srgb, var(--card-accent) 8%, transparent);
    color: color-mix(in srgb, var(--card-accent) 80%, #a1a1aa);
  }
</style>
