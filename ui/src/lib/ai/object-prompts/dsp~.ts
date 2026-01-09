export const dspPrompt = `## dsp~ Object Instructions

CRITICAL RULES:
1. MUST implement process(inputs, outputs) function
2. ALWAYS call setTitle(), setPortCount(), setAudioPortCount() at start
3. Access audio buffers via inputs[inputIndex][channelIndex] and outputs[outputIndex][channelIndex]

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (for control messages)
- Audio inlets: "audio-in-0", "audio-in-1" (indexed by setAudioPortCount)
- Audio outlets: "audio-out-0", "audio-out-1" (indexed by setAudioPortCount)
- Multiple message inlets: "message-in-0", "message-in-1" (indexed by setPortCount)

Available in context:
- counter: increments every process() call
- sampleRate: audio sample rate (e.g. 48000)
- currentFrame: current frame number
- currentTime: current time in seconds
- $1-$9: dynamic value inlets
- setTitle(name), setPortCount(inlets, outlets), setAudioPortCount(inlets, outlets)
- setKeepAlive(enabled), recv(callback), send(data)

Example - White Noise:
\`\`\`json
{
  "type": "dsp~",
  "data": {
    "code": "setTitle('noise~')\\n\\nfunction process(inputs, outputs) {\\n  outputs[0].forEach(channel => {\\n    for (let i = 0; i < channel.length; i++) {\\n      channel[i] = Math.random() * 2 - 1;\\n    }\\n  });\\n}"
  }
}
\`\`\``;
