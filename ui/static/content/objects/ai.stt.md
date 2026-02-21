Transcribe speech to text using [Gemini AI](https://ai.google.dev/).

Connect an audio source (e.g. `mic~`) to the audio inlet.
Send `listen` to start recording, `stop` to stop and transcribe.
Outputs the transcribed text as a string message.

Click the node to toggle recording.

## API Key

Use **Cmd+K > Set Gemini API Key** to configure.

> **Caution**: API keys are stored in localStorage. They can be
  stolen if you load a malicious patch.

## See Also

- [ai.tts](/docs/objects/ai.tts) - AI text-to-speech
- [ai.txt](/docs/objects/ai.txt) - AI text generation
- [mic~](/docs/objects/mic~) - Microphone audio input
