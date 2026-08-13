<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import * as Drawer from '$lib/components/ui/drawer';
  import { isMobile } from '../../../stores/ui.store';
  import '@spectrum-web-components/color-area/sp-color-area.js';
  import '@spectrum-web-components/color-field/sp-color-field.js';
  import '@spectrum-web-components/color-slider/sp-color-slider.js';
  import '@spectrum-web-components/theme/sp-theme.js';
  import '@spectrum-web-components/theme/theme-dark.js';
  import '@spectrum-web-components/theme/scale-medium.js';

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

  let open = $state(false);
  type SpectrumColorControl = HTMLElement & { color: string; value: string; valid?: boolean };

  function handleColorInput(event: Event) {
    const control = event.currentTarget as SpectrumColorControl;
    if (control.valid === false) return;
    onInput(control.color || control.value);
  }

  function handleColorChange(event: Event) {
    const control = event.currentTarget as SpectrumColorControl;
    if (control.valid === false) return;
    onChange?.(control.color || control.value);
  }

  function handleOpenChange(nextOpen: boolean) {
    open = nextOpen;
    if (open) {
      onOpen?.();
    }
  }

  function handleMobileOpen() {
    onOpen?.();
    open = true;
  }
</script>

{#snippet pickerContent(mobile = false)}
  <sp-theme color="dark" scale="medium" class="block">
    <div class={mobile ? 'space-y-5' : 'space-y-3'}>
      {#if mobile}
        <div class="flex items-center justify-between">
          <Drawer.Title class="text-sm font-medium text-zinc-100">{ariaLabel}</Drawer.Title>
          <span class="font-mono text-xs text-zinc-400">{value}</span>
        </div>
      {/if}
      <sp-color-area
        color={value}
        label-x="Saturation"
        label-y="Brightness"
        data-vaul-no-drag
        class={['block w-full', mobile ? 'h-64' : 'h-32']}
        oninput={handleColorInput}
        onchange={handleColorChange}
      ></sp-color-area>

      <sp-color-slider
        color={value}
        label="Hue"
        data-vaul-no-drag
        class={['block w-full', mobile ? 'h-11' : 'h-6']}
        oninput={handleColorInput}
        onchange={handleColorChange}
      ></sp-color-slider>

      <sp-color-field
        {value}
        view-color
        aria-label="Hex color"
        class={['block w-full', mobile ? 'text-base' : 'text-xs']}
        oninput={handleColorInput}
        onchange={handleColorChange}
      ></sp-color-field>
    </div>
  </sp-theme>
{/snippet}

{#if $isMobile}
  <Drawer.Root bind:open>
    <button type="button" class={className} onclick={handleMobileOpen} aria-label={ariaLabel}>
      <span class={swatchClass} style:background-color={value}></span>

      {#if showValue}
        <span class={valueClass}>{value}</span>
      {/if}
    </button>

    <Drawer.Content
      class="max-h-[calc(100dvh-1rem)] border-zinc-700 bg-zinc-900 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <Drawer.Header class="px-0 pt-2 pb-5">
        {@render pickerContent(true)}
      </Drawer.Header>
    </Drawer.Content>
  </Drawer.Root>
{:else}
  <Popover.Root {open} onOpenChange={handleOpenChange}>
    <Popover.Trigger class={className} aria-label={ariaLabel}>
      <span class={swatchClass} style:background-color={value}></span>

      {#if showValue}
        <span class={valueClass}>{value}</span>
      {/if}
    </Popover.Trigger>

    <Popover.Content class="w-56 border-zinc-700 bg-zinc-900 p-3" align="start" sideOffset={6}>
      {@render pickerContent()}
    </Popover.Content>
  </Popover.Root>
{/if}

<style>
  :global(sp-color-field) {
    --mod-textfield-focus-indicator-width: 0;
    --mod-textfield-focus-indicator-gap: 0;
  }
</style>
