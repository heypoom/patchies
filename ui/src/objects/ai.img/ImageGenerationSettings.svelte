<script lang="ts">
  import { ChevronDown, SlidersHorizontal } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { useNodeDataTracker } from '$lib/history';
  import {
    getGeminiImageResolutions,
    type ImageGenerationOptions
  } from '$lib/ai/image-generation-options';

  let {
    nodeId,
    provider,
    model,
    options
  }: {
    nodeId: string;
    provider: 'gemini' | 'openrouter';
    model: string;
    options?: ImageGenerationOptions;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const tracker = $derived.by(() => useNodeDataTracker(nodeId));

  const dataKey = $derived(provider === 'openrouter' ? 'openRouterOptions' : 'geminiOptions');
  const optionsTracker = $derived.by(() => tracker.track(dataKey, () => options));

  const resolutions = $derived(
    provider === 'openrouter'
      ? ['512', '768', '1K', '1.5K', '2K', '4K']
      : getGeminiImageResolutions(model)
  );

  let expanded = $state(false);

  const aspectRatios = [
    '1:1',
    '2:3',
    '3:2',
    '3:4',
    '4:3',
    '4:5',
    '5:4',
    '9:16',
    '16:9',
    '21:9',
    '1:4',
    '4:1',
    '1:8',
    '8:1'
  ];

  interface SelectField {
    key: keyof ImageGenerationOptions;
    label: string;
    values: string[];
  }

  interface NumberField {
    key: 'temperature' | 'topP' | 'topK' | 'seed' | 'outputCompression';
    label: string;
    min: number;
    max?: number;
    step: number;
  }

  const selectFields = $derived.by<SelectField[]>(() => {
    const fields: SelectField[] = [
      { key: 'aspectRatio', label: 'Aspect ratio', values: aspectRatios }
    ];

    if (resolutions.length > 0) {
      fields.push({ key: 'resolution', label: 'Resolution', values: resolutions });
    }

    if (provider === 'openrouter') {
      fields.push(
        { key: 'quality', label: 'Quality', values: ['auto', 'low', 'medium', 'high'] },
        { key: 'outputFormat', label: 'Format', values: ['png', 'jpeg', 'webp'] },
        { key: 'background', label: 'Background', values: ['auto', 'opaque', 'transparent'] }
      );
    }

    return fields;
  });

  const numberFields = $derived.by<NumberField[]>(() => {
    if (provider === 'openrouter') {
      return [
        { key: 'seed', label: 'Seed', min: 0, max: 2147483647, step: 1 },
        { key: 'outputCompression', label: 'Compression', min: 0, max: 100, step: 1 }
      ];
    }

    return [
      { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.1 },
      { key: 'topP', label: 'Top P', min: 0, max: 1, step: 0.05 },
      { key: 'topK', label: 'Top K', min: 1, step: 1 },
      { key: 'seed', label: 'Seed', min: 0, max: 2147483647, step: 1 }
    ];
  });

  function updateOption(
    key: keyof ImageGenerationOptions,
    value: string | number | undefined,
    commit = false
  ) {
    const previous = options;
    const next = { ...previous, [key]: value };

    updateNodeData(nodeId, { [dataKey]: next });

    if (commit) {
      tracker.commit(dataKey, previous, next);
    }
  }

  function updateNumber(key: NumberField['key'], input: HTMLInputElement) {
    if (input.value && !input.validity.valid) return;

    updateOption(key, input.value === '' ? undefined : input.valueAsNumber);
  }

  function isDisabled(key: keyof ImageGenerationOptions) {
    if (provider !== 'openrouter') return false;

    if (key === 'aspectRatio' || key === 'resolution') {
      return !!options?.size?.trim();
    }

    if (key === 'outputCompression') {
      return options?.outputFormat !== 'jpeg' && options?.outputFormat !== 'webp';
    }

    return false;
  }
</script>

<button
  class="nodrag flex w-full cursor-pointer items-center justify-between border-t border-zinc-700/50 px-2 py-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
  aria-expanded={expanded}
  onclick={() => (expanded = !expanded)}
>
  <span class="flex items-center gap-1.5">
    <SlidersHorizontal class="h-3 w-3" />
    <span class="font-mono text-[10px]">generation settings</span>
  </span>

  <ChevronDown class={['h-3 w-3 transition-transform', expanded && 'rotate-180']} />
</button>

{#if expanded}
  <div class="nodrag nopan nowheel space-y-1.5 px-2 pb-2 font-mono text-[11px]">
    {#each selectFields as field (field.key)}
      <label class="flex items-center justify-between gap-2 text-zinc-400">
        <span>{field.label}</span>

        <select
          class="h-6 w-28 shrink-0 cursor-pointer rounded border border-zinc-700 bg-zinc-900 py-0 pr-6 pl-1 text-zinc-300 focus-visible:outline focus-visible:outline-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
          value={options?.[field.key] ?? ''}
          disabled={isDisabled(field.key)}
          onchange={(event) =>
            updateOption(field.key, event.currentTarget.value || undefined, true)}
        >
          <option value="">Default</option>

          {#each field.values as value (value)}
            <option
              {value}
              disabled={field.key === 'background' &&
                value === 'transparent' &&
                options?.outputFormat === 'jpeg'}>{value}</option
            >
          {/each}
        </select>
      </label>
    {/each}

    {#if provider === 'openrouter'}
      <label class="flex items-center justify-between gap-2 text-zinc-400">
        <span>Pixel dimensions</span>

        <input
          type="text"
          value={options?.size ?? ''}
          placeholder="1024x1024"
          pattern="[1-9][0-9]*x[1-9][0-9]*"
          aria-label="Pixel dimensions"
          class="h-6 w-28 shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-0 text-zinc-300 placeholder:text-zinc-600 focus-visible:outline focus-visible:outline-zinc-400"
          oninput={(event) => updateOption('size', event.currentTarget.value || undefined)}
          onfocus={optionsTracker.onFocus}
          onblur={optionsTracker.onBlur}
        />
      </label>

      <p class="text-[10px] text-zinc-500">
        Pixel dimensions override aspect ratio and resolution.
      </p>
    {/if}

    {#each numberFields as field (field.key)}
      <label class="flex items-center justify-between gap-2 text-zinc-400">
        <span>{field.label}</span>
        <input
          type="number"
          value={options?.[field.key] ?? ''}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder="Default"
          disabled={isDisabled(field.key)}
          class="h-6 w-28 shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-0 text-zinc-300 placeholder:text-zinc-600 focus-visible:outline focus-visible:outline-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
          oninput={(event) => updateNumber(field.key, event.currentTarget)}
          onfocus={optionsTracker.onFocus}
          onblur={optionsTracker.onBlur}
        />
      </label>
    {/each}

    {#if provider === 'openrouter'}
      <p class="text-[10px] text-zinc-500">Compression applies to JPEG and WebP.</p>
    {/if}
  </div>
{/if}
