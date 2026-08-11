<script lang="ts">
  let {
    value = $bindable(''),
    options,
    onchange,
    label = 'Choose setting'
  }: {
    value?: string;
    options: { value: string; label: string }[];
    onchange?: (value: string) => void;
    label?: string;
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
  aria-label={label}
  class="h-9 cursor-pointer rounded-md border border-white/10 bg-white/[0.035] px-3 font-mono text-[11px] text-zinc-300 transition-colors outline-none hover:border-white/20 focus-visible:border-orange-500/60 focus-visible:ring-2 focus-visible:ring-orange-500/15"
>
  {#each options as opt (opt.value)}
    <option value={opt.value} class="bg-zinc-900">{opt.label}</option>
  {/each}
</select>
