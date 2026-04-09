<script lang="ts">
  import { RotateCcw, X } from '@lucide/svelte/icons';
  import SettingsSlider from '$lib/components/SettingsSlider.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { useNodeDataTracker } from '$lib/history';
  import type { SettingsField, SettingsSchema } from '$lib/settings/types';

  let {
    nodeId,
    schema,
    values,
    onValueChange,
    onRevertAll,
    onClose,
    settingsPrefix = 'settings'
  }: {
    nodeId: string;
    schema: SettingsSchema;
    values: Record<string, unknown>;
    onValueChange: (key: string, value: unknown) => void;
    onRevertAll: () => void;
    onClose: () => void;

    /** Prefix for undo/redo tracking keys. Defaults to 'settings' (e.g. 'settings.foo').
     *  Pass '' to track at the top level (e.g. 'foo'). */
    settingsPrefix?: string;
  } = $props();

  const tracker = useNodeDataTracker(nodeId);

  function trackingKey(key: string): string {
    return settingsPrefix ? `${settingsPrefix}.${key}` : key;
  }

  function getCurrentValue(field: SettingsField): unknown {
    const val = values[field.key];
    if (val !== undefined) return val;
    return 'default' in field ? field.default : undefined;
  }

  function hasDirtyValues(): boolean {
    return schema.some((field) => {
      if (!('default' in field) || field.default === undefined) return false;
      return getCurrentValue(field) !== field.default;
    });
  }

  const isDirty = $derived(hasDirtyValues());

  function handleDiscreteChange(field: SettingsField, newValue: unknown) {
    const oldValue = getCurrentValue(field);
    onValueChange(field.key, newValue);

    const persistence = field.persistence ?? 'node';
    if (persistence === 'node') {
      tracker.commit(trackingKey(field.key), oldValue, newValue);
    }
  }

  // For slider/string/number: track focus→blur for undo (node-persistence only)
  function normalizeOptions(
    options: { label: string; value: string; description?: string }[] | string[]
  ): { label: string; value: string; description?: string }[] {
    if (options.length === 0 || typeof options[0] !== 'string') {
      return options as { label: string; value: string; description?: string }[];
    }

    return (options as string[]).map((s) => ({ label: s, value: s }));
  }

  function makeTracker(field: SettingsField) {
    if ((field.persistence ?? 'node') !== 'node') {
      return { onFocus: () => {}, onBlur: () => {} };
    }

    return tracker.track(trackingKey(field.key), () => getCurrentValue(field));
  }

  // Sync reactive value to a number input only when it's not focused,
  // preventing the browser from resetting cursor position (iOS Safari bug).
  function syncNumberValue(input: HTMLInputElement, getValue: () => number) {
    $effect(() => {
      const v = getValue();

      if (document.activeElement !== input) {
        input.value = v != null ? String(v) : '';
      }
    });
  }
</script>

<!-- Close button bar -->
<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
  {#if isDirty}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          onclick={() => onRevertAll()}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
        >
          <RotateCcw class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Revert all to defaults</Tooltip.Content>
    </Tooltip.Root>
  {/if}
  <button
    onclick={onClose}
    class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
  >
    <X class="h-4 w-4" />
  </button>
</div>

<!-- Settings panel -->
<div class="nodrag w-48 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
  <div class="flex flex-col gap-3">
    {#each schema as field, index (index)}
      {#if field.type === 'slider'}
        {@const sliderTracker = makeTracker(field)}
        {@const rawValue = (getCurrentValue(field) as number) ?? field.min}

        {@const decimals =
          field.step != null && field.step < 1
            ? Math.max(0, Math.ceil(-Math.log10(field.step)))
            : 0}

        {@const displayValue = decimals > 0 ? rawValue.toFixed(decimals) : rawValue}

        <div>
          <div class="mb-1 flex items-start justify-between gap-2">
            {#if field.description}
              <Tooltip.Root>
                <Tooltip.Trigger>
                  <span class="cursor-default text-xs font-medium text-zinc-300">{field.label}</span
                  >
                </Tooltip.Trigger>
                <Tooltip.Content>{field.description}</Tooltip.Content>
              </Tooltip.Root>
            {:else}
              <span class="text-xs font-medium text-zinc-300">{field.label}</span>
            {/if}

            <span class="shrink-0 text-xs text-zinc-500 tabular-nums">{displayValue}</span>
          </div>

          <SettingsSlider
            min={field.min}
            max={field.max}
            step={field.step}
            value={rawValue}
            onchange={(v) => onValueChange(field.key, v)}
            onpointerdown={sliderTracker.onFocus}
            onpointerup={sliderTracker.onBlur}
          />
        </div>
      {:else if field.type === 'number'}
        {@const numTracker = makeTracker(field)}
        <div>
          {#if field.description}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <label
                  class="mb-1 block cursor-default text-xs font-medium text-zinc-300"
                  for="setting-{field.key}">{field.label}</label
                >
              </Tooltip.Trigger>

              <Tooltip.Content>{field.description}</Tooltip.Content>
            </Tooltip.Root>
          {:else}
            <label class="mb-1 block text-xs font-medium text-zinc-300" for="setting-{field.key}"
              >{field.label}</label
            >
          {/if}
          <input
            id="setting-{field.key}"
            type="number"
            use:syncNumberValue={() => getCurrentValue(field) as number}
            min={field.min}
            max={field.max}
            step={field.step}
            class="nodrag w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-500"
            onfocus={numTracker.onFocus}
            onblur={numTracker.onBlur}
            oninput={(e) => {
              const raw = (e.target as HTMLInputElement).value;
              if (raw === '' || raw === '-') return;

              const parsed = parseFloat(raw);
              if (Number.isFinite(parsed)) onValueChange(field.key, parsed);
            }}
          />
        </div>
      {:else if field.type === 'string'}
        {@const strTracker = makeTracker(field)}
        <div>
          {#if field.description}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <label
                  class="mb-1 block cursor-default text-xs font-medium text-zinc-300"
                  for="setting-{field.key}">{field.label}</label
                >
              </Tooltip.Trigger>

              <Tooltip.Content>{field.description}</Tooltip.Content>
            </Tooltip.Root>
          {:else}
            <label class="mb-1 block text-xs font-medium text-zinc-300" for="setting-{field.key}"
              >{field.label}</label
            >
          {/if}
          <input
            id="setting-{field.key}"
            type="text"
            value={(getCurrentValue(field) as string) ?? ''}
            placeholder={field.placeholder}
            class="nodrag w-full min-w-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300 outline-none focus:ring-1 focus:ring-zinc-500"
            onfocus={strTracker.onFocus}
            onblur={strTracker.onBlur}
            oninput={(e) => onValueChange(field.key, (e.target as HTMLInputElement).value)}
          />
        </div>
      {:else if field.type === 'boolean'}
        {@const checked = !!(getCurrentValue(field) ?? false)}

        <button
          class="flex cursor-pointer items-center gap-1.5 transition-colors"
          onclick={() => handleDiscreteChange(field, !getCurrentValue(field))}
        >
          <div
            class={[
              'h-3 w-3 shrink-0 rounded-sm border transition-colors',
              checked ? 'border-zinc-500 bg-zinc-500' : 'border-zinc-600'
            ]}
          ></div>

          {#if field.description}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <span class={['text-xs', checked ? 'text-zinc-400' : 'text-zinc-500']}
                  >{field.label}</span
                >
              </Tooltip.Trigger>
              <Tooltip.Content>{field.description}</Tooltip.Content>
            </Tooltip.Root>
          {:else}
            <span class={['text-xs', checked ? 'text-zinc-400' : 'text-zinc-500']}
              >{field.label}</span
            >
          {/if}
        </button>
      {:else if field.type === 'select'}
        <div>
          {#if field.description}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <label class="mb-2 block cursor-default text-xs font-medium text-zinc-300"
                  >{field.label}</label
                >
              </Tooltip.Trigger>
              <Tooltip.Content>{field.description}</Tooltip.Content>
            </Tooltip.Root>
          {:else}
            <label class="mb-2 block text-xs font-medium text-zinc-300">{field.label}</label>
          {/if}

          <div class="flex flex-wrap gap-1">
            {#each normalizeOptions(field.options) as option, index (index)}
              {@const isSelected = getCurrentValue(field) === option.value}

              {#if option.description}
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      onclick={() => handleDiscreteChange(field, option.value)}
                      class={[
                        'cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                        isSelected
                          ? 'bg-zinc-600 text-white'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      ]}
                    >
                      {option.label}
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{option.description}</Tooltip.Content>
                </Tooltip.Root>
              {:else}
                <button
                  onclick={() => handleDiscreteChange(field, option.value)}
                  class={[
                    'cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                    isSelected
                      ? 'bg-zinc-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  ]}
                >
                  {option.label}
                </button>
              {/if}
            {/each}
          </div>
        </div>
      {:else if field.type === 'color'}
        <div>
          {#if field.description}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <label class="mb-2 block cursor-default text-xs font-medium text-zinc-300"
                  >{field.label}</label
                >
              </Tooltip.Trigger>
              <Tooltip.Content>{field.description}</Tooltip.Content>
            </Tooltip.Root>
          {:else}
            <label class="mb-2 block text-xs font-medium text-zinc-300">{field.label}</label>
          {/if}

          {#if field.presets && field.presets.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each field.presets as preset, index (index)}
                {@const isSelected = getCurrentValue(field) === preset}

                <button
                  onclick={() => handleDiscreteChange(field, preset)}
                  class={[
                    'h-6 w-6 cursor-pointer rounded-full border-2 transition-all',
                    isSelected
                      ? 'scale-110 border-white shadow-md'
                      : 'border-transparent hover:scale-105 hover:border-zinc-400'
                  ]}
                  style="background-color: {preset};"
                  aria-label={preset}
                ></button>
              {/each}
            </div>
          {:else}
            <!-- Native color picker fallback -->
            {@const colorTracker = makeTracker(field)}

            <label class="flex cursor-pointer items-center gap-2">
              <span
                class="h-6 w-6 rounded border border-zinc-600"
                style="background-color: {(getCurrentValue(field) as string) ?? '#ffffff'};"
              ></span>

              <input
                type="color"
                value={(getCurrentValue(field) as string) ?? '#ffffff'}
                class="sr-only"
                onfocus={colorTracker.onFocus}
                oninput={(e) => onValueChange(field.key, (e.target as HTMLInputElement).value)}
                onchange={colorTracker.onBlur}
              />

              <span class="text-xs text-zinc-400">{(getCurrentValue(field) as string) ?? ''}</span>
            </label>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</div>
