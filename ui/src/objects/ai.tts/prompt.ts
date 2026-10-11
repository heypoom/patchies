export const aiTtsPrompt = `## ai.tts Object Instructions

Convert text to speech using Gemini or Paxa. This is a dedicated visual node: type "ai.tts", with object-shaped data. Connect its audio outlet (audio-out-0) to out~ or audio effects. Its message inlet is message-in-0. No code is needed in the ai.tts node.

Settings:
- provider: "gemini" or "paxa"; omit to inherit Settings → AI's TTS provider.
- Gemini: voiceName (default "Kore"), style (free-text delivery instructions), model (optional model override).
- Paxa: paxaVoiceName (default "khanomkrok"), paxaModel (default "paxa-tts-flash-v1"), streaming (default true, controls complete-text HTTP audio streaming).
- API keys belong in Settings → AI. Never include keys in generated patch data or code.

Complete-text messages:
- A string or {type: "speak", text: "Hello!"} generates and plays one complete utterance.
- {type: "load", text: "Hello!"} preloads silently; {type: "play"} or bang plays cached audio.
- {type: "setVoice", value: "nomyen"} selects the current provider's voice for the next request/session.
- {type: "setStyle", value: "calm and friendly"} controls Gemini only.
- {type: "stop"} cancels generation and playback, including a live session.

Incremental text input (Paxa only):
- {type: "append", text: fragment} opens a live session on the first fragment and appends subsequent fragments without replacing or cancelling earlier text.
- {type: "flush"} forces synthesis of buffered text while keeping the session open. Useful at sentence/turn boundaries, especially for Thai.
- {type: "end"} finishes text input, synthesizes remaining text, drains audio, and closes the session. Send it when the upstream LLM finishes, even after flush.
- Forward only NEW text deltas, preserving whitespace. Do not forward an accumulating full transcript repeatedly, and do not send fragments as plain strings/speak messages: those start separate requests and cancel pending generation.
- Paxa can synthesize at natural sentence boundaries while more fragments arrive. Live input always streams audio, independently of the HTTP streaming checkbox. It requires the co-hosted Go server's credential-passthrough WebSocket relay and MP3 MediaSource support in the browser.
- A session snapshots voice/model. Change settings before the first append. Live audio is not cached. Stop discards the session; the next append starts a new one.

Example: a js node connected by its message outlet to a Paxa ai.tts node, whose audio outlet connects to out~:
\`\`\`javascript
send({ type: 'append', text: 'สวัสดีครับ ' });
send({ type: 'append', text: 'ยินดีต้อนรับสู่ Patchies' });
send({ type: 'flush' });
send({ type: 'end' });
\`\`\`

Use data {provider: "paxa", paxaVoiceName: "khanomkrok"} for that ai.tts node. In an LLM streaming callback, send append once per delta and end once on completion. Do not invent an LLM streaming callback API: use the actual output messages of the upstream object, or implement the provider's streaming transport in a js/worker node.
`;
