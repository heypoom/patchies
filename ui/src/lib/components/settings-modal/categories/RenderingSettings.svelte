<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingToggle from '../SettingToggle.svelte';
  import SettingDropdown from '../SettingDropdown.svelte';
  import { isFpsMonitorVisible } from '../../../../stores/ui.store';
  import { renderFpsCap, type FpsCap } from '../../../../stores/renderer.store';
  import { useWebCodecs, showVideoStats } from '../../../../stores/video.store';

  const fpsCapOptions = [
    { value: '0', label: 'Unlimited' },
    { value: '30', label: '30 FPS' },
    { value: '60', label: '60 FPS' }
  ];

  const currentFpsCap = $derived(String($renderFpsCap));

  function handleFpsCapChange(value: string) {
    renderFpsCap.set(Number(value) as FpsCap);
  }
</script>

<SettingRow title="Render FPS cap" description="Limit the rendering frame rate">
  <SettingDropdown value={currentFpsCap} options={fpsCapOptions} onchange={handleFpsCapChange} />
</SettingRow>

<SettingRow title="Show FPS monitor" description="Display frames-per-second counter">
  <SettingToggle checked={$isFpsMonitorVisible} onchange={(v) => isFpsMonitorVisible.set(v)} />
</SettingRow>

<SettingRow title="Show video stats" description="Overlay video decoding statistics">
  <SettingToggle checked={$showVideoStats} onchange={(v) => showVideoStats.set(v)} />
</SettingRow>

<SettingRow
  title="MediaBunny (WebCodecs)"
  description="Use WebCodecs for video decoding (Chrome/Edge recommended)"
>
  <SettingToggle checked={$useWebCodecs} onchange={(v) => useWebCodecs.set(v)} />
</SettingRow>
