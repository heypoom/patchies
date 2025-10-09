<script lang="ts">
	import { Background } from '@xyflow/svelte';
</script>

<!-- <Background bgColor="#18181b" gap={16} patternColor="oklch(44.2% 0.017 285.786)" /> -->

<!-- <div class="relative min-h-screen w-full bg-[#020617]">
	<div
		class="absolute inset-0 z-0"
		style="backgroundImage: radial-gradient(circle 500px at 50% 300px, rgba(16,185,129,0.35), transparent)"
	></div>
</div> -->

<div class="relative min-h-screen w-full">
	<div
		class="absolute inset-0 z-0"
		style="
            background: radial-gradient(ellipse 80% 60% at 60% 20%, rgba(175, 109, 255, 0.50), transparent 65%),
            radial-gradient(ellipse 70% 60% at 20% 80%, rgba(255, 100, 180, 0.45), transparent 65%),
            radial-gradient(ellipse 60% 50% at 60% 65%, rgba(255, 235, 170, 0.43), transparent 62%),
            radial-gradient(ellipse 65% 40% at 50% 60%, rgba(120, 190, 255, 0.48), transparent 68%),
            linear-gradient(180deg, #f7eaff 0%, #fde2ea 100%)"
	></div>
</div>

<!-- <div class="relative min-h-screen w-full bg-white">
	<div
		class="absolute inset-0 z-0"
		style="
      background-image:
        linear-gradient(to right, #e7e5e4 1px, transparent 1px),
        linear-gradient(to bottom, #e7e5e4 1px, transparent 1px);
      background-size: 20px 20px;
      background-position: 0 0, 0 0;
      mask-image: repeating-linear-gradient(
          to right,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        ),
        repeating-linear-gradient(
          to bottom,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        );
      -webkit-mask-image:
        repeating-linear-gradient(
          to right,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        ),
        repeating-linear-gradient(
          to bottom,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        );
      mask-composite: intersect;
      -webkit-mask-composite: source-in;
    "
	></div>
</div>
 -->
<!-- <div class="relative min-h-screen w-full bg-[#0f172a]">
	<div
		class="absolute inset-0 z-0"
		style="
      background: #0f172a;
      background-image:
        linear-gradient(to right, rgba(148,163,184,0.2) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148,163,184,0.2) 1px, transparent 1px);
      background-size: 40px 40px;
    "
	></div>
</div> -->

<!-- <div class="grid-animated-container relative min-h-screen w-full bg-white">
	<div
		class="absolute inset-0 z-0"
		style="
      background-image:
        linear-gradient(90deg, rgba(16,185,129,0.25) 1px, transparent 0),
        linear-gradient(180deg, rgba(16,185,129,0.25) 1px, transparent 0),
        repeating-linear-gradient(45deg, rgba(16,185,129,0.2) 0 2px, transparent 2px 6px);
      background-size: 48px 24px, 24px 24px, 24px 48px;
      -webkit-mask: radial-gradient(circle at var(--x, 50%) var(--y, 50%), black 0, transparent 30%);
      mask: radial-gradient(circle at var(--x, 50%) var(--y, 50%), black 0, transparent 30%);
      animation: spotlight 8s ease-in-out infinite;
    "
	></div>
</div> -->
