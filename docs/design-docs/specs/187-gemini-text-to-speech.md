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

## Paxa provider

- Settings → AI adds a separate TTS provider default (`gemini` or `paxa`). Keep Google and Paxa API keys editable and stored independently, even when OpenRouter is the text/image provider. Default TTS to Gemini.
- The collapsed model settings section is available for both Gemini and Paxa. Its last control selects Default (the global TTS provider), Gemini, or Paxa. Explicit overrides allow both providers in the same patch. Track provider edits with undo/redo.
- Keep each provider's voice and model overrides independently in node data: Gemini uses `voiceName`/`model`, Paxa uses `paxaVoiceName`/`paxaModel`. Provider changes preserve both sets. Reset clears both sets and restores global provider inheritance.
- Paxa defaults to `paxa-tts-flash-v1` and `khanomkrok`. Use the served voice catalog locally, including searchable names, IDs, language, and descriptions. No catalog requests on node mount.
- Paxa uses `POST https://api.paxalabs.com/v1/tts`, Bearer authentication, text/model/voice, and complete WAV audio for the existing preload/cache/playback flow. No free-text speaking style for Paxa; hide that Gemini-only control. Emotion tags can be written in text for Khanom Chan and Kaprao.
- Resolve the provider, key, voice, model, text, and effective style before each request. Include the provider in the cache key, and exclude ignored Paxa style. `setVoice` edits the effective provider's voice. Existing cancellation and preload behavior apply to both providers.
- Display Paxa problem `title` codes and request IDs with errors. Never log keys. Keep keys in per-user settings, never patch data.
- Verify provider resolution, separate key persistence, Paxa binary responses/errors/cancellation, provider cache separation, and Gemini regressions with mocked requests; report live synthesis separately.
