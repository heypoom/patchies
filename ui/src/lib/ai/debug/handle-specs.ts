import { match } from 'ts-pattern';

/**
 * Handle specifications for all node types, derived from StandardHandle usage
 * in each node's Svelte component. Used by the debug page to validate
 * AI-generated edge handle IDs.
 *
 * Handle ID algorithm (StandardHandle.svelte):
 *   portDir = port === 'inlet' ? 'in' : 'out'
 *   if type AND id: `${type}-${portDir}-${id}`
 *   if type only:   `${type}-${portDir}`
 *   if id only:     `${portDir}-${id}`
 *   otherwise:      port value ('inlet'|'outlet')
 */

export type HandlePattern =
  | { kind: 'fixed'; handles: string[] }
  | { kind: 'indexed'; prefix: string; note?: string }
  | { kind: 'dynamic'; patterns: string[]; note: string };

export interface NodeHandleSpec {
  inlets: HandlePattern;
  outlets: HandlePattern;
}

/**
 * Static handle specs for all node types that the AI can generate.
 * For dynamic nodes, we specify the pattern format so validation
 * can check if a handle matches.
 */
export const NODE_HANDLE_SPECS: Record<string, NodeHandleSpec> = {
  // === Basic Control & UI ===
  slider: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  button: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  toggle: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  knob: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  msg: {
    inlets: { kind: 'indexed', prefix: 'message-in-', note: '0-8 based on $N placeholders' },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  textbox: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  keyboard: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  label: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: [] }
  },
  sequencer: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'indexed', prefix: 'out-', note: 'one per track (no type prefix)' }
  },

  // === Audio I/O (Dedicated node types) ===
  'mic~': {
    inlets: { kind: 'fixed', handles: ['in-0'] },
    outlets: { kind: 'fixed', handles: ['audio-out-0'] }
  },
  'out~': {
    inlets: { kind: 'fixed', handles: ['audio-in-0'] },
    outlets: { kind: 'fixed', handles: [] }
  },
  'meter~': {
    inlets: { kind: 'fixed', handles: ['audio-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  'scope~': {
    inlets: {
      kind: 'dynamic',
      patterns: ['audio-in-0', 'audio-in-1'],
      note: '1 inlet for waveform, 2 for xy mode'
    },
    outlets: { kind: 'fixed', handles: [] }
  },
  'soundfile~': {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['audio-out-0'] }
  },
  'sampler~': {
    inlets: { kind: 'fixed', handles: ['audio-in', 'message-in'] },
    outlets: { kind: 'fixed', handles: ['audio-out'] }
  },

  // === Visual & Creative Coding ===
  p5: {
    inlets: {
      kind: 'indexed',
      prefix: 'in-',
      note: 'message inlets (no type prefix), count from setPortCount'
    },
    outlets: {
      kind: 'dynamic',
      patterns: ['video-out-0', 'out-{N}'],
      note: 'video-out-0 first (if enabled), then message out-{N}'
    }
  },
  hydra: {
    inlets: {
      kind: 'dynamic',
      patterns: ['video-in-{N}', 'message-in-{N}'],
      note: 'video inlets first, then message inlets (from setPortCount)'
    },
    outlets: {
      kind: 'dynamic',
      patterns: ['video-out-{N}', 'message-out-{N}'],
      note: 'video outlets first, then message outlets'
    }
  },
  glsl: {
    inlets: {
      kind: 'dynamic',
      patterns: ['{type}-in-{index}-{uniformName}-{uniformType}'],
      note: 'type is video for sampler2D, message otherwise. ID is index-name-type composite'
    },
    outlets: { kind: 'fixed', handles: ['video-out-out'] }
  },
  js: {
    inlets: {
      kind: 'indexed',
      prefix: 'in-',
      note: 'message inlets (no type prefix), count from setPortCount'
    },
    outlets: { kind: 'indexed', prefix: 'out-', note: 'message outlets (no type prefix)' }
  },
  worker: {
    inlets: {
      kind: 'indexed',
      prefix: 'in-',
      note: 'message inlets (no type prefix), count from setPortCount'
    },
    outlets: { kind: 'indexed', prefix: 'out-', note: 'message outlets (no type prefix)' }
  },
  canvas: {
    inlets: { kind: 'indexed', prefix: 'in-', note: 'message inlets (no type prefix)' },
    outlets: {
      kind: 'dynamic',
      patterns: ['video-out-0', 'out-{N}'],
      note: 'video-out-0 first (if enabled), then message out-{N}'
    }
  },
  'canvas.dom': {
    inlets: { kind: 'indexed', prefix: 'in-', note: 'message inlets (no type prefix)' },
    outlets: {
      kind: 'dynamic',
      patterns: ['video-out-0', 'out-{N}'],
      note: 'video-out-0 first, then message out-{N}'
    }
  },
  three: {
    inlets: {
      kind: 'dynamic',
      patterns: ['video-in-{N}', 'message-in-{N}'],
      note: 'video inlets first, then message inlets'
    },
    outlets: {
      kind: 'dynamic',
      patterns: ['video-out-{N}', 'message-out-{N}'],
      note: 'video outlets first, then message outlets'
    }
  },
  'three.dom': {
    inlets: { kind: 'indexed', prefix: 'in-', note: 'message inlets (no type prefix)' },
    outlets: {
      kind: 'dynamic',
      patterns: ['video-out-0', 'out-{N}'],
      note: 'video-out-0 first, then message out-{N}'
    }
  },
  dom: {
    inlets: { kind: 'indexed', prefix: 'in-', note: 'no type prefix' },
    outlets: { kind: 'indexed', prefix: 'out-', note: 'no type prefix' }
  },
  swgl: {
    inlets: { kind: 'fixed', handles: ['message-in-0'] },
    outlets: { kind: 'fixed', handles: ['video-out-0', 'message-out-0'] }
  },
  'bg.out': {
    inlets: { kind: 'fixed', handles: ['video-in-0'] },
    outlets: { kind: 'fixed', handles: [] }
  },
  vue: {
    inlets: { kind: 'indexed', prefix: 'in-', note: 'no type prefix' },
    outlets: { kind: 'indexed', prefix: 'out-', note: 'no type prefix' }
  },

  // === Audio & Music ===
  'tone~': {
    inlets: {
      kind: 'dynamic',
      patterns: ['audio-in', 'message-in-{N}'],
      note: 'audio-in (fixed), then message-in-{N} from setPortCount'
    },
    outlets: {
      kind: 'dynamic',
      patterns: ['audio-out', 'message-out-{N}'],
      note: 'audio-out (fixed), then message-out-{N} from setPortCount'
    }
  },
  'dsp~': {
    inlets: {
      kind: 'dynamic',
      patterns: ['audio-in', 'audio-in-{N}', 'message-in-{N}'],
      note: 'audio inlets (single=audio-in, multi=audio-in-{N}), then message-in-{N}'
    },
    outlets: {
      kind: 'dynamic',
      patterns: ['audio-out', 'audio-out-{N}', 'message-out-{N}'],
      note: 'audio outlets then message outlets'
    }
  },
  'elem~': {
    inlets: {
      kind: 'dynamic',
      patterns: ['audio-in', 'message-in-{N}'],
      note: 'audio-in (fixed), then message-in-{N} from setPortCount'
    },
    outlets: {
      kind: 'dynamic',
      patterns: ['audio-out', 'message-out-{N}'],
      note: 'audio-out (fixed), then message-out-{N}'
    }
  },
  'sonic~': {
    inlets: {
      kind: 'dynamic',
      patterns: ['audio-in', 'message-in-{N}'],
      note: 'audio-in (fixed), then message-in-{N}'
    },
    outlets: {
      kind: 'dynamic',
      patterns: ['audio-out', 'message-out-{N}'],
      note: 'audio-out (fixed), then message-out-{N}'
    }
  },
  'chuck~': {
    inlets: { kind: 'fixed', handles: ['audio-in-0', 'message-in-1'] },
    outlets: { kind: 'fixed', handles: ['audio-out', 'message-out-0'] }
  },
  'csound~': {
    inlets: { kind: 'fixed', handles: ['audio-in-0', 'message-in-1'] },
    outlets: { kind: 'fixed', handles: ['audio-out-0'] }
  },
  'bytebeat~': {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['audio-out'] }
  },
  strudel: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['audio-out'] }
  },
  orca: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  'expr~': {
    inlets: {
      kind: 'dynamic',
      patterns: ['audio-in', 'audio-in-{N}', 'message-in-{N}'],
      note: 'signal inlets then control inlets'
    },
    outlets: { kind: 'fixed', handles: ['audio-out'] }
  },

  // === Programming & Control ===
  expr: {
    inlets: { kind: 'indexed', prefix: 'message-in-', note: '0-8 based on $N in expression' },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },

  // === Documentation & Content ===
  markdown: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  iframe: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },

  // === AI Objects ===
  'ai.text': {
    inlets: { kind: 'fixed', handles: ['message-in', 'video-in-0'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  'ai.image': {
    inlets: { kind: 'fixed', handles: ['video-in-0', 'message-in-1'] },
    outlets: { kind: 'fixed', handles: ['video-out-0', 'message-out-1'] }
  },
  'ai.stt': {
    inlets: { kind: 'fixed', handles: ['audio-in-0', 'message-in-1'] },
    outlets: { kind: 'fixed', handles: ['message-out-0'] }
  },
  stt: {
    inlets: { kind: 'fixed', handles: ['message-in-0'] },
    outlets: { kind: 'fixed', handles: ['message-out-0'] }
  },
  tts: {
    inlets: { kind: 'fixed', handles: ['message-in-0'] },
    outlets: { kind: 'fixed', handles: ['message-out-0'] }
  },
  'ai.speech': {
    inlets: { kind: 'fixed', handles: ['message-in-0'] },
    outlets: { kind: 'fixed', handles: ['audio-out-0'] }
  },
  'ai.music': {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['audio-out'] }
  },

  // === Media Input ===
  webcam: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['video-out-0'] }
  },
  screen: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['video-out-0'] }
  },

  // === Video Routing ===
  'send.vdo': {
    inlets: { kind: 'fixed', handles: ['video-in-0', 'message-in-1'] },
    outlets: { kind: 'fixed', handles: [] }
  },
  'recv.vdo': {
    inlets: { kind: 'fixed', handles: ['message-in-0'] },
    outlets: { kind: 'fixed', handles: ['video-out-0'] }
  },

  // === Network ===
  'midi.in': {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  },
  'midi.out': {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: [] }
  },
  netsend: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: [] }
  },
  netrecv: {
    inlets: { kind: 'fixed', handles: ['message-in'] },
    outlets: { kind: 'fixed', handles: ['message-out'] }
  }
};

/**
 * For "object" node type, handle IDs depend on the audio object's schema.
 * All object-type handles follow the pattern:
 *   inlet: audio-in-{N} (signal) or message-in-{N} (float/string/message/bang)
 *   outlet: audio-out-{N} (signal) or message-out-{N} (message/bang/float)
 *
 * The index N is the position in the inlet/outlet array (0-based).
 */
export const OBJECT_NODE_HANDLE_PATTERN = {
  inlets: {
    kind: 'indexed' as const,
    prefix: 'audio-in-|message-in-',
    note: 'signal→audio, others→message, indexed by position'
  },
  outlets: {
    kind: 'indexed' as const,
    prefix: 'audio-out-|message-out-',
    note: 'signal→audio, others→message, indexed by position'
  }
};

/**
 * Validate a handle ID against a node's expected handles.
 * Returns null if valid, or an error message if invalid.
 */
export function validateHandle(
  nodeType: string,
  handle: string,
  direction: 'in' | 'out'
): string | null {
  // For "object" type nodes, handles are always {audio|message}-{in|out}-{N}
  if (nodeType === 'object') {
    const pattern = direction === 'in' ? /^(audio|message)-in-\d+$/ : /^(audio|message)-out-\d+$/;
    if (pattern.test(handle)) return null;
    return `object nodes use "${direction === 'in' ? 'audio|message' : 'audio|message'}-${direction}-N" pattern, got "${handle}"`;
  }

  const spec = NODE_HANDLE_SPECS[nodeType];
  if (!spec) return `unknown node type "${nodeType}"`;

  const handleSpec = direction === 'in' ? spec.inlets : spec.outlets;

  return matchHandleToSpec(handle, handleSpec, direction);
}

function matchHandleToSpec(
  handle: string,
  spec: HandlePattern,
  direction: 'in' | 'out'
): string | null {
  return match(spec)
    .with({ kind: 'fixed' }, (s) => {
      if (s.handles.includes(handle)) return null;
      if (s.handles.length === 0)
        return `no ${direction === 'in' ? 'inlets' : 'outlets'} on this node`;
      return `expected one of [${s.handles.join(', ')}], got "${handle}"`;
    })
    .with({ kind: 'indexed' }, (s) => {
      // Check if handle starts with the prefix and ends with a number
      if (handle.startsWith(s.prefix) && /^\d+$/.test(handle.slice(s.prefix.length))) {
        return null;
      }
      // For multi-prefix (e.g., 'audio-in-|message-in-')
      const prefixes = s.prefix.split('|');
      for (const prefix of prefixes) {
        if (handle.startsWith(prefix) && /^\d+$/.test(handle.slice(prefix.length))) {
          return null;
        }
      }
      return `expected "${s.prefix}{N}" pattern, got "${handle}"`;
    })
    .with({ kind: 'dynamic' }, (s) => {
      // Dynamic patterns are more permissive — check if handle matches any known pattern
      for (const pattern of s.patterns) {
        if (matchDynamicPattern(handle, pattern)) return null;
      }
      return `doesn't match any expected pattern [${s.patterns.join(', ')}], got "${handle}". ${s.note}`;
    })
    .exhaustive();
}

function matchDynamicPattern(handle: string, pattern: string): boolean {
  // Split pattern into literal parts and placeholders, escape literals first,
  // then join with regex groups for placeholders
  const parts = pattern.split(/\{[^}]+\}/);
  const escapedParts = parts.map((p) => escapeRegex(p));
  const regexStr = escapedParts.join('[\\w.-]+');

  // If pattern had no placeholders, check the whole thing matches literally
  if (parts.length === 1) return handle === pattern;

  try {
    return new RegExp(`^${regexStr}$`).test(handle);
  } catch {
    return handle === pattern;
  }
}

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
