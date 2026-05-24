<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingDropdown from '../SettingDropdown.svelte';
  import SettingToggle from '../SettingToggle.svelte';
  import {
    defaultEditorLayout,
    overlayEditorTransparency,
    setDefaultEditorLayout,
    setOverlayEditorTransparency,
    type EditorLayoutPreference
  } from '../../../../stores/editor-layout-settings.store';
  import { useVimInEditor } from '../../../../stores/editor.store';
  import { setVimMode } from '$lib/utils/settings-actions';

  const editorLayoutOptions: { value: EditorLayoutPreference; label: string }[] = [
    { value: 'inline', label: 'Inline' },
    { value: 'overlay', label: 'Overlay' }
  ];

  let overlayTransparencyPercent = $derived(Math.round($overlayEditorTransparency * 100));

  function handleLayoutChange(value: string) {
    if (value === 'inline' || value === 'overlay') {
      setDefaultEditorLayout(value);
    }
  }

  function handleTransparencyInput(event: Event) {
    const target = event.target as HTMLInputElement;
    setOverlayEditorTransparency(Number(target.value) / 100);
  }
</script>

<SettingRow
  title="Default editor layout"
  description="Choose how visual code objects open their editor."
>
  <SettingDropdown
    value={$defaultEditorLayout}
    options={editorLayoutOptions}
    onchange={handleLayoutChange}
  />
</SettingRow>

<SettingRow
  title="Overlay transparency"
  description="Adjust the Zen editor panel background opacity."
>
  <div class="flex items-center gap-3">
    <input
      type="range"
      min="0"
      max="100"
      step="5"
      value={overlayTransparencyPercent}
      oninput={handleTransparencyInput}
      class="h-1.5 w-28 cursor-pointer accent-orange-500"
      aria-label="Overlay editor transparency"
    />
    <span class="w-9 text-right font-mono text-xs text-zinc-400">{overlayTransparencyPercent}%</span
    >
  </div>
</SettingRow>

<SettingRow title="Vim mode" description="Enable Vim keybindings in code editors (requires reload)">
  <SettingToggle checked={$useVimInEditor} onchange={setVimMode} />
</SettingRow>
