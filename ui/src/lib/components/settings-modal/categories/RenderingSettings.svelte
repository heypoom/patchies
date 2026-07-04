<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingToggle from '../SettingToggle.svelte';
  import SettingDropdown from '../SettingDropdown.svelte';
  import NativeColorPicker from '$lib/components/settings/NativeColorPicker.svelte';
  import { isFpsMonitorVisible } from '../../../../stores/ui.store';
  import {
    previewBackgroundColor,
    renderFpsCap,
    showCookStats,
    type FpsCap
  } from '../../../../stores/renderer.store';
  import { useWebCodecs, showVideoStats } from '../../../../stores/video.store';
  import { outputTarget, type OutputTarget } from '../../../../stores/canvas.store';
  import {
    DEFAULT_PREVIEW_BACKGROUND_COLOR,
    type PreviewBackgroundColor
  } from '$lib/rendering/preview-background';
  import { match } from 'ts-pattern';

  const fpsCapOptions = [
    { value: '0', label: 'Unlimited' },
    { value: '30', label: '30 FPS' },
    { value: '60', label: '60 FPS' }
  ];

  const currentFpsCap = $derived(String($renderFpsCap));

  function handleFpsCapChange(value: string) {
    renderFpsCap.set(Number(value) as FpsCap);
  }

  const previewBackgroundModeOptions = [
    { value: 'transparent', label: 'Transparent' },
    { value: 'color', label: 'Color' }
  ];

  const previewBackgroundMode = $derived(
    match($previewBackgroundColor)
      .with('transparent', () => 'transparent')
      .otherwise(() => 'color')
  );

  function getCustomPreviewBackgroundColor(color: PreviewBackgroundColor): `#${string}` {
    return match(color)
      .with('transparent', () => DEFAULT_PREVIEW_BACKGROUND_COLOR as `#${string}`)
      .otherwise((hex) => hex as `#${string}`);
  }

  let customPreviewBackgroundColor = $state<`#${string}`>(
    getCustomPreviewBackgroundColor($previewBackgroundColor)
  );

  $effect(() => {
    match($previewBackgroundColor)
      .with('transparent', () => {})
      .otherwise((color) => {
        customPreviewBackgroundColor = color as `#${string}`;
      });
  });

  function handlePreviewBackgroundModeChange(value: string) {
    match(value)
      .with('transparent', () => previewBackgroundColor.set('transparent'))
      .otherwise(() => previewBackgroundColor.set(customPreviewBackgroundColor));
  }

  function handlePreviewBackgroundColorInput(value: string) {
    const color = value as `#${string}`;

    customPreviewBackgroundColor = color;
    previewBackgroundColor.set(color);
  }

  const outputTargetOptions = [
    { value: 'background', label: 'Background' },
    { value: 'screen', label: 'Output Screen' }
  ];

  const handleOutputTargetChange = (value: string) => outputTarget.set(value as OutputTarget);
</script>

<SettingRow title="Render FPS cap" description="Limit the rendering frame rate">
  <SettingDropdown value={currentFpsCap} options={fpsCapOptions} onchange={handleFpsCapChange} />
</SettingRow>

<SettingRow title="Preview background" description="Composite node previews over a color">
  <div class="flex items-center gap-2">
    <SettingDropdown
      value={previewBackgroundMode}
      options={previewBackgroundModeOptions}
      onchange={handlePreviewBackgroundModeChange}
    />

    {#if previewBackgroundMode === 'color'}
      <NativeColorPicker
        value={customPreviewBackgroundColor}
        class="h-7 w-9 cursor-pointer rounded border border-white/10 bg-white/5 p-0.5"
        swatchClass="block h-full w-full rounded-sm"
        ariaLabel="Preview background color"
        onInput={handlePreviewBackgroundColorInput}
      />
    {/if}
  </div>
</SettingRow>

<SettingRow title="Show FPS monitor" description="Display frames-per-second counter">
  <SettingToggle checked={$isFpsMonitorVisible} onchange={(v) => isFpsMonitorVisible.set(v)} />
</SettingRow>

<SettingRow title="Show video stats" description="Overlay video decoding statistics">
  <SettingToggle checked={$showVideoStats} onchange={(v) => showVideoStats.set(v)} />
</SettingRow>

<SettingRow title="Show cook stats" description="Overlay render cook status on video previews">
  <SettingToggle checked={$showCookStats} onchange={(v) => showCookStats.set(v)} />
</SettingRow>

<SettingRow
  title="MediaBunny (WebCodecs)"
  description="Use WebCodecs for video decoding (Chrome/Edge recommended)"
>
  <SettingToggle checked={$useWebCodecs} onchange={(v) => useWebCodecs.set(v)} />
</SettingRow>

<SettingRow title="Output target" description="Where to send rendered output">
  <SettingDropdown
    value={$outputTarget}
    options={outputTargetOptions}
    onchange={handleOutputTargetChange}
  />
</SettingRow>
