export const elemPrompt = `## elem~ Object Instructions

Elementary Audio declarative DSP synthesis and processing.

**CRITICAL RULES:**
1. Use el.* primitives to build audio graphs
2. Use core.createRef() for dynamic parameter control
3. Render graph to outputNode: core.render(graph, outputNode)

**Available Methods:**
- setPortCount(inlets, outlets) - Configure message ports
- setTitle(name) - Set node title
- recv(callback), send(data, {to: outletIndex}?) - Message I/O

**Context:**
- el: Elementary library (el.sine, el.square, el.delay, el.mix, etc.)
- core: WebRenderer instance with createRef() for reactivity
- inputNode: GainNode for audio input
- outputNode: GainNode for audio output (IMPORTANT: render to this)
- node: AudioWorkletNode for Web Audio connectivity

See Elementary docs: https://www.elementary.audio

**Handle IDs:**
- Audio outlet: "audio-out"
- Message ports: "message-in-0"..."message-in-n", "message-out-0"..."message-out-m"

Example - Sine oscillator:
\`\`\`json
{
  "type": "elem~",
  "data": {
    "code": "setTitle('osc~'); const graph = el.sine(440); core.render(el.mul(graph, 0.1), outputNode);"
  }
}
\`\`\`

Example - Frequency control:
\`\`\`json
{
  "type": "elem~",
  "data": {
    "code": "setPortCount(1); let [freq, setFreq] = core.createRef('const', {value: 440}, []); recv(f => { if (typeof f === 'number') setFreq({value: f}); }); const graph = el.sine(freq); core.render(el.mul(graph, 0.1), outputNode);"
  }
}
\`\`\``;
