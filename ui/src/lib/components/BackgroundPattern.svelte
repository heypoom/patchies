<script lang="ts">
  import { Background } from '@xyflow/svelte';
  import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';
</script>

<div
  class="relative min-h-screen w-full"
  style="display: {$isBackgroundOutputCanvasEnabled ? 'none' : 'block'}"
>
  <div class="absolute inset-0 z-0" style="background: #000000aa"></div>
  <Background bgColor="#000000" gap={16} patternColor="#ffffff66" class="z-2" />
</div>
