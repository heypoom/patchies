<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingToggle from '../SettingToggle.svelte';
  import { useVimInEditor } from '../../../../stores/editor.store';
  import { setVimMode } from '$lib/utils/settings-actions';
</script>

<SettingRow title="Vim mode" description="Enable Vim keybindings in code editors (requires reload)">
  <SettingToggle checked={$useVimInEditor} onchange={setVimMode} />
</SettingRow>
