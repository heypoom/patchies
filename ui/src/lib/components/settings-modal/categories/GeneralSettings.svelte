<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingToggle from '../SettingToggle.svelte';
  import { isBottomBarVisible } from '../../../../stores/ui.store';
  import { showStartupModalOnLoad } from '../../../../stores/startup-modal.store';
</script>

<SettingRow title="Show startup modal" description="Show the welcome modal when opening Patchies">
  <SettingToggle
    checked={$showStartupModalOnLoad}
    onchange={(v) => showStartupModalOnLoad.set(v)}
  />
</SettingRow>

<SettingRow title="Show bottom bar" description="Toggle the bottom toolbar visibility">
  <SettingToggle checked={$isBottomBarVisible} onchange={(v) => isBottomBarVisible.set(v)} />
</SettingRow>
