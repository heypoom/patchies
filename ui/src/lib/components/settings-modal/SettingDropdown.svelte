<script lang="ts">
  let {
    value = $bindable(''),
    options,
    onchange
  }: {
    value?: string;
    options: { value: string; label: string }[];
    onchange?: (value: string) => void;
  } = $props();

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    value = target.value;
    onchange?.(value);
  }
</script>

<select
  {value}
  onchange={handleChange}
  class="cursor-pointer rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors outline-none hover:border-white/20 focus:border-orange-500/40"
>
  {#each options as opt (opt.value)}
    <option value={opt.value} class="bg-zinc-900">{opt.label}</option>
  {/each}
</select>
