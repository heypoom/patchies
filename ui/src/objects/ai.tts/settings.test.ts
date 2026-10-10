import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { aiSettings, DEFAULT_PAXA_SPEECH_MODEL } from '../../stores/ai-settings.store';
import { getSpeechApiKey, resolveSpeechOptions, type AiTtsNodeData } from './settings';

const settings = {
  ...get(aiSettings),
  geminiApiKey: 'google-key',
  paxaApiKey: 'paxa-key'
};

describe('speech settings resolution', () => {
  it('inherits the global TTS provider with its own defaults', () => {
    const options = resolveSpeechOptions({}, { ...settings, ttsProvider: 'paxa' });

    expect(options).toEqual({
      provider: 'paxa',
      model: DEFAULT_PAXA_SPEECH_MODEL,
      voiceName: 'khanomkrok',
      text: '',
      style: ''
    });
    expect(getSpeechApiKey(options.provider, settings)).toBe('paxa-key');
  });

  it('allows simultaneous providers with independent voice/model overrides and keys', () => {
    const data: AiTtsNodeData = {
      text: 'Hello',
      voiceName: 'Puck',
      model: ' gemini-custom ',
      style: 'cheerful',
      paxaVoiceName: 'toast',
      paxaModel: ' paxa-custom '
    };
    const globalSettings = { ...settings, ttsProvider: 'paxa' as const };
    const gemini = resolveSpeechOptions({ ...data, provider: 'gemini' }, globalSettings);
    const paxa = resolveSpeechOptions({ ...data, provider: 'paxa' }, globalSettings);

    expect(gemini).toMatchObject({
      provider: 'gemini',
      model: 'gemini-custom',
      voiceName: 'Puck',
      style: 'cheerful'
    });
    expect(getSpeechApiKey(gemini.provider, globalSettings)).toBe('google-key');

    expect(paxa).toMatchObject({
      provider: 'paxa',
      model: 'paxa-custom',
      voiceName: 'toast',
      style: ''
    });
    expect(getSpeechApiKey(paxa.provider, globalSettings)).toBe('paxa-key');
  });

  it('uses provider defaults for blank model overrides', () => {
    expect(resolveSpeechOptions({ model: ' ' }, settings).model).toBe(settings.geminiSpeechModel);
    expect(resolveSpeechOptions({ provider: 'paxa', paxaModel: ' ' }, settings).model).toBe(
      DEFAULT_PAXA_SPEECH_MODEL
    );
  });
});
