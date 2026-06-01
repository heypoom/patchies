<script lang="ts">
  import DomRuntimeNode from './DomRuntimeNode.svelte';
  import type { CreateDomRuntimeRoot } from './DomRuntimeNode.svelte';
  import { VUE_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
  import type { SettingsSchema } from '$lib/settings';

  let Vue: typeof import('vue') | null = null;
  let currentApp: ReturnType<(typeof import('vue'))['createApp']> | null = null;

  function cleanupRuntime() {
    if (currentApp) {
      try {
        currentApp.unmount();
      } catch {
        // Ignore unmount errors
      }

      currentApp = null;
    }
  }

  const createRuntimeRoot: CreateDomRuntimeRoot = async ({ containerRoot, customConsole }) => {
    cleanupRuntime();

    const vueRoot = document.createElement('div');
    vueRoot.className = 'h-full w-full';
    containerRoot.appendChild(vueRoot);

    if (!Vue) {
      // @ts-expect-error - vue.esm-bundler.js has no type declarations but works at runtime
      Vue = await import('vue/dist/vue.esm-bundler.js');
      customConsole.log('Vue loaded!');
    }

    return {
      root: vueRoot,
      extraContext: {
        Vue,
        createApp: Vue!.createApp,
        ref: Vue!.ref,
        reactive: Vue!.reactive,
        computed: Vue!.computed,
        watch: Vue!.watch,
        watchEffect: Vue!.watchEffect,
        onMounted: Vue!.onMounted,
        onUnmounted: Vue!.onUnmounted,
        nextTick: Vue!.nextTick,
        h: Vue!.h,
        defineComponent: Vue!.defineComponent
      },
      handleResult: (result: unknown) => {
        if (result && typeof result === 'object' && 'unmount' in result) {
          currentApp = result as ReturnType<(typeof import('vue'))['createApp']>;
        }
      }
    };
  };

  let {
    id,
    data,
    selected
  }: {
    id: string;
    data: {
      title: string;
      code: string;
      inletCount?: number;
      outletCount?: number;
      hidePorts?: boolean;
      executeCode?: number;
      showConsole?: boolean;
      width?: number;
      height?: number;
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
    };
    selected?: boolean;
  } = $props();
</script>

<DomRuntimeNode
  {id}
  {data}
  {selected}
  objectType="vue"
  titleFallback="vue"
  codePlaceholder="Write your Vue code here..."
  consolePlaceholder="Vue output will appear here."
  errorOffset={VUE_WRAPPER_OFFSET}
  {createRuntimeRoot}
  {cleanupRuntime}
/>
