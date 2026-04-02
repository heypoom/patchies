<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { ChevronDown, KeyRound } from '@lucide/svelte/icons';
  import { match } from 'ts-pattern';
  import { isAiFeaturesVisible } from '../../../stores/ui.store';
  import {
    aiSettings,
    type AIProviderType,
    DEFAULT_OPENROUTER_TEXT_MODEL,
    DEFAULT_OPENROUTER_IMAGE_MODEL
  } from '../../../stores/ai-settings.store';
  import { toast } from 'svelte-sonner';

  let {
    open = $bindable(false),
    onSaveAndContinue,
    class: className = ''
  }: {
    open: boolean;
    onSaveAndContinue: () => void;
    class?: string;
  } = $props();

  let selectedProvider = $state<AIProviderType>($aiSettings.provider);
  let geminiKeyInput = $state('');
  let openRouterKeyInput = $state('');
  let openRouterTextModelInput = $state($aiSettings.openRouterTextModel);
  let openRouterImageModelInput = $state($aiSettings.openRouterImageModel);
  let showDefaultModels = $state(false);
  let error = $state<string | null>(null);

  let wasOpen = false;

  $effect(() => {
    if (open && !wasOpen) {
      selectedProvider = $aiSettings.provider;
      geminiKeyInput = $aiSettings.geminiApiKey;
      openRouterKeyInput = $aiSettings.openRouterApiKey;
      openRouterTextModelInput = $aiSettings.openRouterTextModel;
      openRouterImageModelInput = $aiSettings.openRouterImageModel;
      showDefaultModels = selectedProvider !== 'gemini';
      error = null;
    }

    wasOpen = open;
  });

  function validateAndSave() {
    error = null;

    if (selectedProvider === 'gemini') {
      const key = geminiKeyInput.trim();
      if (!key) {
        error = 'API key cannot be empty';
        return;
      }
      if (!key.startsWith('AIza')) {
        error = 'Invalid Gemini API key format. Keys start with "AIza"';
        return;
      }
      aiSettings.updateSettings({ provider: 'gemini', geminiApiKey: key });
    } else {
      const key = openRouterKeyInput.trim();
      if (!key) {
        error = 'API key cannot be empty';
        return;
      }
      aiSettings.updateSettings({
        provider: 'openrouter',
        openRouterApiKey: key,
        openRouterTextModel: openRouterTextModelInput.trim() || DEFAULT_OPENROUTER_TEXT_MODEL,
        openRouterImageModel: openRouterImageModelInput.trim() || DEFAULT_OPENROUTER_IMAGE_MODEL
      });
    }

    open = false;
    onSaveAndContinue();
  }

  function hideAiFeatures() {
    $isAiFeaturesVisible = false;
    open = false;
    toast.success(
      'All AI features hidden. Use "Ctrl/Cmd + K > Toggle AI Features" to re-enable them.'
    );
  }

  const onEnter = (fn: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fn();
    }
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Content class={['gap-0 p-0 sm:max-w-sm', className]}>
    <!-- Provider segmented control -->
    <div class="p-5 pb-4">
      <Dialog.Title class="mb-4 text-base font-semibold text-zinc-100">
        AI Provider Settings
      </Dialog.Title>
      <div class="flex rounded-lg bg-zinc-800 p-1">
        <button
          onclick={() => (selectedProvider = 'gemini')}
          class={[
            'flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-all',
            match(selectedProvider)
              .with('gemini', () => 'bg-zinc-600 text-white shadow-sm')
              .otherwise(() => 'text-zinc-400 hover:text-zinc-200')
          ]}
        >
          Google Gemini
        </button>
        <button
          onclick={() => (selectedProvider = 'openrouter')}
          class={[
            'flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-all',
            match(selectedProvider)
              .with('openrouter', () => 'bg-zinc-600 text-white shadow-sm')
              .otherwise(() => 'text-zinc-400 hover:text-zinc-200')
          ]}
        >
          OpenRouter
        </button>
      </div>
    </div>

    <form
      autocomplete="off"
      onsubmit={(e) => {
        e.preventDefault();

        validateAndSave();
      }}
      class="space-y-4 border-t border-zinc-800 px-5 py-4"
    >
      {#if selectedProvider === 'gemini'}
        <p class="text-xs text-zinc-500">
          Get a free API key at
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            class="text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:decoration-zinc-400"
          >
            Google AI Studio
          </a>. Keys are stored in localStorage.
        </p>
        <div class="relative">
          <KeyRound class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            id="gemini-key-input"
            type="password"
            autocomplete="off"
            bind:value={geminiKeyInput}
            onkeydown={onEnter(validateAndSave)}
            placeholder="AIza..."
            class="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 py-2.5 pr-3 pl-9 text-sm text-zinc-100 placeholder-zinc-600 transition-colors focus:border-zinc-500 focus:outline-none"
          />
        </div>
      {:else}
        <p class="text-xs text-zinc-500">
          Get an API key at
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            class="text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:decoration-zinc-400"
          >
            openrouter.ai/keys
          </a>. Keys are stored in localStorage.
        </p>
        <div class="relative">
          <KeyRound class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            id="openrouter-key-input"
            type="password"
            autocomplete="off"
            bind:value={openRouterKeyInput}
            onkeydown={onEnter(validateAndSave)}
            placeholder="sk-or-..."
            class="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 py-2.5 pr-3 pl-9 text-sm text-zinc-100 placeholder-zinc-600 transition-colors focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <!-- Default models collapsible -->
        <button
          type="button"
          onclick={() => (showDefaultModels = !showDefaultModels)}
          class="flex w-full cursor-pointer items-center justify-between text-xs text-zinc-600 transition-colors hover:text-zinc-400"
        >
          <span>Default models</span>
          <ChevronDown
            class={['h-3.5 w-3.5 transition-transform', showDefaultModels && 'rotate-180']}
          />
        </button>

        {#if showDefaultModels}
          <div class="rounded-lg border border-zinc-700/50 bg-zinc-800/40">
            <div class="grid grid-cols-[3.5rem_1fr] items-center gap-2 px-3 py-2">
              <span class="text-xs text-zinc-500">text</span>
              <input
                id="openrouter-text-model-input"
                type="text"
                bind:value={openRouterTextModelInput}
                placeholder={DEFAULT_OPENROUTER_TEXT_MODEL}
                class="w-full bg-transparent font-mono text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none"
              />
            </div>
            <div
              class="grid grid-cols-[3.5rem_1fr] items-center gap-2 border-t border-zinc-700/50 px-3 py-2"
            >
              <span class="text-xs text-zinc-500">image</span>
              <input
                id="openrouter-image-model-input"
                type="text"
                bind:value={openRouterImageModelInput}
                placeholder={DEFAULT_OPENROUTER_IMAGE_MODEL}
                class="w-full bg-transparent font-mono text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none"
              />
            </div>
            <p class="border-t border-zinc-700/50 px-3 py-2 text-[11px] text-zinc-600">
              STT, TTS, and Lyria require a separate Gemini key.
            </p>
          </div>
        {/if}
      {/if}

      {#if error}
        <p class="text-xs text-red-400">{error}</p>
      {/if}

      <div class="border-t border-zinc-800/80 pt-3">
        <button
          onclick={hideAiFeatures}
          class="cursor-pointer text-xs text-zinc-700 transition-colors hover:text-red-400"
        >
          Don't want AI features? Hide them.
        </button>
      </div>
    </form>

    <!-- Footer: action buttons only -->
    <div class="border-t border-zinc-800 px-5 py-4">
      <div class="flex gap-2">
        <button
          onclick={() => (open = false)}
          class="flex-1 cursor-pointer rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          Cancel
        </button>
        <button
          onclick={validateAndSave}
          class="flex-1 cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          Save & Continue
        </button>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
