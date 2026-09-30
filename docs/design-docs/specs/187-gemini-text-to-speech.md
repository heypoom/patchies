# 187. Gemini Text-to-Speech

Replace `ai.tts`'s Google Cloud Text-to-Speech requests with Gemini TTS so it uses the Gemini API key already configured in Patchies.

## Behavior

- Settings → AI has a persistent Gemini speech model text input, matching the text and image model fields. Default to `gemini-3.8-flash-tts`; users can enter `gemini-3.8-flash-lite-tts` or another Gemini TTS model. Speech always uses the Gemini key, including when OpenRouter is selected for other AI features.
- Single-speaker synthesis uses `POST https://generativelanguage.googleapis.com/v1beta/interactions`, the `x-goog-api-key` header, verbatim transcript input, optional `speech_metadata.style`, and `generation_config.speech_config` with the selected voice.
- Request complete WAV audio, decode the last model-output audio block from `steps[].content[]`, and play it through the existing `soundfile~` audio output.
- Node settings expose the 30 prebuilt Gemini voices (default Kore) and a free-text speaking style. Language is detected by Gemini. The voice catalog is local; mounting a node makes no network request.
- A collapsed model settings section follows the `ai.txt` and `ai.img` pattern. Its per-node `model` text field overrides the global speech model when nonblank; its placeholder shows the global default. Model edits persist in node data and support undo/redo.
- Keep string, `speak`, `load`, `play`, bang, and stop messages. `setVoice` uses Gemini names, and `setStyle` changes speaking style. Remove numeric rate, pitch, volume, and language settings.
- Cache generated audio by model, text, voice, and style. Snapshot these values before a request so changing settings while generating cannot put audio under the wrong cache key.
- Surface API, missing-key, missing-text, and missing-audio failures as error toasts with the underlying message. Show generation progress and errors on the node.
- Cancel pending generation on stop or destruction so a late response cannot start playback.

## Compatibility

Poom explicitly chose replacement without migration. Do not translate Cloud voice names or preserve the old numeric controls. Existing patches must select a Gemini voice and use style instructions where needed.

## Verification

- Test the real synthesis helper with mocked REST responses: configured model/key/voice/style, WAV bytes, Google errors, empty or malformed responses, and cancellation.
- Test speech-model persistence and defaults alongside existing AI settings.
- Run Svelte analysis, targeted lint/format checks, and the project typecheck.
- Live synthesis requires a Gemini key and is reported separately from mocked verification.

## Reference

[Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
