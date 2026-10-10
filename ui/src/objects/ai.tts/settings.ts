import {
  DEFAULT_PAXA_SPEECH_MODEL,
  type AISettings,
  type TTSProviderType
} from '../../stores/ai-settings.store';
import { DEFAULT_GEMINI_VOICE, DEFAULT_PAXA_VOICE } from './voices';
import type { SpeechOptions } from './speech';

export interface AiTtsNodeData {
  text?: string;
  provider?: TTSProviderType;
  voiceName?: string;
  style?: string;
  model?: string;
  paxaVoiceName?: string;
  paxaModel?: string;
}

export const getSpeechProvider = (data: AiTtsNodeData, settings: AISettings) =>
  data.provider ?? settings.ttsProvider;

export const getVoiceField = (provider: TTSProviderType) =>
  provider === 'paxa' ? 'paxaVoiceName' : 'voiceName';

export const getModelField = (provider: TTSProviderType) =>
  provider === 'paxa' ? 'paxaModel' : 'model';

export const getDefaultSpeechModel = (provider: TTSProviderType, settings: AISettings) =>
  provider === 'paxa' ? DEFAULT_PAXA_SPEECH_MODEL : settings.geminiSpeechModel;

export const getSpeechApiKey = (provider: TTSProviderType, settings: AISettings) =>
  provider === 'paxa' ? settings.paxaApiKey : settings.geminiApiKey;

export function resolveSpeechOptions(data: AiTtsNodeData, settings: AISettings): SpeechOptions {
  const provider = getSpeechProvider(data, settings);
  const defaultVoice = provider === 'paxa' ? DEFAULT_PAXA_VOICE : DEFAULT_GEMINI_VOICE;

  return {
    provider,
    model: data[getModelField(provider)]?.trim() || getDefaultSpeechModel(provider, settings),
    text: data.text ?? '',
    voiceName: data[getVoiceField(provider)] || defaultVoice,
    style: provider === 'gemini' ? (data.style ?? '') : ''
  };
}
