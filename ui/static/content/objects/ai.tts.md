Convert text to speech using
[Google Cloud Text-to-Speech AI](https://cloud.google.com/text-to-speech).

![Patchies ai.tts demo](/content/images/ai-tts-demo.webp)

Access 700+ voices across 110+ languages (WaveNet, Neural2, Studio, Chirp HD).

Configure speaking rate (0.25x-4x), pitch (-20 to +20), and volume gain.

Uses the same Gemini API key stored in settings.

Outputs audio to the audio pipeline for further processing.

## API Key

Use "CMD + K > Set Gemini API Key" to configure. Get your key from
[Google Cloud Console](https://console.cloud.google.com/apis/credentials).

> **Caution**: API keys are stored in localStorage. Create separate keys with
> limited quota for use in Patchies.

## See Also

- [tts](/docs/objects/tts) - browser-native text-to-speech
- [ai.txt](/docs/objects/ai.txt) - AI text generation
