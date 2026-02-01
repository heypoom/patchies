<script lang="ts">
  import { ModeWatcher } from 'mode-watcher';
  import ProfilingMonitor from '$lib/components/ProfilingMonitor.svelte';
  import '../app.css';

  let { children } = $props();
</script>

<ModeWatcher />
{@render children()}
<ProfilingMonitor />
