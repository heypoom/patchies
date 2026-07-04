<script lang="ts" module>
  // Supported parameters for vdo.publish()
  const SUPPORTED_PARAMS = new Set([
    // Video encoding
    'videoBitrate',
    'videoCodec',
    'videoWidth',
    'videoHeight',
    'videoFrameRate',
    'videoResolution',
    // Audio encoding
    'audioBitrate',
    'audioCodec',
    // Metadata
    'label',
    'meta',
    'order',
    // Flags
    'broadcast',
    'allowmidi',
    'allowdrawing',
    'iframe',
    'widget',
    'allowresources',
    'allowchunked'
  ]);

  // Boolean parameters that should be parsed as true/false
  const BOOLEAN_PARAMS = new Set([
    'broadcast',
    'allowmidi',
    'allowdrawing',
    'iframe',
    'widget',
    'allowresources'
  ]);

  // Numeric parameters
  const NUMERIC_PARAMS = new Set([
    'videoBitrate',
    'videoWidth',
    'videoHeight',
    'videoFrameRate',
    'audioBitrate',
    'allowchunked'
  ]);

  export type ParsedParams = Record<string, string | number | boolean>;

  export function parseVdoNinjaParams(input: string): { params: ParsedParams; warnings: string[] } {
    const params: ParsedParams = {};
    const warnings: string[] = [];

    if (!input.trim()) {
      return { params, warnings };
    }

    // Split by whitespace or comma
    const pairs = input.split(/[\s,]+/).filter(Boolean);

    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) {
        warnings.push(`Invalid format: "${pair}" (use key=value)`);
        continue;
      }

      const key = pair.slice(0, eqIndex).trim();
      const rawValue = pair.slice(eqIndex + 1).trim();

      if (!key) {
        warnings.push(`Empty key in: "${pair}"`);
        continue;
      }

      if (!SUPPORTED_PARAMS.has(key)) {
        warnings.push(`Unsupported: "${key}"`);
        continue;
      }

      // Parse value based on parameter type
      if (BOOLEAN_PARAMS.has(key)) {
        params[key] = rawValue === 'true' || rawValue === '1';
      } else if (NUMERIC_PARAMS.has(key)) {
        const num = Number(rawValue);
        if (Number.isNaN(num)) {
          warnings.push(`"${key}" should be a number`);
        } else {
          params[key] = num;
        }
      } else {
        params[key] = rawValue;
      }
    }

    return { params, warnings };
  }
</script>

<script lang="ts">
  import { AlertTriangle, ChevronRight, CircleHelp } from '@lucide/svelte/icons';
  import * as Collapsible from '$lib/components/ui/collapsible';

  let {
    value = $bindable(''),
    class: className = ''
  }: {
    value: string;
    class?: string;
  } = $props();

  let isOpen = $state(false);

  const parsed = $derived(parseVdoNinjaParams(value));
  const warnings = $derived(parsed.warnings);
  const paramCount = $derived(Object.keys(parsed.params).length);
</script>

<Collapsible.Root bind:open={isOpen} class={className}>
  <div class="flex items-center justify-between">
    <Collapsible.Trigger
      class="flex flex-1 cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[9px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
    >
      <ChevronRight class={['h-3 w-3 transition-transform', isOpen && 'rotate-90']} />
      <span>Advanced Parameters</span>

      {#if paramCount > 0}
        <span class="rounded bg-zinc-700 px-1 text-[8px] text-zinc-300">{paramCount}</span>
      {/if}
    </Collapsible.Trigger>

    <div class="ml-1 flex items-center gap-1">
      {#if warnings.length > 0}
        <div class="mr-0.5 flex items-center gap-1 text-[8px] text-yellow-500">
          <AlertTriangle class="h-2.5 w-2.5" />
          <span>{warnings.length}</span>
        </div>
      {/if}

      <div class="group/help relative">
        <CircleHelp class="h-3 w-3 cursor-help text-zinc-500 hover:text-zinc-300" />
        <div
          class="pointer-events-none absolute top-5 right-0 z-50 hidden w-56 rounded border border-zinc-600 bg-zinc-800 p-2 text-[9px] shadow-lg group-hover/help:block"
        >
          <div class="mb-1.5 font-semibold text-zinc-300">Available Parameters</div>
          <div class="space-y-1 text-zinc-400">
            <div>
              <span class="text-orange-400">Video:</span> videoBitrate, videoCodec, videoWidth, videoHeight,
              videoFrameRate, videoResolution
            </div>
            <div><span class="text-blue-400">Audio:</span> audioBitrate, audioCodec</div>
            <div><span class="text-green-400">Meta:</span> label, meta, order</div>
            <div>
              <span class="text-purple-400">Flags:</span> broadcast, allowmidi, allowdrawing, iframe,
              widget, allowresources, allowchunked
            </div>
          </div>
          <div class="mt-1.5 border-t border-zinc-700 pt-1.5 text-zinc-500">
            Format: key=value (space separated)
          </div>
        </div>
      </div>
    </div>
  </div>

  <Collapsible.Content class="mt-1 space-y-1">
    <input
      type="text"
      bind:value
      placeholder="videoBitrate=2500 audioBitrate=128"
      class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 font-mono text-[10px] text-zinc-200 placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
    />

    {#if warnings.length > 0}
      <div class="space-y-0.5">
        {#each warnings as warning}
          <div class="text-[8px] text-yellow-500">{warning}</div>
        {/each}
      </div>
    {/if}

    <div class="text-[7px] text-zinc-500">
      e.g. videoBitrate=2500 videoCodec=vp9 audioBitrate=128
    </div>
  </Collapsible.Content>
</Collapsible.Root>
