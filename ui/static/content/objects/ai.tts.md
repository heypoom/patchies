Convert text to speech using [Gemini TTS](https://ai.google.dev/gemini-api/docs/speech-generation)
or [Paxa](https://paxalabs.com/docs). Choose a provider and voice, then send text to generate audio.

Connect the audio outlet to `out~` to hear speech or route it through audio effects.

## API Key

Open **Settings → AI** and choose **Select TTS provider**. Configure your **Google API key**
for Gemini and **Paxa TTS API key** for Paxa. Both keys can be configured at once,
independently of the provider used for text and image generation.
Create a Paxa key at [Paxa Labs](https://paxalabs.com/app/keys).

Expand **model settings** in each node's panel to choose **Provider**. This section
is available for both Gemini and Paxa. Leave **Provider** on **Default** to
follow Settings → AI, or choose **Gemini** or **Paxa** for that object. You can use
both providers in the same patch.

For Gemini, Settings → AI also sets the default **Gemini speech model**.
Paxa defaults to `paxa-tts-flash-v1`.
Expand **model settings** in the node panel to override the selected provider's model.
Leave the field empty to use the default shown in its placeholder.
Each provider keeps its own voice and model overrides when you switch between them.
Reset restores defaults and global provider inheritance.

> **Caution**: API keys are stored in localStorage. Create separate keys with
> limited quota for use in Patchies.

## Voice and Style

For Gemini, open the node settings to select one of 30 prebuilt voices. The default is Kore.
Gemini detects the language from your text.

Describe tone, accent, and pace in the speaking style field, such as "cheerful
and friendly, with a relaxed pace". Leave it empty to use the voice's natural delivery.

Paxa supports Thai, English, and Mandarin Chinese voices. The default is Khanom Krok
(`khanomkrok`); search voices by name, ID, or language in the node settings.
Paxa has no free-text speaking style, so that field appears only for Gemini.
The experimental Khanom Chan (`khanomchan`) and Kaprao (`kaprao`) voices support
[emotion tags](https://paxalabs.com/docs/emotion-tags) in the text, such as `[happy]`.

Paxa accepts up to 5,000 characters per request. Split longer text into shorter
`speak` or `load` requests.

## Messages

Send a string to generate and play speech:

```javascript
send('Have a wonderful day!');
```

Use `speak` to generate and play, or `load` to prepare audio without playing:

```javascript
send({ type: 'speak', text: 'Welcome to Patchies.' });
send({ type: 'load', text: 'Ready when you are.' });
```

Change the voice for the selected provider, or the speaking style for Gemini:

```javascript
send({ type: 'setVoice', value: 'Puck' });
send({ type: 'setStyle', value: 'calm and reassuring' });
```

For a node using Paxa:

```javascript
send({ type: 'setVoice', value: 'nomyen' });
send({ type: 'speak', text: 'สวัสดีค่ะ ยินดีต้อนรับสู่ Patchies' });
```

Send `{ type: 'play' }` or a bang to play cached audio. If the current text,
provider, model, voice, or Gemini style has changed, Patchies generates new audio first.
Send `{ type: 'stop' }` to stop playback and cancel pending generation.

API failures appear as toasts. Paxa errors include the problem code and request ID when available.

## See Also

- [tts](/docs/objects/tts) - browser-native text-to-speech
- [ai.txt](/docs/objects/ai.txt) - AI text generation
