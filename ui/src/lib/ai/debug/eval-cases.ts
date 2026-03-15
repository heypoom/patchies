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
