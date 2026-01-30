<script lang="ts">
  import Stats from 'stats.js';
  import { onDestroy } from 'svelte';
  import { isFpsMonitorVisible } from '../../stores/ui.store';

  let stats: Stats | null;
  let frameHandler: number;
  let container: HTMLDivElement;

  function animate() {
    if (!$isFpsMonitorVisible) {
      cancelAnimationFrame(frameHandler);
      return;
    }

    if (stats) {
      stats.update();
      frameHandler = requestAnimationFrame(animate);
    }
  }

  $effect(() => {
    if ($isFpsMonitorVisible) {
      stats = new Stats();
      container.appendChild(stats.dom);
      frameHandler = requestAnimationFrame(animate);
    } else {
      if (stats?.dom) {
        container.removeChild(stats.dom);
        stats.dom.remove();
      }

      stats = null;
    }
  });

  onDestroy(() => {
    cancelAnimationFrame(frameHandler);
  });
</script>

<div bind:this={container}></div>
