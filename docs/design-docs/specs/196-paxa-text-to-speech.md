# 196. Paxa Text-to-Speech

Add Paxa as an `ai.tts` provider alongside [Gemini TTS](187-gemini-text-to-speech.md), with streaming audio playback and incremental text input through the Go server.

## Provider

- Settings → AI adds a separate TTS provider default (`gemini` or `paxa`). Keep Google and Paxa API keys editable and stored independently, even when OpenRouter is the text/image provider. Default TTS to Gemini.
- The collapsed model settings section is available for both Gemini and Paxa. Its last control selects Default (the global TTS provider), Gemini, or Paxa. Explicit overrides allow both providers in the same patch. Track provider edits with undo/redo.
- Keep each provider's voice and model overrides independently in node data: Gemini uses `voiceName`/`model`, Paxa uses `paxaVoiceName`/`paxaModel`. Provider changes preserve both sets. Reset clears both sets and restores global provider inheritance.
- Paxa defaults to `paxa-tts-flash-v1` and `khanomkrok`. Use the served voice catalog locally, including searchable names, IDs, language, and descriptions. No catalog requests on node mount.
- Paxa uses `POST https://api.paxalabs.com/v1/tts`, Bearer authentication, text/model/voice, and complete WAV audio for the existing preload/cache/playback flow. No free-text speaking style for Paxa; hide that Gemini-only control. Emotion tags can be written in text for Khanom Chan and Kaprao.
- Resolve the provider, key, voice, model, text, and effective style before each request. Include the provider in the cache key, and exclude ignored Paxa style. `setVoice` edits the effective provider's voice. Existing cancellation and preload behavior apply to both providers.
- Display Paxa problem `title` codes and request IDs with errors. Never log keys. Keep keys in per-user settings, never patch data.
- Verify provider resolution, separate key persistence, Paxa binary responses/errors/cancellation, provider cache separation, and Gemini regressions with mocked requests; report live synthesis separately.

## Streaming playback

- Add a persistent per-object `streaming` checkbox to model settings, enabled by default for Paxa and shown only for Paxa. Track edits with undo/redo; reset enables it. Gemini keeps its buffered Interactions API path.
- With streaming enabled, request MP3 with `stream: true`, consume the response reader, and append each chunk to an `audio/mpeg` MediaSource SourceBuffer. Attach the MediaSource URL to the existing soundfile audio node so playback begins before the response finishes and follows graph connections/effects.
- Cache the complete MP3 only after successful completion, without restarting playback. Delivery mode is not part of the synthesis cache key. `load` remains silent and buffers a complete response; cached playback uses the existing audio path.
- Stop, superseding requests, provider changes, reset, and destruction abort the reader and stop/release the active MediaSource. Network or append errors stop partial playback and do not cache incomplete audio. Keep the MediaSource alive after response completion until stopped or replaced, allowing queued audio to finish.
- Browsers without MPEG MediaSource support show an actionable error; users can disable streaming. Do not silently make another billed request as fallback.
- Test chunk delivery before EOF, stream errors/cancellation, MIME/request selection, MediaSource ordering/cleanup, and effective settings. Live provider playback requires a key and is verified separately.

## Incremental text input

- Add `append` with a `text` string, `flush`, and `end` messages. The first nonempty append lazily opens a Paxa live session using the current provider/key/model/voice. Queue fragments until Paxa reports `started`; preserve their exact text and ordering. Flush forces synthesis of the buffered text; end closes input and waits for remaining audio and `done`.
- These messages require Paxa and MP3 MediaSource support. They always stream playback, independently of the HTTP streaming checkbox. Strings and `speak` keep complete-text HTTP behavior; do not reinterpret LLM fragments sent as plain strings. Live audio is not cached or added to saved patch text.
- Keep one session per node. A new append after end starts a fresh session and stops the prior playback. Stop, normal speech/preload, provider changes, reset, and node destruction close the socket and discard queued audio. Voice/model changes take effect on the next session.
- Add a fixed `/api/ai/tts/paxa/live` WebSocket route to the existing Go server. Accept same-origin browser upgrades only. The first frame is `{type: "auth", apiKey: "…"}`; consume it locally, dial only `wss://api.paxalabs.com/v1/tts/live` with Bearer auth, then forward text/binary frames in both directions. No credential URLs, persistence, logging, provider credentials, or arbitrary upstream URL support. Use the existing x/net WebSocket package and bound auth time, frame sizes, and idle reads.
- Once the upstream is connected, the relay emits `{type: "relayReady"}`; the browser sends Paxa's start frame then. Relay setup failures use a local error frame without credentials. Provider error events and premature closes surface on the node; cancelled/stale sessions cannot resume playback. End waits for queued MP3 appends before finishing MediaSource.
- Register an object-owned AI prompt covering providers, model settings, messages, graph audio routing, and a runnable append/flush/end example. Explain LLM delta-only forwarding and flushing at the end of a turn, especially for Thai.
- Test relay authentication/header injection, origin checks, bidirectional frame forwarding, and disconnect cleanup against a local mock upstream. Test the browser session with a fake socket for ordered fragments, early audio, end, provider failures, stale cancellation, and no use of credentials in the URL. Test real MediaSource playback with local MP3 audio separately from live provider synthesis.
