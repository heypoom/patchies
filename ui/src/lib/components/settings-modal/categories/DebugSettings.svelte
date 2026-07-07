<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingToggle from '../SettingToggle.svelte';
  import { cullObjects, setCullObjects } from '../../../../stores/debug.store';
</script>

<SettingRow
  title="Cull objects"
  description="Only render viewport-visible objects to verify headless behavior."
>
  <SettingToggle checked={$cullObjects} onchange={setCullObjects} />
</SettingRow>
