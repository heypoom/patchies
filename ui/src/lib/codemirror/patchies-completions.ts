import {
  CompletionContext as CMCompletionContext,
  type Completion
} from '@codemirror/autocomplete';

/**
 * Patchies API function completions for JavaScript-based nodes
 */
const patchiesAPICompletions: Completion[] = [
  // Message API
  {
    label: 'send',
    type: 'function',
    detail: '(message, options?) => void',
    info: 'Send a message to connected nodes. Options: {to: outletIndex}',
    apply: 'send()'
  },
  {
    label: 'recv',
    type: 'function',
    detail: '(callback) => void',
    info: 'Register a callback to receive messages from inlets. Callback receives (data, meta)',
    apply: 'recv((data, meta) => {\n  \n})'
  },
  {
    label: 'onMessage',
    type: 'function',
    detail: '(callback) => void',
    info: 'Alias for recv(). Register a callback to receive messages from inlets',
    apply: 'onMessage((data, meta) => {\n  \n})'
  },

  // Port Configuration
  {
    label: 'setPortCount',
    type: 'function',
    detail: '(inlets: number, outlets: number) => void',
    info: 'Set the number of message inlets and outlets for this node',
    apply: 'setPortCount(0, 1)'
  },
  {
    label: 'setAudioPortCount',
    type: 'function',
    detail: '(inlets: number, outlets: number) => void',
    info: 'Set the number of audio inlets and outlets in dsp~ nodes',
    apply: 'setAudioPortCount(0, 1)'
  },
  {
    label: 'setVideoCount',
    type: 'function',
    detail: '(inlets?: number, outlets?: number) => void',
    info: 'Set the number of video inlets and outlets. For Hydra/Three max 4 each, for Worker nodes outlets not supported.',
    apply: 'setVideoCount(1, 0)'
  },
  {
    label: 'onVideoFrame',
    type: 'function',
    detail: '(callback: (frames, timestamp) => void) => void',
    info: 'Register a callback to receive video frames from connected video inlets. Frames are ImageBitmap[] - call .close() when done!',
    apply:
      'onVideoFrame((frames, time) => {\n  // frames[0] is ImageBitmap from first video inlet\n  frames.forEach(f => f?.close())\n})'
  },
  {
    label: 'getVideoFrames',
    type: 'function',
    detail: '() => Promise<(ImageBitmap | null)[]>',
    info: 'Manually request current video frames from connected inlets. Returns array of ImageBitmaps - call .close() when done!',
    apply: 'await getVideoFrames()'
  },
  {
    label: 'setMouseScope',
    type: 'function',
    detail: "('global' | 'local') => void",
    info: "Set mouse tracking scope. 'local' (default) tracks within canvas, 'global' tracks across entire screen",
    apply: "setMouseScope('global')"
  },

  // Node Configuration
  {
    label: 'setTitle',
    type: 'function',
    detail: '(title: string) => void',
    info: 'Set the display title of this node',
    apply: 'setTitle("hello")'
  },
  {
    label: 'setRunOnMount',
    type: 'function',
    detail: '(enabled: boolean) => void',
    info: 'Set whether code should run when the patch loads',
    apply: 'setRunOnMount(true)'
  },
  {
    label: 'setKeepAlive',
    type: 'function',
    detail: '(enabled: boolean) => void',
    info: 'Keep the node running even when not connected (for dsp~ nodes)',
    apply: 'setKeepAlive(true)'
  },
  {
    label: 'setHidePorts',
    type: 'function',
    detail: '(hidden: boolean) => void',
    info: 'Hide the input/output ports on visual nodes',
    apply: 'setHidePorts(true)'
  },

  // Timing Functions
  {
    label: 'delay',
    type: 'function',
    detail: '(ms: number) => Promise<void>',
    info: 'Execute a callback after a delay',
    apply: 'delay(1000)'
  },
  {
    label: 'setInterval',
    type: 'function',
    detail: '(callback, ms) => number',
    info: 'Execute a callback repeatedly at an interval (with automatic cleanup)',
    apply: 'setInterval(() => {\n  \n}, 1000)'
  },
  {
    label: 'setTimeout',
    type: 'function',
    detail: '(callback, ms) => number',
    info: 'Execute a callback after a delay (with automatic cleanup)',
    apply: 'setTimeout(() => {\n  \n}, 1000)'
  },
  {
    label: 'requestAnimationFrame',
    type: 'function',
    detail: '(callback) => number',
    info: 'Schedule a callback for the next animation frame (with automatic cleanup)',
    apply: 'requestAnimationFrame(() => {\n  \n})'
  },

  // Lifecycle
  {
    label: 'onCleanup',
    type: 'function',
    detail: '(callback) => void',
    info: 'Register a cleanup callback that runs when the node is unmounted or code is re-executed',
    apply: 'onCleanup(() => {\n  \n})'
  },

  // Canvas/Interaction
  {
    label: 'noDrag',
    type: 'function',
    detail: '() => void',
    info: 'Disable dragging the node when interacting with the canvas',
    apply: 'noDrag()'
  },
  {
    label: 'noPan',
    type: 'function',
    detail: '() => void',
    info: 'Disable panning the canvas when interacting with the node',
    apply: 'noPan()'
  },
  {
    label: 'noWheel',
    type: 'function',
    detail: '() => void',
    info: 'Disable wheel zoom when interacting with the node',
    apply: 'noWheel()'
  },
  {
    label: 'noInteract',
    type: 'function',
    detail: '() => void',
    info: 'Disable all canvas interactions (drag, pan, wheel) - convenience for noDrag + noPan + noWheel',
    apply: 'noInteract()'
  },
  {
    label: 'noOutput',
    type: 'function',
    detail: '() => void',
    info: 'Hide the video output port in canvas nodes',
    apply: 'noOutput()'
  },
  {
    label: 'setCanvasSize',
    type: 'function',
    detail: '(width: number, height: number) => void',
    info: 'Set the canvas resolution',
    apply: 'setCanvasSize(500, 500)'
  },
  {
    label: 'onKeyDown',
    type: 'function',
    detail: '(callback: (event: KeyboardEvent) => void) => void',
    info: 'Register a callback for keyboard keydown events. Events are trapped and do not leak to xyflow.',
    apply: 'onKeyDown((e) => {\n  console.log(e.key)\n})'
  },
  {
    label: 'onKeyUp',
    type: 'function',
    detail: '(callback: (event: KeyboardEvent) => void) => void',
    info: 'Register a callback for keyboard keyup events. Events are trapped and do not leak to xyflow.',
    apply: 'onKeyUp((e) => {\n  console.log(e.key)\n})'
  },

  // Audio Analysis
  {
    label: 'fft',
    type: 'function',
    detail: '(options?) => FFTAnalysis',
    info: 'Get audio frequency analysis data. Options: {smoothing, bins}',
    apply: 'fft().a'
  },

  // Module Loading
  {
    label: 'esm',
    type: 'function',
    detail: '(moduleName: string) => Promise<Module>',
    info: 'Load ES modules from esm.sh (use with top-level await). Example: await esm("lodash")',
    apply: 'esm("lodash")'
  },

  // VFS
  {
    label: 'getVfsUrl',
    type: 'function',
    detail: '(path: string) => Promise<string>',
    info: 'Resolve a VFS path (user://, obj://) to an object URL. Regular URLs pass through unchanged.',
    apply: "getVfsUrl('user://')"
  },

  // Console
  {
    label: 'console.log',
    type: 'function',
    detail: '(...data) => void',
    info: 'Log messages to the virtual console (not browser console)',
    apply: 'console.log()'
  },

  // Visual Feedback
  {
    label: 'flash',
    type: 'function',
    detail: '() => void',
    info: 'Flash the node border to indicate activity',
    apply: 'flash()'
  },

  // Storage
  {
    label: 'kv',
    type: 'variable',
    detail: 'KVStore',
    info: 'Persistent key-value storage. Methods: store(name), get(key), set(key, value), delete(key), keys(), clear(), has(key)',
    apply: 'kv'
  }
];

// Setup functions that should only appear at top-level (not in function bodies)
const topLevelOnlyFunctions = new Set([
  'noDrag',
  'noInteract',
  'noOutput',
  'noPan',
  'noWheel',
  'onCleanup',
  'onKeyDown',
  'onKeyUp',
  'onMessage',
  'onVideoFrame',
  'recv',
  'setAudioPortCount',
  'setCanvasSize',
  'setHidePorts',
  'setKeepAlive',
  'setMouseScope',
  'setPortCount',
  'setRunOnMount',
  'setVideoCount'
]);

const MOUSE_INTERACTION_JS_NODES = [
  'p5',
  'canvas',
  'canvas.dom',
  'textmode',
  'textmode.dom',
  'three',
  'three.dom',
  'vue',
  'dom'
];

// Node-specific functions - only show in certain node types
//
// Note on JSRunner defaults (main-thread nodes):
// JSRunner.executeJavaScript() provides these by default for main-thread nodes:
//   console, send, onMessage/recv, setInterval, setTimeout, requestAnimationFrame,
//   fft, llm, setPortCount, setRunOnMount, setTitle, setHidePorts, getVfsUrl
//
// Worker nodes (hydra, canvas, textmode, three, swgl) must provide their own
// implementations via extraContext since JSRunner defaults are for main thread.
const nodeSpecificFunctions: Record<string, string[]> = {
  onCleanup: [
    'js',
    'worker',
    'p5',
    'hydra',
    'canvas',
    'canvas.dom',
    'textmode',
    'textmode.dom',
    'three',
    'three.dom',
    'dom',
    'vue',
    'tone~',
    'elem~',
    'sonic~'
  ],
  fft: [
    'js',
    'worker',
    'p5',
    'hydra',
    'canvas',
    'canvas.dom',
    'swgl',
    'textmode',
    'textmode.dom',
    'three',
    'three.dom',
    'tone~'
  ],
  noDrag: MOUSE_INTERACTION_JS_NODES,
  noPan: MOUSE_INTERACTION_JS_NODES,
  noWheel: MOUSE_INTERACTION_JS_NODES,
  noInteract: MOUSE_INTERACTION_JS_NODES,
  noOutput: ['p5', 'canvas', 'canvas.dom', 'textmode', 'textmode.dom', 'three', 'three.dom'],
  onKeyDown: ['canvas.dom', 'three.dom'],
  onKeyUp: ['canvas.dom', 'three.dom'],
  setAudioPortCount: ['dsp~'],
  setCanvasSize: ['canvas.dom', 'textmode.dom', 'three.dom'],
  setHidePorts: [
    'p5',
    'hydra',
    'canvas',
    'canvas.dom',
    'swgl',
    'textmode',
    'textmode.dom',
    'three',
    'three.dom'
  ],
  setKeepAlive: ['dsp~'],
  setMouseScope: ['hydra'],
  setRunOnMount: ['js', 'worker'],
  kv: ['js', 'worker', 'p5'],
  'kv.get': ['js', 'worker', 'p5'],
  'kv.set': ['js', 'worker', 'p5'],
  'kv.delete': ['js', 'worker', 'p5'],
  'kv.keys': ['js', 'worker', 'p5'],
  'kv.has': ['js', 'worker', 'p5'],
  'kv.store': ['js', 'worker', 'p5'],
  setTitle: [
    'js',
    'worker',
    'p5',
    'hydra',
    'canvas',
    'canvas.dom',
    'dsp~',
    'elem~',
    'tone~',
    'sonic~',
    'textmode',
    'textmode.dom',
    'three',
    'three.dom'
  ],
  setVideoCount: ['hydra', 'three', 'worker'],
  onVideoFrame: ['worker'],
  getVideoFrames: ['worker'],
  getVfsUrl: [
    'js',
    'worker',
    'p5',
    'hydra',
    'canvas',
    'canvas.dom',
    'textmode',
    'textmode.dom',
    'three',
    'three.dom',
    'tone~',
    'sonic~',
    'elem~'
  ],
  flash: ['js', 'worker']
};

export interface PatchiesContext {
  nodeType?: string;
}

/**
 * Check if cursor is inside a function body by counting braces
 */
function isInsideFunctionBody(text: string): boolean {
  // Look for function patterns followed by opening brace
  const functionPatterns = [
    /\bfunction\s*\w*\s*\([^)]*\)\s*\{/g,
    /\([^)]*\)\s*=>\s*\{/g, // arrow functions with braces
    /\w+\s*\([^)]*\)\s*\{/g // method definitions
  ];

  let braceDepth = 0;
  let inFunctionBody = false;

  // Find all function starts and track brace depth
  for (const pattern of functionPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      inFunctionBody = true;
      break;
    }
  }

  if (!inFunctionBody) return false;

  // Count braces to see if we're still inside
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') braceDepth++;
    if (text[i] === '}') braceDepth--;
  }

  return braceDepth > 0;
}

/**
 * Custom completion source for Patchies API functions
 */
function createPatchiesCompletionSource(patchiesContext?: PatchiesContext) {
  return (context: CMCompletionContext) => {
    if (patchiesContext?.nodeType === 'expr') return null;

    const word = context.matchBefore(/\w*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;

    // Get the line we're on to check for comments
    const line = context.state.doc.lineAt(context.pos);
    const lineText = line.text;
    const posInLine = context.pos - line.from;

    // Don't complete inside comments
    const commentStart = lineText.indexOf('//');
    if (commentStart !== -1 && posInLine > commentStart) {
      return null;
    }

    // Don't complete inside block comments
    const textBefore = context.state.doc.sliceString(Math.max(0, word.from - 100), word.from);
    const lastBlockCommentStart = textBefore.lastIndexOf('/*');
    const lastBlockCommentEnd = textBefore.lastIndexOf('*/');
    if (lastBlockCommentStart > lastBlockCommentEnd) {
      return null;
    }

    // Check the text before the word to avoid inappropriate contexts
    const recentTextBefore = context.state.doc.sliceString(Math.max(0, word.from - 20), word.from);

    // Don't complete after keywords where function names are expected
    if (/\b(function|class|const|let|var|interface|type|enum)\s+$/.test(recentTextBefore)) {
      return null;
    }

    // Don't complete in object property definitions (key: value)
    if (/:\s*$/.test(recentTextBefore)) {
      return null;
    }

    // Check if we're inside a function body - look at more context
    const allTextBefore = context.state.doc.sliceString(0, word.from);
    const insideFunction = isInsideFunctionBody(allTextBefore);

    // Filter completions based on context
    let options = patchiesAPICompletions;

    // Filter out top-level only functions when inside a function body
    if (insideFunction) {
      options = options.filter((completion) => !topLevelOnlyFunctions.has(completion.label));
    }

    // Filter based on node type
    if (patchiesContext?.nodeType) {
      options = options.filter((completion) => {
        const allowedNodes = nodeSpecificFunctions[completion.label];

        // If function has node restrictions, check if current node is allowed
        if (allowedNodes) {
          return allowedNodes.includes(patchiesContext.nodeType!);
        }

        // No restrictions, always show
        return true;
      });
    }

    // Filter by prefix match only (not substring) - "quan" shouldn't match "requestAnimationFrame"
    const typedText = context.state.doc.sliceString(word.from, word.to).toLowerCase();
    if (typedText) {
      options = options.filter((completion) =>
        completion.label.toLowerCase().startsWith(typedText)
      );
    }

    return {
      from: word.from,
      options
    };
  };
}

/**
 * CodeMirror extension that provides Patchies API completions
 * @param context Optional context with node type information
 */
export const patchiesCompletions = (context?: PatchiesContext) =>
  createPatchiesCompletionSource(context);
