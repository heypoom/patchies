Convert text to speech using [Gemini TTS](https://ai.google.dev/gemini-api/docs/speech-generation).
Choose a voice and describe how it should speak, then send text to generate audio.

Connect the audio outlet to `out~` to hear speech or route it through audio effects.

## API Key

Open **Settings → AI** to set your Gemini API key and default **Gemini speech model**.
Use `gemini-3.8-flash-tts` (the default), `gemini-3.8-flash-lite-tts`, or another Gemini TTS model.

To override the model for one node, expand **model settings** in its settings panel.
Leave the model field empty to use the default shown in its placeholder.

Speech uses your Gemini key even when OpenRouter is selected for other AI features.

> **Caution**: API keys are stored in localStorage. Create separate keys with
> limited quota for use in Patchies.

## Voice and Style

Open the node settings to select one of 30 prebuilt voices. The default is Kore.
Gemini detects the language from your text.

Describe tone, accent, and pace in the speaking style field, such as "cheerful
and friendly, with a relaxed pace". Leave it empty to use the voice's natural delivery.

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

Change the voice or speaking style:

```javascript
send({ type: 'setVoice', value: 'Puck' });
send({ type: 'setStyle', value: 'calm and reassuring' });
```

Send `{ type: 'play' }` or a bang to play cached audio. If the current text,
model, voice, or style has changed, Patchies generates new audio first.
Send `{ type: 'stop' }` to stop playback and cancel pending generation.

API failures appear as toasts with Google's error message.

> **Note**: Gemini voices and speaking style replace the previous Cloud Text-to-Speech
> voices and numeric speed, pitch, and volume controls. Existing patches are not migrated.

## See Also

- [tts](/docs/objects/tts) - browser-native text-to-speech
- [ai.txt](/docs/objects/ai.txt) - AI text generation
