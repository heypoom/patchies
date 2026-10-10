<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingDropdown from '../SettingDropdown.svelte';
  import { aiSettings, type TTSProviderType } from '../../../../stores/ai-settings.store';

  const providerOptions = [
    { value: 'gemini', label: 'Gemini' },
    { value: 'paxa', label: 'Paxa' }
  ];
</script>

<SettingRow
  title="Select TTS provider"
  description="Default provider for ai.tts; override per object"
>
  <SettingDropdown
    value={$aiSettings.ttsProvider}
    options={providerOptions}
    onchange={(value) => aiSettings.updateSettings({ ttsProvider: value as TTSProviderType })}
    label="Select TTS provider"
  />
</SettingRow>

{#if $aiSettings.provider !== 'gemini'}
  <SettingRow title="Google API key" description="Used by Gemini speech and other Gemini features">
    <input
      type="password"
      value={$aiSettings.geminiApiKey}
      oninput={(event) => aiSettings.updateSettings({ geminiApiKey: event.currentTarget.value })}
      placeholder="Enter Google API key"
      aria-label="Google API key"
      class="w-48 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors outline-none placeholder:text-zinc-700 hover:border-white/20 focus:border-orange-500/40"
    />
  </SettingRow>
{/if}

<SettingRow title="Paxa TTS API key" description="Create a key at paxalabs.com/app/keys">
  <input
    type="password"
    value={$aiSettings.paxaApiKey}
    oninput={(event) => aiSettings.updateSettings({ paxaApiKey: event.currentTarget.value })}
    placeholder="pxa_…"
    aria-label="Paxa TTS API key"
    class="w-48 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors outline-none placeholder:text-zinc-700 hover:border-white/20 focus:border-orange-500/40"
  />
</SettingRow>

<SettingRow title="Gemini speech model" description="Default model for ai.tts objects using Gemini">
  <input
    type="text"
    value={$aiSettings.geminiSpeechModel}
    oninput={(event) => aiSettings.updateSettings({ geminiSpeechModel: event.currentTarget.value })}
    aria-label="Gemini speech model"
    class="w-48 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors outline-none hover:border-white/20 focus:border-orange-500/40"
  />
</SettingRow>
