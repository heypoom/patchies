<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { ChevronDown } from '@lucide/svelte/icons';
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
    onSaveAndContinue
  }: {
    open: boolean;
    onSaveAndContinue: () => void;
  } = $props();

  let selectedProvider = $state<AIProviderType>($aiSettings.provider);
  let geminiKeyInput = $state('');
  let openRouterKeyInput = $state('');
  let openRouterTextModelInput = $state($aiSettings.openRouterTextModel);
  let openRouterImageModelInput = $state($aiSettings.openRouterImageModel);
  let showDefaultModels = $state(false);
  let error = $state<string | null>(null);

  // Sync state when dialog opens
  $effect(() => {
    if (open) {
      selectedProvider = $aiSettings.provider;
      geminiKeyInput = $aiSettings.geminiApiKey;
      openRouterKeyInput = $aiSettings.openRouterApiKey;
      openRouterTextModelInput = $aiSettings.openRouterTextModel;
      openRouterImageModelInput = $aiSettings.openRouterImageModel;
      showDefaultModels = false;
      error = null;
    }
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
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>AI Provider Settings</Dialog.Title>
    </Dialog.Header>
    <div class="space-y-4">
      <div class="space-y-2">
        <span class="block text-sm text-zinc-300">Provider</span>
        <div class="flex gap-2">
          <button
            onclick={() => (selectedProvider = 'gemini')}
            class="flex-1 cursor-pointer rounded border px-3 py-2 text-sm transition-colors {selectedProvider ===
            'gemini'
              ? 'border-blue-500 bg-blue-600/20 text-blue-300'
              : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-zinc-500'}"
          >
            Google Gemini
          </button>
          <button
            onclick={() => (selectedProvider = 'openrouter')}
            class="flex-1 cursor-pointer rounded border px-3 py-2 text-sm transition-colors {selectedProvider ===
            'openrouter'
              ? 'border-blue-500 bg-blue-600/20 text-blue-300'
              : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-zinc-500'}"
          >
            OpenRouter
          </button>
        </div>
      </div>

      {#if selectedProvider === 'gemini'}
        <div class="space-y-2">
          <p class="text-sm text-zinc-300">
            Get a free API key at
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-400 underline hover:text-blue-300"
            >
              Google AI Studio
            </a>.
          </p>
          <label for="gemini-key-input" class="block text-sm text-zinc-300">Gemini API key:</label>
          <input
            id="gemini-key-input"
            type="password"
            bind:value={geminiKeyInput}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                validateAndSave();
              }
            }}
            placeholder="AIza..."
            class="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      {:else}
        <div class="space-y-2">
          <p class="text-sm text-zinc-300">
            Get an API key at
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-400 underline hover:text-blue-300"
            >
              openrouter.ai/keys
            </a>.
          </p>
          <label for="openrouter-key-input" class="block text-sm text-zinc-300"
            >OpenRouter API key:</label
          >
          <input
            id="openrouter-key-input"
            type="password"
            bind:value={openRouterKeyInput}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                validateAndSave();
              }
            }}
            placeholder="sk-or-..."
            class="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />

          <!-- Collapsible default models -->
          <button
            type="button"
            onclick={() => (showDefaultModels = !showDefaultModels)}
            class="flex w-full cursor-pointer items-center justify-between rounded px-1 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <span>Default models</span>
            <ChevronDown
              class={['h-3.5 w-3.5 transition-transform', showDefaultModels && 'rotate-180']}
            />
          </button>

          {#if showDefaultModels}
            <div class="space-y-2 rounded border border-zinc-700/60 bg-zinc-800/50 px-3 py-2">
              <div class="space-y-1">
                <label for="openrouter-text-model-input" class="block text-xs text-zinc-400"
                  >Text model</label
                >
                <input
                  id="openrouter-text-model-input"
                  type="text"
                  bind:value={openRouterTextModelInput}
                  placeholder={DEFAULT_OPENROUTER_TEXT_MODEL}
                  class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 font-mono text-xs text-zinc-100 placeholder-zinc-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div class="space-y-1">
                <label for="openrouter-image-model-input" class="block text-xs text-zinc-400"
                  >Image model</label
                >
                <input
                  id="openrouter-image-model-input"
                  type="text"
                  bind:value={openRouterImageModelInput}
                  placeholder={DEFAULT_OPENROUTER_IMAGE_MODEL}
                  class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 font-mono text-xs text-zinc-100 placeholder-zinc-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <p class="text-xs text-zinc-600">
                e.g. <code class="text-zinc-500">anthropic/claude-sonnet-4-5</code>,
                <code class="text-zinc-500">openai/gpt-4o</code>
              </p>
            </div>
          {/if}

          <div
            class="rounded border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300"
          >
            <span class="font-medium">Gemini-only features</span> won't work with OpenRouter: speech-to-text,
            text-to-speech, and live music (Lyria). Add a Gemini API key too if you need these.
          </div>
        </div>
      {/if}

      {#if error}
        <p class="text-xs text-red-400">{error}</p>
      {/if}

      <p class="text-xs text-zinc-400">
        ⚠️ Keys are stored in browser localStorage. Use separate keys with strict budget limits.
      </p>

      <p class="text-xs text-zinc-500">
        Don't want to use AI features?
        <button
          onclick={hideAiFeatures}
          class="cursor-pointer text-red-400 underline hover:text-red-300"
        >
          Hide all AI features.
        </button>
      </p>
    </div>
    <Dialog.Footer class="flex gap-2">
      <button
        onclick={() => (open = false)}
        class="flex-1 cursor-pointer rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
      >
        Cancel
      </button>
      <button
        onclick={validateAndSave}
        class="flex-1 cursor-pointer rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
      >
        Save & Continue
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
