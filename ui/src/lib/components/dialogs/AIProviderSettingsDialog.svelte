<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { isAiFeaturesVisible } from '../../../stores/ui.store';
  import { aiSettings, type AIProviderType } from '../../../stores/ai-settings.store';
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
  let openRouterModelInput = $state($aiSettings.openRouterModel);
  let error = $state<string | null>(null);

  // Sync state when dialog opens
  $effect(() => {
    if (open) {
      selectedProvider = $aiSettings.provider;
      geminiKeyInput = $aiSettings.geminiApiKey;
      openRouterKeyInput = $aiSettings.openRouterApiKey;
      openRouterModelInput = $aiSettings.openRouterModel;
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
      const model = openRouterModelInput.trim();
      if (!key) {
        error = 'API key cannot be empty';
        return;
      }
      if (!model) {
        error = 'Model cannot be empty';
        return;
      }
      aiSettings.updateSettings({
        provider: 'openrouter',
        openRouterApiKey: key,
        openRouterModel: model
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
          <label for="openrouter-model-input" class="block text-sm text-zinc-300">Model:</label>
          <input
            id="openrouter-model-input"
            type="text"
            bind:value={openRouterModelInput}
            placeholder="google/gemini-2.5-flash-preview-05-20"
            class="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <p class="text-xs text-zinc-500">
            Examples: <code class="text-zinc-400">anthropic/claude-sonnet-4-5</code>,
            <code class="text-zinc-400">openai/gpt-4o</code>,
            <code class="text-zinc-400">google/gemini-2.5-flash-preview-05-20</code>
          </p>
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
