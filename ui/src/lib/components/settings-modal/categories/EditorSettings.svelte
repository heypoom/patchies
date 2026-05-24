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
  import {
    editorAutocompleteEnabled,
    editorFontFamily,
    editorFontSize,
    editorFullscreenFontSize,
    editorHoverHintsEnabled,
    setEditorFontFamily,
    setEditorFontSize,
    setEditorFullscreenFontSize,
    setEditorAutocompleteEnabled,
    setEditorHoverHintsEnabled,
    useVimInEditor
  } from '../../../../stores/editor.store';

  import { setVimMode } from '$lib/utils/settings-actions';

  const editorLayoutOptions: { value: EditorLayoutPreference; label: string }[] = [
    { value: 'inline', label: 'Inline' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'sidebar', label: 'Sidebar' }
  ];

  let overlayTransparencyPercent = $derived(Math.round($overlayEditorTransparency * 100));

  function handleLayoutChange(value: string) {
    if (value === 'inline' || value === 'overlay' || value === 'sidebar') {
      setDefaultEditorLayout(value);
    }
  }

  function handleTransparencyInput(event: Event) {
    const target = event.target as HTMLInputElement;

    setOverlayEditorTransparency(Number(target.value) / 100);
  }

  function handleFontFamilyInput(event: Event) {
    const target = event.target as HTMLInputElement;

    setEditorFontFamily(target.value);
  }

  function handleFontSizeInput(event: Event) {
    const target = event.target as HTMLInputElement;

    setEditorFontSize(Number(target.value));
  }

  function handleFullscreenFontSizeInput(event: Event) {
    const target = event.target as HTMLInputElement;

    setEditorFullscreenFontSize(Number(target.value));
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
      class="h-1.5 w-28 cursor-pointer accent-zinc-500"
      aria-label="Overlay editor transparency"
    />
    <span class="w-9 text-right font-mono text-xs text-zinc-400">{overlayTransparencyPercent}%</span
    >
  </div>
</SettingRow>

<SettingRow title="Font family" description="Choose the typeface used by code editors.">
  <input
    type="text"
    value={$editorFontFamily}
    oninput={handleFontFamilyInput}
    class="w-60 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors outline-none hover:border-white/20 focus:border-orange-500/40"
    aria-label="Editor font family"
    spellcheck="false"
  />
</SettingRow>

<SettingRow title="Font size" description="Set the inline and sidebar editor text size.">
  <div class="flex items-center gap-3">
    <input
      type="range"
      min="10"
      max="24"
      step="1"
      value={$editorFontSize}
      oninput={handleFontSizeInput}
      class="h-1.5 w-28 cursor-pointer accent-zinc-500"
      aria-label="Editor font size"
    />
    <span class="w-11 text-right font-mono text-xs text-zinc-400">{$editorFontSize}px</span>
  </div>
</SettingRow>

<SettingRow
  title="Fullscreen font size"
  description="Set the expanded overlay editor text size separately."
>
  <div class="flex items-center gap-3">
    <input
      type="range"
      min="14"
      max="48"
      step="1"
      value={$editorFullscreenFontSize}
      oninput={handleFullscreenFontSizeInput}
      class="h-1.5 w-28 cursor-pointer accent-zinc-500"
      aria-label="Fullscreen editor font size"
    />
    <span class="w-11 text-right font-mono text-xs text-zinc-400"
      >{$editorFullscreenFontSize}px</span
    >
  </div>
</SettingRow>

<SettingRow title="Autocomplete" description="Show code completions while typing in code editors.">
  <SettingToggle checked={$editorAutocompleteEnabled} onchange={setEditorAutocompleteEnabled} />
</SettingRow>

<SettingRow title="Hover hints" description="Show function and value hints when hovering code.">
  <SettingToggle checked={$editorHoverHintsEnabled} onchange={setEditorHoverHintsEnabled} />
</SettingRow>

<SettingRow title="Vim mode" description="Enable Vim keybindings in code editors (requires reload)">
  <SettingToggle checked={$useVimInEditor} onchange={setVimMode} />
</SettingRow>
