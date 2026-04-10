<script lang="ts">
  import { ChevronDown, KeyRound } from '@lucide/svelte/icons';
  import { isAiFeaturesVisible } from '../../../stores/ui.store';
  import {
    aiSettings,
    type AIProviderType,
    DEFAULT_GEMINI_TEXT_MODEL,
    DEFAULT_GEMINI_IMAGE_MODEL,
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
  let geminiTextModelInput = $state($aiSettings.geminiTextModel);
  let geminiImageModelInput = $state($aiSettings.geminiImageModel);
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
      geminiTextModelInput = $aiSettings.geminiTextModel;
      geminiImageModelInput = $aiSettings.geminiImageModel;
      openRouterKeyInput = $aiSettings.openRouterApiKey;
      openRouterTextModelInput = $aiSettings.openRouterTextModel;
      openRouterImageModelInput = $aiSettings.openRouterImageModel;
      showDefaultModels = false;
      error = null;
    }
    wasOpen = open;
  });

  $effect(() => {
    if (!open) return;
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') open = false;
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
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
      aiSettings.updateSettings({
        provider: 'gemini',
        geminiApiKey: key,
        geminiTextModel: geminiTextModelInput.trim() || DEFAULT_GEMINI_TEXT_MODEL,
        geminiImageModel: geminiImageModelInput.trim() || DEFAULT_GEMINI_IMAGE_MODEL
      });
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

{#if open}
  <div class="ai-root {className}" role="presentation">
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="ai-backdrop" onclick={() => (open = false)}></div>

    <!-- Card -->
    <div
      class="ai-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-dialog-title"
      tabindex="-1"
    >
      <!-- Corner ornaments -->
      <span class="ac ac-tl" aria-hidden="true"></span>
      <span class="ac ac-tr" aria-hidden="true"></span>
      <span class="ac ac-bl" aria-hidden="true"></span>
      <span class="ac ac-br" aria-hidden="true"></span>

      <!-- Glow -->
      <div class="ai-glow" aria-hidden="true"></div>

      <!-- Header -->
      <div class="ai-header">
        <div>
          <p class="ai-eyebrow">patchies · ai</p>
          <h2 id="ai-dialog-title" class="ai-title">Provider Settings</h2>
        </div>
        <button onclick={() => (open = false)} class="ai-close" aria-label="Close">✕</button>
      </div>

      <!-- Provider tabs -->
      <div class="ai-tabs">
        <button
          onclick={() => (selectedProvider = 'gemini')}
          class={['ai-tab', selectedProvider === 'gemini' && 'ai-tab--active']}
        >
          Google Gemini
        </button>
        <button
          onclick={() => (selectedProvider = 'openrouter')}
          class={['ai-tab', selectedProvider === 'openrouter' && 'ai-tab--active']}
        >
          OpenRouter
        </button>
      </div>

      <!-- Form body -->
      <form
        autocomplete="off"
        onsubmit={(e) => {
          e.preventDefault();
          validateAndSave();
        }}
        class="ai-body"
      >
        {#if selectedProvider === 'gemini'}
          <p class="ai-hint">
            Get a free API key at
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              class="ai-link"
            >
              Google AI Studio
            </a>. Keys are stored in localStorage.
          </p>

          <div class="ai-input-wrap">
            <KeyRound class="ai-input-icon" />
            <input
              id="gemini-key-input"
              type="password"
              autocomplete="off"
              bind:value={geminiKeyInput}
              onkeydown={onEnter(validateAndSave)}
              placeholder="AIza..."
              class="ai-input"
            />
          </div>
        {:else}
          <p class="ai-hint">
            Get an API key at
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              class="ai-link"
            >
              openrouter.ai/keys
            </a>. Keys are stored in localStorage.
          </p>

          <div class="ai-input-wrap">
            <KeyRound class="ai-input-icon" />
            <input
              id="openrouter-key-input"
              type="password"
              autocomplete="off"
              bind:value={openRouterKeyInput}
              onkeydown={onEnter(validateAndSave)}
              placeholder="sk-or-..."
              class="ai-input"
            />
          </div>
        {/if}

        <!-- Default models collapsible -->
        <button
          type="button"
          onclick={() => (showDefaultModels = !showDefaultModels)}
          class="ai-models-toggle"
        >
          <span>Default models</span>
          <ChevronDown
            class={['h-3 w-3 transition-transform', showDefaultModels && 'rotate-180']}
          />
        </button>

        {#if showDefaultModels}
          <div class="ai-models-box">
            {#if selectedProvider === 'gemini'}
              <div class="ai-model-row">
                <span class="ai-model-label">text</span>
                <input
                  type="text"
                  bind:value={geminiTextModelInput}
                  placeholder={DEFAULT_GEMINI_TEXT_MODEL}
                  class="ai-model-input"
                />
              </div>
              <div class="ai-model-row ai-model-row--sep">
                <span class="ai-model-label">image</span>
                <input
                  type="text"
                  bind:value={geminiImageModelInput}
                  placeholder={DEFAULT_GEMINI_IMAGE_MODEL}
                  class="ai-model-input"
                />
              </div>
            {:else}
              <div class="ai-model-row">
                <span class="ai-model-label">text</span>
                <input
                  type="text"
                  bind:value={openRouterTextModelInput}
                  placeholder={DEFAULT_OPENROUTER_TEXT_MODEL}
                  class="ai-model-input"
                />
              </div>
              <div class="ai-model-row ai-model-row--sep">
                <span class="ai-model-label">image</span>
                <input
                  type="text"
                  bind:value={openRouterImageModelInput}
                  placeholder={DEFAULT_OPENROUTER_IMAGE_MODEL}
                  class="ai-model-input"
                />
              </div>
              <p class="ai-model-note">STT, TTS, and Lyria require a separate Gemini key.</p>
            {/if}
          </div>
        {/if}

        {#if error}
          <p class="ai-error">{error}</p>
        {/if}

        <!-- Footer -->
        <div class="ai-footer">
          <button type="button" onclick={hideAiFeatures} class="ai-hide-btn">
            Don't want AI features? Hide them.
          </button>

          <div class="ai-actions">
            <button type="button" onclick={() => (open = false)} class="ai-btn-cancel">
              Cancel
            </button>
            <button type="submit" class="ai-btn-save"> Save & Continue </button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .ai-root {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Syne', sans-serif;
    padding: 16px;
  }

  .ai-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(12px);
    animation: ai-fade 0.2s ease both;
  }

  @keyframes ai-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .ai-card {
    position: relative;
    z-index: 10;
    background: #09090b;
    border: 1px solid rgba(249, 115, 22, 0.18);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.03),
      0 0 60px rgba(249, 115, 22, 0.06),
      0 32px 64px rgba(0, 0, 0, 0.8);
    border-radius: 14px;
    width: 100%;
    max-width: 400px;
    overflow: hidden;
    animation: ai-in 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }

  @keyframes ai-in {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Corner ornaments */
  .ac {
    position: absolute;
    width: 12px;
    height: 12px;
    opacity: 0.4;
    pointer-events: none;
    z-index: 2;
  }
  .ac-tl {
    top: 10px;
    left: 10px;
    border-top: 1px solid #f97316;
    border-left: 1px solid #f97316;
  }
  .ac-tr {
    top: 10px;
    right: 10px;
    border-top: 1px solid #f97316;
    border-right: 1px solid #f97316;
  }
  .ac-bl {
    bottom: 10px;
    left: 10px;
    border-bottom: 1px solid #f97316;
    border-left: 1px solid #f97316;
  }
  .ac-br {
    bottom: 10px;
    right: 10px;
    border-bottom: 1px solid #f97316;
    border-right: 1px solid #f97316;
  }

  .ai-glow {
    position: absolute;
    top: -40px;
    left: -40px;
    right: -40px;
    height: 160px;
    background: radial-gradient(
      ellipse 70% 60% at 50% 35%,
      rgba(249, 115, 22, 0.08),
      transparent 70%
    );
    pointer-events: none;
    z-index: 0;
  }

  /* Header */
  .ai-header {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 20px 20px 16px;
  }

  .ai-eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #3f3f46;
    margin-bottom: 4px;
  }

  .ai-title {
    font-family: 'Syne', sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: #f4f4f5;
    letter-spacing: -0.01em;
  }

  .ai-close {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #3f3f46;
    background: none;
    border: none;
    padding: 4px 6px;
    cursor: pointer;
    transition: color 0.15s;
    line-height: 1;
    margin-top: 2px;
  }
  .ai-close:hover {
    color: #71717a;
  }

  /* Provider tabs */
  .ai-tabs {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 2px;
    padding: 0 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .ai-tab {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #3f3f46;
    background: none;
    border: none;
    padding: 8px 10px 10px;
    cursor: pointer;
    transition: color 0.15s;
    position: relative;
  }
  .ai-tab:hover {
    color: #71717a;
  }
  .ai-tab--active {
    color: #f97316;
  }
  .ai-tab--active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 6px;
    right: 6px;
    height: 1px;
    background: #f97316;
    opacity: 0.8;
  }

  /* Body */
  .ai-body {
    position: relative;
    z-index: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .ai-hint {
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 11px;
    color: #52525b;
    line-height: 1.5;
  }

  .ai-link {
    color: #a1a1aa;
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-color: #52525b;
  }
  .ai-link:hover {
    color: #d4d4d8;
  }

  /* Input */
  .ai-input-wrap {
    position: relative;
  }

  :global(.ai-input-icon) {
    position: absolute;
    top: 50%;
    left: 11px;
    transform: translateY(-50%);
    width: 13px;
    height: 13px;
    color: #3f3f46;
    pointer-events: none;
  }

  .ai-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    padding: 9px 12px 9px 34px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    color: #e4e4e7;
    outline: none;
    transition: border-color 0.15s;
  }
  .ai-input::placeholder {
    color: #3f3f46;
  }
  .ai-input:focus {
    border-color: rgba(249, 115, 22, 0.3);
  }

  /* Models toggle */
  .ai-models-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: #3f3f46;
    transition: color 0.15s;
    padding: 0;
  }
  .ai-models-toggle:hover {
    color: #71717a;
  }

  /* Models box */
  .ai-models-box {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.01);
    overflow: hidden;
  }

  .ai-model-row {
    display: grid;
    grid-template-columns: 3rem 1fr;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
  }
  .ai-model-row--sep {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .ai-model-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #52525b;
    letter-spacing: 0.08em;
  }

  .ai-model-input {
    background: transparent;
    border: none;
    outline: none;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #a1a1aa;
    width: 100%;
  }
  .ai-model-input::placeholder {
    color: #3f3f46;
  }

  .ai-model-note {
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 10px;
    color: #3f3f46;
    padding: 6px 12px 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  /* Error */
  .ai-error {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #f87171;
    letter-spacing: 0.02em;
  }

  /* Footer */
  .ai-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .ai-hide-btn {
    background: none;
    border: none;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #3f3f46;
    cursor: pointer;
    transition: color 0.15s;
    text-align: left;
    padding: 0;
    letter-spacing: 0.02em;
  }
  .ai-hide-btn:hover {
    color: #f87171;
  }

  .ai-actions {
    display: flex;
    gap: 8px;
  }

  .ai-btn-cancel {
    flex: 1;
    padding: 9px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.02);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.06em;
    color: #71717a;
    cursor: pointer;
    transition: all 0.15s;
  }
  .ai-btn-cancel:hover {
    border-color: rgba(255, 255, 255, 0.12);
    color: #a1a1aa;
  }

  .ai-btn-save {
    flex: 1;
    padding: 9px 12px;
    border-radius: 6px;
    border: 1px solid rgba(249, 115, 22, 0.35);
    background: rgba(249, 115, 22, 0.1);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.06em;
    color: #f97316;
    cursor: pointer;
    transition: all 0.15s;
  }
  .ai-btn-save:hover {
    border-color: rgba(249, 115, 22, 0.55);
    background: rgba(249, 115, 22, 0.16);
  }
</style>
