# Gemini TTS

## Objective

Replace Cloud Text-to-Speech with Gemini TTS and let users configure the default speech model in Settings → AI.

## Key Challenges & Solutions

- The shared Gemini key cannot authorize the existing Cloud TTS requests. Use Gemini's Interactions endpoint and keep credentials in the existing AI settings store.
- Gemini has different voices and controls. Poom chose replacement without migration; use the prebuilt voice catalog and a style field instead of numeric rate, pitch, and volume controls.
- Async responses can arrive after settings change or a node is stopped. Snapshot synthesis options and the cache key, abort superseded requests, and ignore cancelled results.
- Consecutive control messages can arrive before Svelte updates the view. Read current node data from Svelte Flow when generating speech.

## What Could Be Better

Network request and response behavior is covered with mocked tests. Live synthesis and audio playback still need verification with a configured Gemini key.

## Action Items

- Verify both configured models with a real Gemini key, including style changes, preload/play, and stop during generation.
