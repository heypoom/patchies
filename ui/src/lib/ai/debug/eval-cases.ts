/**
 * Eval test cases for multi-object AI generation.
 *
 * Each case is a minimal prompt testing a specific connection pattern.
 * The prompts are intentionally terse — we're testing handle ID correctness,
 * not the AI's ability to understand complex descriptions.
 */

export interface EvalCase {
  id: string;
  prompt: string;
  /** Which handle pattern category this tests */
  category: 'message' | 'audio' | 'video' | 'mixed' | 'dynamic';
  /** Expected node types (order doesn't matter, just presence) */
  expectedTypes: string[];
}

export const EVAL_CASES: EvalCase[] = [
  // === Message connections ===
  {
    id: 'msg-slider-to-msg',
    prompt: 'slider connected to a msg object',
    category: 'message',
    expectedTypes: ['slider', 'msg']
  },
  {
    id: 'msg-button-to-toggle',
    prompt: 'button connected to toggle',
    category: 'message',
    expectedTypes: ['button', 'toggle']
  },
  {
    id: 'msg-slider-to-js',
    prompt: 'slider sending values to a js node',
    category: 'message',
    expectedTypes: ['slider', 'js']
  },
  {
    id: 'msg-keyboard-to-js',
    prompt: 'keyboard connected to js node',
    category: 'message',
    expectedTypes: ['keyboard', 'js']
  },
  {
    id: 'msg-orca-to-sampler',
    prompt: 'orca sequencer triggering a sampler~',
    category: 'message',
    expectedTypes: ['orca', 'sampler~']
  },

  // === Audio connections (object nodes) ===
  {
    id: 'audio-osc-to-out',
    prompt: 'osc~ connected to out~',
    category: 'audio',
    expectedTypes: ['object']
  },
  {
    id: 'audio-osc-gain-out',
    prompt: 'osc~ through gain~ to out~',
    category: 'audio',
    expectedTypes: ['object']
  },
  {
    id: 'audio-noise-lowpass-out',
    prompt: 'noise~ through lowpass~ to out~',
    category: 'audio',
    expectedTypes: ['object']
  },

  // === Audio connections (dedicated nodes) ===
  {
    id: 'audio-mic-to-out',
    prompt: 'mic~ connected to out~',
    category: 'audio',
    expectedTypes: ['mic~', 'out~']
  },
  {
    id: 'audio-strudel-to-out',
    prompt: 'strudel pattern playing to out~',
    category: 'audio',
    expectedTypes: ['strudel', 'out~']
  },
  {
    id: 'audio-bytebeat-to-out',
    prompt: 'bytebeat~ connected to out~',
    category: 'audio',
    expectedTypes: ['bytebeat~', 'out~']
  },

  // === Audio with message control ===
  {
    id: 'mixed-slider-osc-out',
    prompt: 'slider controlling osc~ frequency, osc~ to out~',
    category: 'mixed',
    expectedTypes: ['slider', 'object']
  },
  {
    id: 'mixed-slider-gain-out',
    prompt: 'slider controlling gain~ level, with osc~ through gain~ to out~',
    category: 'mixed',
    expectedTypes: ['slider', 'object']
  },
  {
    id: 'mixed-toggle-metro',
    prompt: 'toggle starting and stopping a metro object',
    category: 'mixed',
    expectedTypes: ['toggle', 'object']
  },

  // === Video connections ===
  {
    id: 'video-p5-to-glsl',
    prompt: 'p5 sketch feeding into a glsl shader',
    category: 'video',
    expectedTypes: ['p5', 'glsl']
  },
  {
    id: 'video-p5-to-hydra',
    prompt: 'p5 sketch connected to hydra',
    category: 'video',
    expectedTypes: ['p5', 'hydra']
  },
  {
    id: 'video-webcam-to-glsl',
    prompt: 'webcam feeding into glsl shader',
    category: 'video',
    expectedTypes: ['webcam', 'glsl']
  },
  {
    id: 'video-glsl-to-bgout',
    prompt: 'glsl shader output to bg.out',
    category: 'video',
    expectedTypes: ['glsl', 'bg.out']
  },
  {
    id: 'video-hydra-to-bgout',
    prompt: 'hydra output to bg.out',
    category: 'video',
    expectedTypes: ['hydra', 'bg.out']
  },
  {
    id: 'video-canvas-to-glsl',
    prompt: 'canvas node connected to glsl shader',
    category: 'video',
    expectedTypes: ['canvas', 'glsl']
  },

  // === Dynamic port nodes ===
  {
    id: 'dynamic-tone-to-out',
    prompt: 'tone~ synth connected to out~',
    category: 'dynamic',
    expectedTypes: ['tone~', 'out~']
  },
  {
    id: 'dynamic-dsp-to-out',
    prompt: 'dsp~ node connected to out~',
    category: 'dynamic',
    expectedTypes: ['dsp~', 'out~']
  },
  {
    id: 'dynamic-js-two-outlets',
    prompt: 'js node with 2 outlets connected to two separate msg nodes',
    category: 'dynamic',
    expectedTypes: ['js', 'msg']
  },

  // === Tricky handle patterns ===
  {
    id: 'tricky-sampler-handles',
    prompt: 'mic~ recording into sampler~, sampler~ to out~',
    category: 'audio',
    expectedTypes: ['mic~', 'sampler~', 'out~']
  },
  {
    id: 'tricky-chuck-mixed',
    prompt: 'slider sending to chuck~ message inlet, chuck~ audio to out~',
    category: 'mixed',
    expectedTypes: ['slider', 'chuck~', 'out~']
  },
  {
    id: 'tricky-csound-mixed',
    prompt: 'button triggering csound~, csound~ audio to out~',
    category: 'mixed',
    expectedTypes: ['button', 'csound~', 'out~']
  },
  {
    id: 'tricky-meter-no-index',
    prompt: 'osc~ through gain~ to out~, also gain~ to meter~',
    category: 'audio',
    expectedTypes: ['object', 'meter~']
  },
  {
    id: 'tricky-out-fanin',
    prompt: 'two osc~ both connected to the same out~',
    category: 'audio',
    expectedTypes: ['object']
  },
  {
    id: 'tricky-msg-indexed-inlets',
    prompt: 'two sliders connected to a msg node that uses $1 and $2',
    category: 'message',
    expectedTypes: ['slider', 'msg']
  },
  {
    id: 'tricky-expr-indexed-inlets',
    prompt: 'two sliders feeding into expr node with $f1 + $f2',
    category: 'message',
    expectedTypes: ['slider', 'expr']
  },
  {
    id: 'tricky-sequencer-outlets',
    prompt: 'sequencer with 3 tracks sending to 3 separate msg nodes',
    category: 'dynamic',
    expectedTypes: ['sequencer', 'msg']
  },
  {
    id: 'tricky-swgl-mixed-outlets',
    prompt: 'swgl node with video output to bg.out',
    category: 'video',
    expectedTypes: ['swgl', 'bg.out']
  },
  {
    id: 'tricky-p5-dual-outlets',
    prompt: 'p5 node with video output to glsl and message output to a msg node',
    category: 'video',
    expectedTypes: ['p5', 'glsl', 'msg']
  },

  // === AI nodes ===
  {
    id: 'ai-text-prompt',
    prompt: 'slider connected to ai.txt, ai.txt output to msg',
    category: 'mixed',
    expectedTypes: ['slider', 'ai.txt', 'msg']
  },
  {
    id: 'ai-stt-pipeline',
    prompt: 'mic~ audio into ai.stt, ai.stt text output to msg',
    category: 'mixed',
    expectedTypes: ['mic~', 'ai.stt', 'msg']
  },
  {
    id: 'ai-speech-to-out',
    prompt: 'button triggering ai.tts, ai.tts audio to out~',
    category: 'mixed',
    expectedTypes: ['button', 'ai.tts', 'out~']
  },
  {
    id: 'ai-image-video',
    prompt: 'webcam into ai.img, ai.img video output to bg.out',
    category: 'video',
    expectedTypes: ['webcam', 'ai.img', 'bg.out']
  },

  // === Dynamic audio nodes ===
  {
    id: 'dynamic-elem-to-out',
    prompt: 'elem~ synthesis node connected to out~',
    category: 'dynamic',
    expectedTypes: ['elem~', 'out~']
  },
  {
    id: 'dynamic-sonic-to-out',
    prompt: 'sonic~ node connected to out~',
    category: 'dynamic',
    expectedTypes: ['sonic~', 'out~']
  },
  {
    id: 'dynamic-dsp-with-message',
    prompt: 'slider sending control to dsp~ message inlet, dsp~ audio to out~',
    category: 'dynamic',
    expectedTypes: ['slider', 'dsp~', 'out~']
  },
  {
    id: 'dynamic-canvas-dom',
    prompt: 'canvas.dom with video output to bg.out',
    category: 'video',
    expectedTypes: ['canvas.dom', 'bg.out']
  },

  // === Video routing ===
  {
    id: 'video-send-recv',
    prompt: 'p5 video into send.vdo, recv.vdo output to bg.out',
    category: 'video',
    expectedTypes: ['p5', 'send.vdo', 'recv.vdo', 'bg.out']
  },

  // === Three-node chains ===
  {
    id: 'chain-p5-glsl-hydra',
    prompt: 'p5 to glsl to hydra video chain',
    category: 'video',
    expectedTypes: ['p5', 'glsl', 'hydra']
  },
  {
    id: 'chain-slider-tone-out',
    prompt: 'slider controlling tone~ frequency, tone~ to out~',
    category: 'mixed',
    expectedTypes: ['slider', 'tone~', 'out~']
  },
  {
    id: 'chain-webcam-glsl-bgout',
    prompt: 'webcam through glsl shader to bg.out',
    category: 'video',
    expectedTypes: ['webcam', 'glsl', 'bg.out']
  },
  {
    id: 'chain-mic-chuck-out',
    prompt: 'mic~ into chuck~ audio processing, chuck~ to out~',
    category: 'audio',
    expectedTypes: ['mic~', 'chuck~', 'out~']
  },
  {
    id: 'chain-strudel-sampler-out',
    prompt: 'strudel to sampler~ audio output to out~',
    category: 'mixed',
    expectedTypes: ['strudel', 'sampler~', 'out~']
  },

  // === Uncovered node types ===
  {
    id: 'msg-knob-to-js',
    prompt: 'knob connected to js node',
    category: 'message',
    expectedTypes: ['knob', 'js']
  },
  {
    id: 'msg-textbox-to-msg',
    prompt: 'textbox connected to a msg node',
    category: 'message',
    expectedTypes: ['textbox', 'msg']
  },
  {
    id: 'audio-soundfile-to-out',
    prompt: 'soundfile~ playing audio to out~',
    category: 'audio',
    expectedTypes: ['soundfile~', 'out~']
  },
  {
    id: 'audio-scope-visualizer',
    prompt: 'osc~ connected to out~ and also to scope~ for visualization',
    category: 'audio',
    expectedTypes: ['object', 'scope~']
  },
  {
    id: 'msg-worker-to-msg',
    prompt: 'worker node output connected to a msg node',
    category: 'message',
    expectedTypes: ['worker', 'msg']
  },
  {
    id: 'video-three-to-bgout',
    prompt: 'three.js scene with video output to bg.out',
    category: 'video',
    expectedTypes: ['three', 'bg.out']
  },
  {
    id: 'video-three-dom-to-bgout',
    prompt: 'three.dom node with video output to bg.out',
    category: 'video',
    expectedTypes: ['three.dom', 'bg.out']
  },
  {
    id: 'msg-dom-to-msg',
    prompt: 'dom node output connected to msg',
    category: 'message',
    expectedTypes: ['dom', 'msg']
  },
  {
    id: 'msg-vue-to-msg',
    prompt: 'vue node output connected to msg',
    category: 'message',
    expectedTypes: ['vue', 'msg']
  },
  {
    id: 'audio-expr-tilde-to-out',
    prompt: 'expr~ audio expression node connected to out~',
    category: 'audio',
    expectedTypes: ['expr~', 'out~']
  },
  {
    id: 'msg-markdown-display',
    prompt: 'js node output to markdown node for display',
    category: 'message',
    expectedTypes: ['js', 'markdown']
  },
  {
    id: 'msg-iframe-control',
    prompt: 'button connected to iframe node',
    category: 'message',
    expectedTypes: ['button', 'iframe']
  },
  {
    id: 'ai-music-to-out',
    prompt: 'button triggering ai.music, ai.music audio to out~',
    category: 'mixed',
    expectedTypes: ['button', 'ai.music', 'out~']
  },
  {
    id: 'msg-stt-standalone',
    prompt: 'msg triggering stt (speech to text), stt output to another msg',
    category: 'message',
    expectedTypes: ['msg', 'stt', 'msg']
  },
  {
    id: 'msg-tts-standalone',
    prompt: 'button triggering tts (text to speech)',
    category: 'message',
    expectedTypes: ['button', 'tts']
  },
  {
    id: 'video-screen-to-glsl',
    prompt: 'screen capture feeding into glsl shader',
    category: 'video',
    expectedTypes: ['screen', 'glsl']
  },
  {
    id: 'msg-midi-in-to-js',
    prompt: 'midi.in receiving MIDI data connected to js node',
    category: 'message',
    expectedTypes: ['midi.in', 'js']
  },
  {
    id: 'msg-js-to-midi-out',
    prompt: 'js node sending MIDI messages to midi.out',
    category: 'message',
    expectedTypes: ['js', 'midi.out']
  },
  {
    id: 'msg-js-to-netsend',
    prompt: 'js node connected to netsend for network output',
    category: 'message',
    expectedTypes: ['js', 'netsend']
  },
  {
    id: 'msg-netrecv-to-msg',
    prompt: 'netrecv receiving network data to msg',
    category: 'message',
    expectedTypes: ['netrecv', 'msg']
  }
];

export type EvalStatus = 'pending' | 'running' | 'pass' | 'fail' | 'error';

export interface EvalEdgeResult {
  sourceType: string;
  targetType: string;
  sourceHandle: string | undefined;
  targetHandle: string | undefined;
  sourceError: string | null;
  targetError: string | null;
}

export interface EvalResult {
  caseId: string;
  status: EvalStatus;
  timestamp: number;
  elapsedMs: number;
  /** Generated node types */
  nodeTypes: string[];
  /** Per-edge validation */
  edges: EvalEdgeResult[];
  /** Total error count */
  errorCount: number;
  /** Total warning count */
  warnCount: number;
  /** AI error message if generation failed */
  errorMessage?: string;
}

const STORAGE_KEY = 'patchies-ai-eval-results';

export function loadResults(): EvalResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveResults(results: EvalResult[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
}

export function clearResults(): void {
  localStorage.removeItem(STORAGE_KEY);
}
