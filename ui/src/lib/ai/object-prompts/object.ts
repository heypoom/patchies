export const objectPrompt = `## object: Textual Audio & Control Objects

Meta-object system for creating text-based audio processing, synthesis, and control objects.
Type the object name and parameters in the expression field (e.g., "gain~ 0.5", "osc~ 440").

DATA STRUCTURE:
{
  "type": "object",
  "data": {
    "expr": "objectName param1 param2",  // Expression defining the object and initial parameters
    "name": "objectName",                 // Extracted object name (e.g., "gain~")
    "params": [value1, value2, ...]      // Array of parameter values
  }
}

AVAILABLE OBJECT TYPES:

**Audio Processing:** gain~, pan~, delay~, compressor~, waveshaper~, split~, merge~, meter~
**Filters:** lowpass~, highpass~, bandpass~, allpass~, notch~, lowshelf~, highshelf~, peaking~
**Synthesis:** osc~, sig~, noise~
**Utilities:** convolver~, fft~
**Control:** mtof, loadbang, metro, delay (control rate), adsr

HANDLE IDS (Auto-generated - INDEXED BY INLET/OUTLET TYPE):
- Pattern: "{type}-{direction}-{index}"
- Audio inlet: "audio-in-0", "audio-in-1", ... (indexed by inlet count)
- Message inlet: "message-in-0", "message-in-1", ... (indexed by inlet count)
- Audio outlet: "audio-out-0", "audio-out-1", ... (indexed by outlet count)
- Message outlet: "message-out-0", "message-out-1", ... (indexed by outlet count)
- Example: gain~ has inlets [message], outlets [audio]
  * Message inlet: "message-in-0"
  * Audio outlet: "audio-out-0"
- Example: osc~ has inlets [message (frequency)], outlets [audio]
  * Message inlet: "message-in-0"
  * Audio outlet: "audio-out-0"

CRITICAL RULES:
1. Audio objects (~) operate at audio rate, control objects at message rate
2. Connect by type: audio ports to audio ports, message ports to message ports
3. Parameters are space-separated in the expression (e.g., "gain~ 0.5" means params=[0.5])
4. Most objects correspond to Web Audio API nodes
5. Use dynamic param arrays for multi-parameter objects

EXAMPLE - Gain Control (single message inlet, single audio outlet):
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "gain~ 0.5",
    "name": "gain~",
    "params": [0.5]
  }
}
\`\`\`
Connections: message-in-0 receives gain value, audio-out-0 outputs amplified signal

EXAMPLE - Lowpass Filter (two message inlets, audio outlet):
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "lowpass~ 1000 1",
    "name": "lowpass~",
    "params": [1000, 1]
  }
}
\`\`\`
Connections: message-in-0 for cutoff, message-in-1 for Q, audio-in-0 for audio input, audio-out-0 for output

EXAMPLE - Oscillator (one message inlet, one audio outlet):
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "osc~ 440",
    "name": "osc~",
    "params": [440]
  }
}
\`\`\`
Connections: message-in-0 receives frequency, audio-out-0 outputs oscillator signal

CRITICAL: dac~ (Digital-to-Analog Converter - Speaker Output):
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "dac~",
    "name": "dac~",
    "params": []
  }
}
\`\`\`
- dac~ has ONLY ONE audio inlet: "audio-in-0"
- MULTIPLE audio sources CAN and SHOULD connect to the SAME "audio-in-0" handle
- Web Audio automatically sums/mixes multiple connections to the same inlet
- Example: 6 drum sounds → all connect to dac~ with targetHandle: "audio-in-0"
- DO NOT create separate dac~ nodes for each source
- DO NOT try to connect to "audio-in-1", "audio-in-2", etc. (they don't exist!)`;
