<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingToggle from '../SettingToggle.svelte';
  import { isCablesVisible } from '../../../../stores/ui.store';
  import { outputSize } from '../../../../stores/renderer.store';
  import { applyOutputSize } from '$lib/utils/settings-actions';

  const currentOutputSize = $derived(`${$outputSize[0]}x${$outputSize[1]}`);
  let outputSizeInput = $state('');
  let isEditingOutputSize = $state(false);

  function startEditingOutputSize() {
    outputSizeInput = currentOutputSize;
    isEditingOutputSize = true;
  }

  function handleApplyOutputSize() {
    isEditingOutputSize = false;
    const input = outputSizeInput.trim();
    if (!input || input === currentOutputSize) return;
    applyOutputSize(input);
  }
</script>

<SettingRow title="Show cables" description="Toggle connection cable visibility">
  <SettingToggle checked={$isCablesVisible} onchange={(v) => isCablesVisible.set(v)} />
</SettingRow>

<SettingRow
  title="Output size"
  description="Render resolution (e.g. 1920x1080, screen, retina, 2x, 4k, or 'clear')"
>
  {#if isEditingOutputSize}
    <input
      type="text"
      bind:value={outputSizeInput}
      onblur={handleApplyOutputSize}
      onkeydown={(e) => {
        if (e.key === 'Enter') handleApplyOutputSize();
        if (e.key === 'Escape') isEditingOutputSize = false;
      }}
      placeholder="1920x1080"
      class="w-32 rounded border border-orange-500/40 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 outline-none"
    />
  {:else}
    <button
      onclick={startEditingOutputSize}
      class="cursor-pointer rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors hover:border-white/20"
    >
      {currentOutputSize}
    </button>
  {/if}
</SettingRow>
