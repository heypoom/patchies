<script lang="ts">
  import { Check, ChevronsUpDown, RotateCcw, X } from '@lucide/svelte/icons';
  import SettingsSlider from '$lib/components/SettingsSlider.svelte';
  import NativeColorPicker from '$lib/components/settings/NativeColorPicker.svelte';
  import * as Command from '$lib/components/ui/command';
  import * as Popover from '$lib/components/ui/popover';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { useNodeDataTracker } from '$lib/history';
  import type { SettingsField, SettingsSchema } from '$lib/settings/types';
  import { filterSettingsOptions, normalizeSettingsOptions } from '$lib/settings/options';
  import { dismissActiveNativeColorPicker } from './native-color-picker';

  let {
    nodeId,
    schema,
    values,
    onValueChange,
    onRevertAll,
    onClose,
    settingsPrefix = 'settings',
    showCloseButton = true,
    showRevertButton = true
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
    showCloseButton?: boolean;
    showRevertButton?: boolean;
  } = $props();

  const createComboboxOpenState = (schema: SettingsSchema): Record<string, boolean> =>
    Object.fromEntries(
      schema.filter((field) => field.type === 'combobox').map((field) => [field.key, false])
    );

  const createComboboxQueryState = (schema: SettingsSchema): Record<string, string> =>
    Object.fromEntries(
      schema.filter((field) => field.type === 'combobox').map((field) => [field.key, ''])
    );

  const VECTOR_AXES = ['x', 'y'] as const;

  const tracker = useNodeDataTracker(nodeId);
  const comboboxOpen = $state(createComboboxOpenState(schema));
  const comboboxQuery = $state(createComboboxQueryState(schema));

  function trackingKey(key: string): string {
    return settingsPrefix ? `${settingsPrefix}.${key}` : key;
  }

  function getCurrentValue(field: SettingsField): unknown {
    const value = values[field.key];
    if (value !== undefined) return value;

    return 'default' in field ? field.default : undefined;
  }

  function hasDirtyValues(): boolean {
    return schema.some((field) => {
      if (!('default' in field) || field.default === undefined) return false;

      return !settingsValueEquals(getCurrentValue(field), field.default);
    });
  }

  const isDirty = $derived(hasDirtyValues());

  function settingsValueEquals(left: unknown, right: unknown): boolean {
    if (Array.isArray(left) && Array.isArray(right)) {
      return (
        left.length === right.length &&
        left.every((value, index) => settingsValueEquals(value, right[index]))
      );
    }

    return left === right;
  }

  function handleDiscreteChange(field: SettingsField, newValue: unknown) {
    const oldValue = getCurrentValue(field);
    onValueChange(field.key, newValue);

    const persistence = field.persistence ?? 'node';
    if (persistence === 'node') {
      tracker.commit(trackingKey(field.key), oldValue, newValue);
    }
  }

  function handleClose() {
    dismissActiveNativeColorPicker();
    onClose();
  }

  function makeTracker(field: SettingsField) {
    if ((field.persistence ?? 'node') !== 'node') {
      return { onFocus: () => {}, onBlur: () => {} };
    }

    return tracker.track(trackingKey(field.key), () => getCurrentValue(field));
  }

  function toVec2(value: unknown, fallback: [number, number] = [0, 0]): [number, number] {
    if (Array.isArray(value)) {
      const x = typeof value[0] === 'number' ? value[0] : fallback[0];
      const y = typeof value[1] === 'number' ? value[1] : fallback[1];

      return [x, y];
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const x = typeof record.x === 'number' ? record.x : fallback[0];
      const y = typeof record.y === 'number' ? record.y : fallback[1];

      return [x, y];
    }

    return fallback;
  }

  function handleVec2Input(field: SettingsField, axis: number, raw: string) {
    if (raw === '' || raw === '-') return;

    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed)) return;

    const next = toVec2(getCurrentValue(field));
    next[axis] = parsed;
    onValueChange(field.key, next);
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

  function getSelectedOptionLabel(field: Extract<SettingsField, { type: 'combobox' }>): string {
    const value = getCurrentValue(field);
    const selected = normalizeSettingsOptions(field.options).find(
      (option) => option.value === value
    );

    if (selected) return selected.label;
    if (typeof value === 'string' && value !== '') return value;
    return field.placeholder ?? 'Select...';
  }

  function selectComboboxOption(
    field: Extract<SettingsField, { type: 'combobox' }>,
    value: string
  ) {
    handleDiscreteChange(field, value);
    comboboxOpen[field.key] = false;
    comboboxQuery[field.key] = '';
  }
</script>

<!-- Close button bar -->
{#if showCloseButton || (showRevertButton && isDirty)}
  <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
    {#if showRevertButton && isDirty}
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
    {#if showCloseButton}
      <button
        onclick={handleClose}
        class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
      >
        <X class="h-4 w-4" />
      </button>
    {/if}
  </div>
{/if}

<!-- Settings panel -->
<div class="nodrag w-48 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
  <div class="flex flex-col gap-3">
    {#each schema as field (field.key)}
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
                <span class="mb-2 block cursor-default text-xs font-medium text-zinc-300"
                  >{field.label}</span
                >
              </Tooltip.Trigger>
              <Tooltip.Content>{field.description}</Tooltip.Content>
            </Tooltip.Root>
          {:else}
            <span class="mb-2 block text-xs font-medium text-zinc-300">{field.label}</span>
          {/if}

          <div class="flex flex-wrap gap-1">
            {#each normalizeSettingsOptions(field.options) as option, index (index)}
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
      {:else if field.type === 'combobox'}
        {@const comboboxOptions = normalizeSettingsOptions(field.options)}
        {@const filteredOptions = filterSettingsOptions(
          comboboxOptions,
          comboboxQuery[field.key] ?? '',
          field.maxVisibleOptions ?? 80
        )}
        <div>
          {#if field.description}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <span class="mb-1 block cursor-default text-xs font-medium text-zinc-300"
                  >{field.label}</span
                >
              </Tooltip.Trigger>
              <Tooltip.Content>{field.description}</Tooltip.Content>
            </Tooltip.Root>
          {:else}
            <span class="mb-1 block text-xs font-medium text-zinc-300">{field.label}</span>
          {/if}

          <Popover.Root bind:open={comboboxOpen[field.key]}>
            <Popover.Trigger
              class="flex w-full cursor-pointer items-center justify-between gap-2 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-left font-mono text-xs text-zinc-200 hover:bg-zinc-700"
            >
              <span class="min-w-0 truncate">{getSelectedOptionLabel(field)}</span>
              <ChevronsUpDown class="h-3 w-3 shrink-0 text-zinc-500" />
            </Popover.Trigger>

            <Popover.Content class="w-72 p-0" align="start" sideOffset={6}>
              <Command.Root shouldFilter={false}>
                <Command.Input
                  placeholder={field.searchPlaceholder ?? `Search ${field.label.toLowerCase()}...`}
                  bind:value={comboboxQuery[field.key]}
                />
                <Command.List class="max-h-64">
                  <Command.Empty>{field.emptyMessage ?? 'No options found.'}</Command.Empty>
                  <Command.Group>
                    {#each filteredOptions as option (option.value)}
                      {@const isSelected = getCurrentValue(field) === option.value}
                      <Command.Item
                        value={`${option.label} ${option.value}`}
                        onSelect={() => selectComboboxOption(field, option.value)}
                        class="cursor-pointer"
                      >
                        <Check class={['h-3 w-3', isSelected ? 'opacity-100' : 'opacity-0']} />
                        <div class="min-w-0">
                          <div class="truncate font-mono text-xs">{option.label}</div>
                          {#if option.description}
                            <div class="truncate text-[10px] text-zinc-500">
                              {option.description}
                            </div>
                          {/if}
                        </div>
                      </Command.Item>
                    {/each}
                  </Command.Group>
                </Command.List>
              </Command.Root>
            </Popover.Content>
          </Popover.Root>
        </div>
      {:else if field.type === 'color'}
        <div>
          {#if field.description}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <span class="mb-2 block cursor-default text-xs font-medium text-zinc-300"
                  >{field.label}</span
                >
              </Tooltip.Trigger>
              <Tooltip.Content>{field.description}</Tooltip.Content>
            </Tooltip.Root>
          {:else}
            <span class="mb-2 block text-xs font-medium text-zinc-300">{field.label}</span>
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

            {@const currentColor = (getCurrentValue(field) as string) ?? '#ffffff'}

            <NativeColorPicker
              value={currentColor}
              ariaLabel={field.label}
              showValue
              onOpen={colorTracker.onFocus}
              onInput={(value) => onValueChange(field.key, value)}
              onChange={() => colorTracker.onBlur()}
            />
          {/if}
        </div>
      {:else if field.type === 'vec2'}
        {@const vecTracker = makeTracker(field)}
        {@const currentVec = toVec2(getCurrentValue(field), field.default ?? [0, 0])}
        {@const minVec = toVec2(field.min, [-Infinity, -Infinity])}
        {@const maxVec = toVec2(field.max, [Infinity, Infinity])}

        <div>
          {#if field.description}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <span class="mb-1 block cursor-default text-xs font-medium text-zinc-300"
                  >{field.label}</span
                >
              </Tooltip.Trigger>
              <Tooltip.Content>{field.description}</Tooltip.Content>
            </Tooltip.Root>
          {:else}
            <span class="mb-1 block text-xs font-medium text-zinc-300">{field.label}</span>
          {/if}

          <div class="grid grid-cols-2 gap-2">
            {#each VECTOR_AXES as axisLabel, axis (axisLabel)}
              <label class="min-w-0">
                <span class="mb-1 block text-[10px] font-medium text-zinc-500 uppercase"
                  >{axisLabel}</span
                >
                <input
                  id="setting-{field.key}-{axisLabel}"
                  type="number"
                  use:syncNumberValue={() => currentVec[axis]}
                  min={Number.isFinite(minVec[axis]) ? minVec[axis] : undefined}
                  max={Number.isFinite(maxVec[axis]) ? maxVec[axis] : undefined}
                  step={field.step}
                  class="nodrag w-full min-w-0 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-500"
                  onfocus={vecTracker.onFocus}
                  onblur={vecTracker.onBlur}
                  oninput={(e) =>
                    handleVec2Input(field, axis, (e.target as HTMLInputElement).value)}
                />
              </label>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  </div>
</div>
