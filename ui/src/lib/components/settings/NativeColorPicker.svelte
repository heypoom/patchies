<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    dismissActiveNativeColorPicker,
    openNativeColorPicker,
    type NativeColorPickerSession
  } from './native-color-picker';

  let {
    value,
    ariaLabel,
    class: className = 'inline-flex cursor-pointer items-center gap-2',
    swatchClass = 'h-6 w-6 rounded border border-zinc-600',
    valueClass = 'text-xs text-zinc-400',
    showValue = false,
    onOpen = undefined,
    onInput,
    onChange = undefined
  }: {
    value: string;
    ariaLabel: string;
    class?: string;
    swatchClass?: string;
    valueClass?: string;
    showValue?: boolean;
    onOpen?: () => void;
    onInput: (value: string) => void;
    onChange?: (value: string) => void;
  } = $props();

  let activeSession: NativeColorPickerSession | null = null;

  function handleOpen() {
    onOpen?.();

    activeSession = openNativeColorPicker({
      value,
      onInput,
      onChange
    });
  }

  onDestroy(() => {
    dismissActiveNativeColorPicker(activeSession);
  });
</script>

<button type="button" class={className} onclick={handleOpen} aria-label={ariaLabel}>
  <span class={swatchClass} style:background-color={value}></span>

  {#if showValue}
    <span class={valueClass}>{value}</span>
  {/if}
</button>
