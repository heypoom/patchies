<script lang="ts">
  let {
    checked = $bindable(false),
    onchange
  }: {
    checked?: boolean;
    onchange?: (value: boolean) => void;
  } = $props();

  function handleClick() {
    checked = !checked;
    onchange?.(checked);
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label="Toggle"
  onclick={handleClick}
  class={[
    'relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full border-none transition-colors duration-200',
    checked ? 'bg-orange-500' : 'bg-zinc-700'
  ]}
>
  <span
    class={[
      'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200',
      checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
    ]}
  ></span>
</button>
