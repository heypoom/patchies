<script lang="ts">
  type Props = {
    min: number;
    max: number;
    step?: number;
    value: number;
    onchange?: (value: number) => void;
    onpointerdown?: (e: PointerEvent) => void;
    onpointerup?: (e: PointerEvent) => void;
    class?: string;
  };

  let {
    min,
    max,
    step = 1,
    value,
    onchange,
    onpointerdown,
    onpointerup,
    class: className = ''
  }: Props = $props();

  const percent = $derived(((value - min) / (max - min)) * 100);
</script>

<input
  type="range"
  {min}
  {max}
  {step}
  {value}
  oninput={(e) => onchange?.(parseFloat((e.target as HTMLInputElement).value))}
  {onpointerdown}
  {onpointerup}
  class={['settings-slider w-full', className]}
  style:--value-percent="{percent}%"
/>
