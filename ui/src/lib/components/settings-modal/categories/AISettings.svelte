<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingToggle from '../SettingToggle.svelte';
  import SettingDropdown from '../SettingDropdown.svelte';
  import { isAiFeaturesVisible } from '../../../../stores/ui.store';
  import { aiSettings, type AIProviderType } from '../../../../stores/ai-settings.store';
  import { chatSettingsStore } from '../../../../stores/chat-settings.store';

  const providerOptions = [
    { value: 'gemini', label: 'Gemini' },
    { value: 'openrouter', label: 'OpenRouter' }
  ];

  const currentProvider = $derived($aiSettings.provider);

  function handleProviderChange(value: string) {
    aiSettings.updateSettings({ provider: value as AIProviderType });
  }

  function handleApiKeyInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const key = target.value;
    if ($aiSettings.provider === 'gemini') {
      aiSettings.updateSettings({ geminiApiKey: key });
    } else {
      aiSettings.updateSettings({ openRouterApiKey: key });
    }
  }

  function handleTextModelInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const model = target.value;
    if ($aiSettings.provider === 'gemini') {
      aiSettings.updateSettings({ geminiTextModel: model });
    } else {
      aiSettings.updateSettings({ openRouterTextModel: model });
    }
  }

  function handleImageModelInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const model = target.value;
    if ($aiSettings.provider === 'gemini') {
      aiSettings.updateSettings({ geminiImageModel: model });
    } else {
      aiSettings.updateSettings({ openRouterImageModel: model });
    }
  }

  const currentApiKey = $derived(
    $aiSettings.provider === 'gemini' ? $aiSettings.geminiApiKey : $aiSettings.openRouterApiKey
  );

  const currentTextModel = $derived(
    $aiSettings.provider === 'gemini'
      ? $aiSettings.geminiTextModel
      : $aiSettings.openRouterTextModel
  );

  const currentImageModel = $derived(
    $aiSettings.provider === 'gemini'
      ? $aiSettings.geminiImageModel
      : $aiSettings.openRouterImageModel
  );
</script>

<SettingRow title="Show AI features" description="Show or hide AI-powered tools and sparks">
  <SettingToggle checked={$isAiFeaturesVisible} onchange={(v) => isAiFeaturesVisible.set(v)} />
</SettingRow>

{#if $isAiFeaturesVisible}
  <SettingRow title="AI provider" description="Choose between Gemini and OpenRouter">
    <SettingDropdown
      value={currentProvider}
      options={providerOptions}
      onchange={handleProviderChange}
    />
  </SettingRow>

  <SettingRow title="API key" description="Your API key for the selected provider">
    <input
      type="password"
      value={currentApiKey}
      oninput={handleApiKeyInput}
      placeholder="Enter API key"
      class="w-48 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors outline-none placeholder:text-zinc-700 hover:border-white/20 focus:border-orange-500/40"
    />
  </SettingRow>

  <SettingRow title="Text model" description="Model used for text generation">
    <input
      type="text"
      value={currentTextModel}
      oninput={handleTextModelInput}
      class="w-48 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors outline-none hover:border-white/20 focus:border-orange-500/40"
    />
  </SettingRow>

  <SettingRow title="Image model" description="Model used for image generation">
    <input
      type="text"
      value={currentImageModel}
      oninput={handleImageModelInput}
      class="w-48 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors outline-none hover:border-white/20 focus:border-orange-500/40"
    />
  </SettingRow>

  <SettingRow title="Expand thinking" description="Show AI reasoning steps in chat">
    <SettingToggle
      checked={$chatSettingsStore.expandThinking}
      onchange={() => chatSettingsStore.toggleExpandThinking()}
    />
  </SettingRow>
{/if}
