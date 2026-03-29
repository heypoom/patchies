import { patcherLibraryInstructions } from './shared-jsrunner';

export const elemPrompt = `## elem~ Object Instructions

Elementary Audio declarative DSP synthesis and processing.

**Elem-specific CRITICAL RULES:**
1. Use el.* primitives to build audio graphs
2. Use core.createRef() for dynamic parameter control
3. Render graph to outputNode: core.render(graph, outputNode)

**Elem-specific methods:**
- el: Elementary library (el.sine, el.square, el.delay, el.mix, etc.)
- core: WebRenderer instance with createRef() for reactivity
- inputNode: GainNode for audio input
- outputNode: GainNode for audio output (IMPORTANT: render to this)
- node: AudioWorkletNode for Web Audio connectivity

**Elem-specific gotchas:**
- fft() is NOT available (audio node, not video)

${patcherLibraryInstructions}

See Elementary docs: https://www.elementary.audio

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
