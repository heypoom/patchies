<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingToggle from '../SettingToggle.svelte';
  import { isBottomBarVisible } from '../../../../stores/ui.store';

  let showStartupModal = $state(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('patchies-show-startup-modal') !== 'false'
      : true
  );

  function handleStartupModalChange(value: boolean) {
    localStorage.setItem('patchies-show-startup-modal', String(value));
  }
</script>

<SettingRow title="Show startup modal" description="Show the welcome modal when opening Patchies">
  <SettingToggle bind:checked={showStartupModal} onchange={handleStartupModalChange} />
</SettingRow>

<SettingRow title="Show bottom bar" description="Toggle the bottom toolbar visibility">
  <SettingToggle checked={$isBottomBarVisible} onchange={(v) => isBottomBarVisible.set(v)} />
</SettingRow>
