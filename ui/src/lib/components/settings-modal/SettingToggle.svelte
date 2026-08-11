<script lang="ts">
  let {
    checked = false,
    onchange,
    label = 'Toggle setting'
  }: {
    checked?: boolean;
    onchange?: (value: boolean) => void;
    label?: string;
  } = $props();

  function handleClick() {
    onchange?.(!checked);
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  onclick={handleClick}
  class={[
    'relative inline-flex h-6 w-10 cursor-pointer items-center rounded-full border transition-colors duration-200 outline-none focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-500/20',
    checked ? 'border-orange-500/70 bg-orange-500' : 'border-white/10 bg-zinc-700'
  ]}
>
  <span
    class={[
      'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
      checked ? 'translate-x-[19px]' : 'translate-x-[3px]'
    ]}
  ></span>
</button>
