<script lang="ts">
  let { category, variant = 0 }: { category: string; variant?: number } = $props();

  const signalPaths: Record<string, string[]> = {
    Visual: [
      'M -8 42 C 18 42 18 12 44 12 S 70 40 96 40 S 122 18 156 18',
      'M -8 34 C 20 6 34 58 62 30 S 104 10 156 38',
      'M -8 44 L 20 12 L 22 44 L 50 12 L 52 44 L 80 12 L 82 44 L 110 12 L 112 44 L 140 12 L 142 44 L 156 28'
    ],
    Audio: [
      'M -8 30 H 16 L 25 12 L 36 48 L 48 20 L 60 38 L 72 28 H 156',
      'M -8 30 H 18 L 28 20 L 38 40 L 50 8 L 62 50 L 76 30 H 156',
      'M -8 30 H 20 L 32 16 L 44 44 L 58 24 L 70 36 L 84 30 H 156'
    ],
    Programming: [
      'M -8 42 H 26 V 16 H 58 V 38 H 94 V 12 H 124 V 30 H 156',
      'M -8 18 H 28 V 42 H 62 V 24 H 94 V 46 H 126 V 20 H 156',
      'M -8 36 H 22 V 14 H 54 V 44 H 88 V 22 H 122 V 36 H 156'
    ],
    Networking: [
      'M -8 38 C 20 38 20 16 48 16 S 78 42 104 42 S 130 22 156 22',
      'M -8 18 C 28 18 22 44 58 44 S 90 16 120 16 S 138 34 156 34',
      'M -8 40 C 20 8 42 48 70 20 S 116 44 156 18'
    ],
    'Dev Patches': [
      'M -8 40 H 24 V 18 H 54 V 40 H 88 V 18 H 120 V 40 H 156',
      'M -8 20 H 20 V 42 H 52 V 20 H 84 V 42 H 118 V 20 H 156',
      'M -8 38 H 30 V 14 H 64 V 38 H 98 V 14 H 132 V 38 H 156'
    ]
  };

  const categoryPaths = $derived(signalPaths[category] ?? signalPaths.Programming);
  const path = $derived(categoryPaths[variant % categoryPaths.length]);
</script>

<svg class="demo-signal" viewBox="0 0 156 60" preserveAspectRatio="none" aria-hidden="true">
  <path class="signal-base" d={path} pathLength="1" />
  <path class="signal-pulse" d={path} pathLength="1" />
</svg>

<style>
  .demo-signal {
    position: absolute;
    top: 4px;
    right: -10px;
    width: 58%;
    height: 58px;
    opacity: 0.42;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .signal-base,
  .signal-pulse {
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .signal-base {
    stroke: #3f3f46;
    stroke-width: 1;
  }

  .signal-pulse {
    stroke: #f97316;
    stroke-width: 1.5;
    stroke-dasharray: 0.18 0.82;
    stroke-dashoffset: 1;
    opacity: 0;
  }

  :global(.ex-card:hover) .demo-signal,
  :global(.ex-card:focus-visible) .demo-signal {
    opacity: 0.9;
  }

  :global(.ex-card:hover) .signal-pulse,
  :global(.ex-card:focus-visible) .signal-pulse {
    opacity: 1;
    animation: signal-sweep 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes signal-sweep {
    from {
      stroke-dashoffset: 1;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.ex-card:hover) .signal-pulse,
    :global(.ex-card:focus-visible) .signal-pulse {
      animation: none;
      stroke-dashoffset: 0;
    }
  }
</style>
