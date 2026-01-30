<script lang="ts">
  import { onMount } from 'svelte';

  let {
    value,
    onchange = undefined
  }: {
    value: string;
    onchange?: (value: string) => void;
  } = $props();

  let presets = $state<{ label: string; value: string }[]>([]);

  onMount(async () => {
    // @ts-expect-error -- no typedefs
    const butterchurnPresets = (await import('butterchurn-presets')).default;
    const _presets = butterchurnPresets.getPresets();
    const presetKeys = Object.keys(_presets);

    presets = presetKeys.map((key) => ({
      label: key.length > 30 ? `${key.slice(0, 30)}..` : key,
      value: key
    }));
  });
</script>

<select {value} onchange={(e) => onchange?.(e.currentTarget.value)}>
  {#each presets as preset (preset.value)}
    <option value={preset.value} selected={preset.value === value}>
      {preset.label}
    </option>
  {/each}
</select>
