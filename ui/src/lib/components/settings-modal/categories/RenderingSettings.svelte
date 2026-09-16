<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingToggle from '../SettingToggle.svelte';
  import SettingDropdown from '../SettingDropdown.svelte';
  import { isFpsMonitorVisible } from '../../../../stores/ui.store';
  import { renderFpsCap, showCookStats, type FpsCap } from '../../../../stores/renderer.store';
  import { useWebCodecs, showVideoStats } from '../../../../stores/video.store';
  import { outputTarget, type OutputTarget } from '../../../../stores/canvas.store';

  const fpsCapOptions = [
    { value: '0', label: 'Unlimited' },
    { value: '30', label: '30 FPS' },
    { value: '60', label: '60 FPS' }
  ];

  const currentFpsCap = $derived(String($renderFpsCap));

  function handleFpsCapChange(value: string) {
    renderFpsCap.set(Number(value) as FpsCap);
  }

  const outputTargetOptions = [
    { value: 'background', label: 'Background' },
    { value: 'screen', label: 'Output Screen' }
  ];

  const handleOutputTargetChange = (value: string) => outputTarget.set(value as OutputTarget);
</script>

<SettingRow title="Render FPS cap" description="Limit the rendering frame rate">
  <SettingDropdown
    value={currentFpsCap}
    options={fpsCapOptions}
    onchange={handleFpsCapChange}
    label="Render FPS cap"
  />
</SettingRow>

<SettingRow title="Show FPS monitor" description="Display frames-per-second counter">
  <SettingToggle
    checked={$isFpsMonitorVisible}
    onchange={(v) => isFpsMonitorVisible.set(v)}
    label="Show FPS monitor"
  />
</SettingRow>

<SettingRow title="Show video stats" description="Overlay video decoding statistics">
  <SettingToggle
    checked={$showVideoStats}
    onchange={(v) => showVideoStats.set(v)}
    label="Show video stats"
  />
</SettingRow>

<SettingRow title="Show cook stats" description="Overlay render cook status on video previews">
  <SettingToggle
    checked={$showCookStats}
    onchange={(v) => showCookStats.set(v)}
    label="Show cook stats"
  />
</SettingRow>

<SettingRow
  title="MediaBunny (WebCodecs)"
  description="Use WebCodecs for video decoding (Chrome/Edge recommended)"
>
  <SettingToggle
    checked={$useWebCodecs}
    onchange={(v) => useWebCodecs.set(v)}
    label="Use MediaBunny WebCodecs"
  />
</SettingRow>

<SettingRow title="Output target" description="Where to send rendered output">
  <SettingDropdown
    value={$outputTarget}
    options={outputTargetOptions}
    onchange={handleOutputTargetChange}
    label="Output target"
  />
</SettingRow>
