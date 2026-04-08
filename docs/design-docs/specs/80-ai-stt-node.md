# 80. AI STT Node

## Overview

`ai.stt` accepts audio input from the audio graph and transcribes it to text using the Gemini API. It is the inverse of `ai.tts`.

## Architecture

- V2 audio node class (`AiSttAudioNode`) with `connectFrom()` for audio input routing
- Uses `MediaStreamDestinationNode` + `MediaRecorder` to capture audio from the graph (same pattern as `sampler~`)
- Svelte component (`AiSttNode.svelte`) drives recording/transcription and renders UI
- Sends base64-encoded audio to Gemini `generateContent` endpoint as `inlineData`
- Outputs transcribed text on message outlet via `MessageContext`

## Inlets

1. **Audio inlet** (signal) — connect `mic~` or any audio source
2. **Message inlet** — control messages: `listen`, `stop`, `bang`, `setLanguage`, `setPrompt`, raw string

## Outlet

- **Message outlet** — transcribed text string

## Recording Flow

1. `startRecording()` → `MediaRecorder.start(100)` on `v2Node.recordingDestination.stream`
2. Chunks collected via `ondataavailable`
3. `stopRecording()` → `MediaRecorder.stop()`
4. `onstop` → assemble blob → base64 → Gemini API call
5. Response text → `messageContext.send(text)`

## API

- Model: `gemini-3-flash-preview`
- Auth: same `gemini-api-key` from localStorage
- MIME: `audio/webm;codecs=opus` preferred, fallback `audio/ogg;codecs=opus`

## Node Data

- `languageHint?: string` — BCP-47 language tag
- `prompt?: string` — transcription context hint
