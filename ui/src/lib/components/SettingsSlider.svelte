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

  const percent = $derived.by(() => {
    const range = max - min;
    if (range <= 0) return 0;

    return Math.min(100, Math.max(0, ((value - min) / range) * 100));
  });
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
