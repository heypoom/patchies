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

Example - White noise (1 audio output → handle is "audio-out", not "audio-out-0"):
\`\`\`json
{
  "type": "dsp~",
  "data": {
    "code": "setTitle('noise~'); setAudioPortCount(0, 1); function process(inputs, outputs) { outputs[0].forEach(ch => { for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }); }"
  }
}
\`\`\``;
