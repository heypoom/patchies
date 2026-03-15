export const dspPrompt = `## dsp~ Object Instructions

Low-level DSP audio processing. MUST implement process(inputs, outputs) function.

**CRITICAL RULES:**
1. Implement process(inputs, outputs) - called per audio buffer
2. Call setTitle(), setPortCount(), setAudioPortCount() at start
3. Access buffers: inputs[inlet][channel], outputs[outlet][channel]

**Available Methods:**
- setTitle(name), setPortCount(inlets, outlets), setAudioPortCount(inlets, outlets)
- recv(callback), send(data, {to: outletIndex}?) - Message I/O
- setKeepAlive(enabled) - Keep running when unconnected

**Context Variables (in process):**
- counter, sampleRate, currentFrame, currentTime
- $1-$9: dynamic numeric inlets

**Handle IDs:**
- IMPORTANT: When there is exactly 1 audio inlet, the handle is "audio-in" (NO index). When there are multiple, use "audio-in-0", "audio-in-1", etc. Same rule for audio outlets: 1 outlet → "audio-out", multiple → "audio-out-0", "audio-out-1".
- Message handles always have an index: "message-in-0", "message-out-0", etc.
- $1-$9 control inlets use message handles: "message-in-0" for $1, "message-in-1" for $2, etc.

Example - White noise (1 audio output → handle is "audio-out", not "audio-out-0"):
\`\`\`json
{
  "type": "dsp~",
  "data": {
    "code": "setTitle('noise~'); setAudioPortCount(0, 1); function process(inputs, outputs) { outputs[0].forEach(ch => { for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }); }"
  }
}
\`\`\``;
