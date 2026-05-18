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
    apply: 'setPortCount(1, 0)'
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
    label: 'getTexture',
    type: 'function',
    detail: '(index: number) => Texture',
    info: 'Get the texture from a video inlet by index. Returns a fallback texture when the inlet is not connected.',
    apply: 'getTexture(0)'
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
    apply: "setTitle('hello')"
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
  {
    label: 'setTextureFormat',
    type: 'function',
    detail: "('rgba8' | 'rgba16f' | 'rgba32f') => void",
    info: 'Set output FBO texture format. Use rgba32f for unclamped float data (GPGPU, HDR).',
    apply: "setTextureFormat('rgba32f')"
  },
  {
    label: 'setResolution',
    type: 'function',
    detail: '(widthOrPreset: number | string, height?: number) => void',
    info: "Set output FBO resolution. Pass a number for square (256), two numbers for rectangular (512, 256), or a string fraction ('1/2', '1/4').",
    apply: 'setResolution(256)'
  },
  {
    label: 'setPrimaryButton',
    type: 'function',
    detail: "('code' | 'settings' | 'run') => void",
    info: "Choose which button is shown as the primary action next to the overflow menu. Useful for code-stable nodes where settings or run is the action you reach for most. Note: 'run' falls back to 'code' on js/worker nodes since the entire node body is already a Run/Stop button.",
    apply: "setPrimaryButton('settings')"
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
  {
    label: 'focusObjects',
    type: 'function',
    detail: '(options: FitViewOptions) => void',
    info: 'Pan and zoom the canvas using fitView options, e.g. { nodes: [{ id: "node-1" }], duration: 500, padding: 0.3 }',
    apply: 'focusObjects()'
  },
  {
    label: 'pauseObject',
    type: 'function',
    detail: '(id: string) => void',
    info: 'Pause a node by ID (works on visual nodes, MediaPipe, and any node that supports pausing)',
    apply: 'pauseObject()'
  },
  {
    label: 'unpauseObject',
    type: 'function',
    detail: '(id: string) => void',
    info: 'Unpause a node by ID',
    apply: 'unpauseObject()'
  },
  {
    label: 'setBackgroundOutput',
    type: 'function',
    detail: '(id: string | null) => void',
    info: 'Set the background output to a node by ID, or pass null to clear',
    apply: 'setBackgroundOutput()'
  },
  // Storage
  {
    label: 'kv',
    type: 'variable',
    detail: 'KVStore',
    info: 'Persistent key-value storage. Type kv. to see available methods.',
    apply: 'kv'
  },

  // Settings API
  {
    label: 'settings',
    type: 'variable',
    detail: 'SettingsAPI',
    info: 'Dynamic settings API. Call settings.define([...]) to expose a configurable settings panel for this node.',
    apply: 'settings'
  },

  // Clock API
  {
    label: 'clock',
    type: 'variable',
    detail: 'ClockAPI',
    info: 'Beat-synced timing and scheduling. Type clock. to see available properties and methods.',
    apply: 'clock'
  },

  // SuperSonic
  {
    label: 'getSuperSonicChannel',
    type: 'function',
    detail: '() => Promise<{ channel, osc? }>',
    info: 'Get a SuperSonic OscChannel for sending OSC messages directly to scsynth. In workers, also returns osc encoder. In dsp~, returns channel only. Lazy-loads SuperSonic on first call.',
    apply: 'getSuperSonicChannel()'
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
  'setPrimaryButton',
  'setResolution',
  'setRunOnMount',
  'setTextureFormat',
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
    'regl',
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
  noOutput: [
    'p5',
    'canvas',
    'canvas.dom',
    'regl',
    'textmode',
    'textmode.dom',
    'three',
    'three.dom'
  ],
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
    'regl',
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
    'regl',
    'dsp~',
    'elem~',
    'tone~',
    'sonic~',
    'textmode',
    'textmode.dom',
    'three',
    'three.dom'
  ],
  setTextureFormat: ['hydra', 'canvas', 'three', 'regl', 'swgl', 'textmode'],
  setResolution: ['hydra', 'canvas', 'three', 'regl', 'swgl', 'textmode'],
  setPrimaryButton: ['js', 'worker', 'p5', 'hydra', 'canvas', 'regl', 'swgl', 'textmode', 'three'],
  setVideoCount: ['hydra', 'regl', 'swgl', 'three', 'worker'],
  getTexture: ['hydra', 'regl', 'swgl', 'three'],
  onVideoFrame: ['worker'],
  getVideoFrames: ['worker'],
  getVfsUrl: [
    'js',
    'worker',
    'p5',
    'hydra',
    'canvas',
    'canvas.dom',
    'regl',
    'textmode',
    'textmode.dom',
    'three',
    'three.dom',
    'tone~',
    'sonic~',
    'elem~'
  ],
  flash: ['js', 'worker'],
  focusObjects: ['js'],
  setBackgroundOutput: ['js'],
  pauseObject: ['js'],
  unpauseObject: ['js'],
  settings: [
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
    'vue'
  ],
  clock: [
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
    'vue'
  ],
  getSuperSonicChannel: ['worker', 'dsp~']
};

/**
 * Member completions for global objects (shown after `obj.`)
 */
const memberCompletions: Record<string, Completion[]> = {
  kv: [
    {
      label: 'get',
      type: 'method',
      detail: '(key: string) => Promise<any>',
      info: 'Get value by key. Returns undefined if not found.',
      apply: "get('')"
    },
    {
      label: 'set',
      type: 'method',
      detail: '(key: string, value: any) => Promise<void>',
      info: 'Set value at key.',
      apply: "set('', )"
    },
    {
      label: 'has',
      type: 'method',
      detail: '(key: string) => Promise<boolean>',
      info: 'Check if key exists.',
      apply: "has('')"
    },
    {
      label: 'delete',
      type: 'method',
      detail: '(key: string) => Promise<boolean>',
      info: 'Delete key. Returns true if it existed.',
      apply: "delete('')"
    },
    {
      label: 'keys',
      type: 'method',
      detail: '() => Promise<string[]>',
      info: 'Get all keys in the store.',
      apply: 'keys()'
    },
    {
      label: 'clear',
      type: 'method',
      detail: '() => Promise<void>',
      info: 'Delete all keys in the store.',
      apply: 'clear()'
    },
    {
      label: 'store',
      type: 'method',
      detail: '(name: string) => KVStore',
      info: 'Get a named store shared across all nodes using the same name.',
      apply: "store('')"
    }
  ],

  clock: [
    // Properties
    {
      label: 'time',
      type: 'property',
      detail: 'number',
      info: 'Current time in seconds.',
      apply: 'time'
    },
    {
      label: 'ticks',
      type: 'property',
      detail: 'number',
      info: 'Current time in ticks (192 PPQ).',
      apply: 'ticks'
    },
    {
      label: 'beat',
      type: 'property',
      detail: 'number',
      info: 'Current beat in measure (0 to beatsPerBar-1).',
      apply: 'beat'
    },
    {
      label: 'phase',
      type: 'property',
      detail: 'number',
      info: 'Position within current beat (0.0 to 1.0).',
      apply: 'phase'
    },
    {
      label: 'bpm',
      type: 'property',
      detail: 'number',
      info: 'Current tempo in BPM.',
      apply: 'bpm'
    },
    {
      label: 'bar',
      type: 'property',
      detail: 'number',
      info: 'Current bar (0-indexed).',
      apply: 'bar'
    },
    {
      label: 'beatsPerBar',
      type: 'property',
      detail: 'number',
      info: 'Beats per bar (default: 4).',
      apply: 'beatsPerBar'
    },
    {
      label: 'timeSignature',
      type: 'property',
      detail: '[number, number]',
      info: 'Time signature as [numerator, denominator]. E.g. [6, 8] is 6/8.',
      apply: 'timeSignature'
    },
    // Transport control
    {
      label: 'play',
      type: 'method',
      detail: '() => void',
      info: 'Start transport.',
      apply: 'play()'
    },
    {
      label: 'pause',
      type: 'method',
      detail: '() => void',
      info: 'Pause transport.',
      apply: 'pause()'
    },
    {
      label: 'stop',
      type: 'method',
      detail: '() => void',
      info: 'Stop and reset to 0.',
      apply: 'stop()'
    },
    {
      label: 'setBpm',
      type: 'method',
      detail: '(bpm: number) => void',
      info: 'Set tempo in BPM.',
      apply: 'setBpm(120)'
    },
    {
      label: 'setTimeSignature',
      type: 'method',
      detail: '(numerator: number, denominator: number) => void',
      info: 'Set time signature. E.g. setTimeSignature(6, 8) for 6/8.',
      apply: 'setTimeSignature(4, 4)'
    },
    {
      label: 'seek',
      type: 'method',
      detail: '(seconds: number) => void',
      info: 'Seek to time in seconds.',
      apply: 'seek(0)'
    },
    // Scheduling
    {
      label: 'onBeat',
      type: 'method',
      detail: "(beat: number | number[] | '*', callback, options?) => id",
      info: "Subscribe to beat changes. beat can be index, array of indices, or '*' for every beat.",
      apply: 'onBeat(0, () => {\n  \n})'
    },
    {
      label: 'every',
      type: 'method',
      detail: "('bar:beat:sixteenth', callback, options?) => id",
      info: "Schedule a repeating callback at a musical interval. E.g. '1:0:0' = every bar, '0:1:0' = every beat.",
      apply: "every('0:1:0', () => {\n  \n})"
    },
    {
      label: 'schedule',
      type: 'method',
      detail: '(time: number | string, callback, options?) => id',
      info: "Schedule a one-shot callback. Accepts seconds or 'bar:beat:sixteenth' notation (zero-indexed).",
      apply: "schedule('4:0:0', () => {\n  \n})"
    },
    {
      label: 'cancel',
      type: 'method',
      detail: '(id) => void',
      info: 'Cancel a specific scheduled callback by its ID.',
      apply: 'cancel()'
    },
    {
      label: 'cancelAll',
      type: 'method',
      detail: '() => void',
      info: 'Cancel all scheduled callbacks.',
      apply: 'cancelAll()'
    },
    // Subdivisions
    {
      label: 'subdiv',
      type: 'method',
      detail: '(n: number) => number',
      info: 'Current subdivision index (0 to n-1) within the beat. Each node can use its own subdivision.',
      apply: 'subdiv(4)'
    },
    {
      label: 'subdivPhase',
      type: 'method',
      detail: '(n: number) => number',
      info: 'Progress within current subdivision (0.0 to 1.0).',
      apply: 'subdivPhase(4)'
    },
    {
      label: 'setTimelineStyle',
      type: 'method',
      detail: '(options: { color?: string, visible?: boolean }) => void',
      info: 'Customize how this node appears in the Timeline Viewer.',
      apply: "setTimelineStyle({ color: '#ff6b6b' })"
    }
  ],

  settings: [
    {
      label: 'define',
      type: 'method',
      detail: '(schema: FieldDef[]) => Promise<void>',
      info: 'Define the settings schema and open the settings panel. Always await this before calling get().',
      apply: 'define([\n  \n])'
    },
    {
      label: 'get',
      type: 'method',
      detail: '(key: string) => any',
      info: 'Get current value for a field. Synchronous after define() has resolved.',
      apply: "get('')"
    },
    {
      label: 'getAll',
      type: 'method',
      detail: '() => Record<string, any>',
      info: 'Get all current values as a plain object.',
      apply: 'getAll()'
    },
    {
      label: 'set',
      type: 'method',
      detail: '(key: string, value: any) => void',
      info: 'Programmatically update a setting value. Fires onChange callbacks and persists the value.',
      apply: "set('', )"
    },
    {
      label: 'onChange',
      type: 'method',
      detail: '(callback: (key, value, allValues) => void) => void',
      info: 'Register a callback that fires whenever any value changes from user interaction or settings.set().',
      apply: 'onChange((key, value, all) => {\n  \n})'
    },
    {
      label: 'clear',
      type: 'method',
      detail: '() => void',
      info: 'Reset all settings to defaults and clear persisted values.',
      apply: 'clear()'
    }
  ]
};

export interface PatchiesContext {
  nodeType?: string;
}

const PATCHIES_COMPLETION_DISABLED_NODE_TYPES = new Set(['shaderpark']);
const SHADERPARK_NODE_TYPE = 'shaderpark';

const shaderParkCompletionInfo: Record<string, string> = {
  union: 'Combine following geometry by union.',
  difference: 'Subtract following geometry from the shape.',
  intersect: 'Keep only overlapping geometry.',
  blend: 'Softly blend the next geometry operation.',
  mixGeo: 'Mix between geometry operations.',
  getSpace: 'Read the current transformed 3D space.',
  shape: 'Group geometry in a nested shape callback.',
  setSDF: 'Set the current signed-distance value.',
  reset: 'Reset the current shape state.',
  displace: 'Move the current space by x, y, z.',
  setSpace: 'Replace the current transformed space.',
  repeat: 'Repeat space at a regular interval.',
  rotateX: 'Rotate space around the X axis.',
  rotateY: 'Rotate space around the Y axis.',
  rotateZ: 'Rotate space around the Z axis.',
  mirrorX: 'Mirror space across the X axis.',
  mirrorY: 'Mirror space across the Y axis.',
  mirrorZ: 'Mirror space across the Z axis.',
  mirrorXYZ: 'Mirror space across all axes.',
  flipX: 'Flip space along the X axis.',
  flipY: 'Flip space along the Y axis.',
  flipZ: 'Flip space along the Z axis.',
  expand: 'Expand or shrink the current SDF.',
  shell: 'Turn the current SDF into a shell.',
  color: 'Set the material color.',
  metal: 'Set material metallic amount.',
  shine: 'Set material shine or roughness.',
  lightDirection: 'Set the scene light direction.',
  backgroundColor: 'Set the render background color.',
  noLighting: 'Render material color without lighting.',
  occlusion: 'Set ambient occlusion amount.',
  setStepSize: 'Set raymarching step size.',
  setGeometryQuality: 'Set geometry quality multiplier.',
  setMaxIterations: 'Set raymarching iteration limit.',
  input: 'Create a persistent numeric setting.',
  input2D: 'Create a persistent 2D setting.',
  vec2: 'Create a two-component vector.',
  vec3: 'Create a three-component vector.',
  vec4: 'Create a four-component vector.',
  mouseIntersection: 'Get the ray intersection from mouse input.',
  getRayDirection: 'Get the current ray direction.',
  getPixelCoord: 'Get the current pixel coordinate.',
  getResolution: 'Get the current render resolution.',
  get2DCoords: 'Get normalized 2D coordinates.',
  enable2D: 'Switch the sculpture to 2D coordinates.',
  getSpherical: 'Read the current space in spherical coordinates.',
  glslFunc: 'Bind a GLSL helper function.',
  glslFuncES3: 'Bind a GLSL ES 3 helper function.',
  glslSDF: 'Bind a GLSL SDF helper.',
  mix: 'Interpolate between two values.',
  nsin: 'Normalized sine, mapped to 0..1.',
  ncos: 'Normalized cosine, mapped to 0..1.',
  round: 'Round a float value.',
  hsv2rgb: 'Convert HSV color to RGB.',
  rgb2hsv: 'Convert RGB color to HSV.',
  rotateVec: 'Rotate a vector around an axis.',
  toSpherical: 'Convert a vector to spherical coordinates.',
  fromSpherical: 'Convert spherical coordinates to a vector.',
  osc: 'Oscillating Shader Park math helper.',
  _hash33: 'Hash a vec3 to a vec3.',
  _hash13: 'Hash a vec3 to a float.',
  noise: 'Sample Shader Park noise.',
  fractalNoise: 'Sample layered Shader Park noise.',
  sphericalDistribution: 'Generate a spherical distribution vector.',
  sin: 'GLSL sine helper.',
  cos: 'GLSL cosine helper.',
  tan: 'GLSL tangent helper.',
  asin: 'GLSL arcsine helper.',
  acos: 'GLSL arccosine helper.',
  exp: 'GLSL exponential helper.',
  log: 'GLSL natural log helper.',
  exp2: 'GLSL base-2 exponential helper.',
  log2: 'GLSL base-2 log helper.',
  sqrt: 'GLSL square root helper.',
  inversesqrt: 'GLSL inverse square root helper.',
  abs: 'GLSL absolute value helper.',
  sign: 'GLSL sign helper.',
  floor: 'GLSL floor helper.',
  ceil: 'GLSL ceiling helper.',
  fract: 'GLSL fractional part helper.',
  pow: 'GLSL power helper.',
  mod: 'GLSL modulo helper.',
  min: 'GLSL minimum helper.',
  max: 'GLSL maximum helper.',
  atan: 'GLSL arctangent helper.',
  clamp: 'GLSL clamp helper.',
  step: 'GLSL step helper.',
  smoothstep: 'GLSL smooth interpolation helper.',
  length: 'GLSL vector length helper.',
  distance: 'GLSL vector distance helper.',
  dot: 'GLSL dot product helper.',
  cross: 'GLSL cross product helper.',
  normalize: 'GLSL vector normalize helper.',
  reflect: 'GLSL vector reflection helper.',
  refract: 'GLSL vector refraction helper.'
};

const rawShaderParkCompletions: Completion[] = [
  // Uniforms and constants
  { label: 'time', type: 'variable', detail: 'float', info: 'Elapsed Shader Park time.' },
  {
    label: 'mouse',
    type: 'variable',
    detail: 'vec3',
    info: 'Normalized Shader Park mouse coordinates.'
  },
  { label: 'opacity', type: 'variable', detail: 'float', info: 'Output opacity uniform.' },
  { label: 'stepSize', type: 'variable', detail: 'float', info: 'Raymarching step size uniform.' },
  { label: 'resolution', type: 'variable', detail: 'vec2', info: 'Render resolution uniform.' },
  { label: 'PI', type: 'constant', detail: 'float', info: 'Pi constant.' },
  { label: 'TWO_PI', type: 'constant', detail: 'float', info: 'Two pi constant.' },
  { label: 'TAU', type: 'constant', detail: 'float', info: 'Tau constant.' },
  {
    label: 'iChannel0',
    type: 'variable',
    detail: 'sampler2D',
    info: 'Texture from video inlet 0 when referenced from GLSL helper code.'
  },
  {
    label: 'iChannel1',
    type: 'variable',
    detail: 'sampler2D',
    info: 'Texture from video inlet 1 when referenced from GLSL helper code.'
  },
  {
    label: 'iChannel2',
    type: 'variable',
    detail: 'sampler2D',
    info: 'Texture from video inlet 2 when referenced from GLSL helper code.'
  },
  {
    label: 'iChannel3',
    type: 'variable',
    detail: 'sampler2D',
    info: 'Texture from video inlet 3 when referenced from GLSL helper code.'
  },

  // Geometry
  {
    label: 'sphere',
    type: 'function',
    detail: '(radius: float) => void',
    info: 'Add a sphere SDF to the current shape.',
    apply: 'sphere(0.5)'
  },
  {
    label: 'line',
    type: 'function',
    detail: '(a: vec3, b: vec3, radius: float) => void',
    info: 'Add a rounded line segment between two points.',
    apply: 'line(vec3(-0.5, 0, 0), vec3(0.5, 0, 0), 0.05)'
  },
  {
    label: 'cone',
    type: 'function',
    detail: '(size: vec2) => void',
    info: 'Add a cone SDF.',
    apply: 'cone(vec2(0.5, 1.0))'
  },
  {
    label: 'roundCone',
    type: 'function',
    detail: '(a: vec3, b: vec3, r1: float, r2: float) => void',
    info: 'Add a rounded cone between two points.',
    apply: 'roundCone(vec3(0, -0.5, 0), vec3(0, 0.5, 0), 0.3, 0.1)'
  },
  {
    label: 'plane',
    type: 'function',
    detail: '(x: float, y: float, z: float, w: float) => void',
    info: 'Add a plane SDF.',
    apply: 'plane(0, 1, 0, 0)'
  },
  {
    label: 'box',
    type: 'function',
    detail: '(size: vec3) => void',
    info: 'Add a box SDF. Also accepts x, y, z scalar sizes.',
    apply: 'box(vec3(0.5))'
  },
  {
    label: 'torus',
    type: 'function',
    detail: '(size: vec2) => void',
    info: 'Add a torus SDF. Also accepts major and minor scalar radii.',
    apply: 'torus(vec2(0.5, 0.1))'
  },
  {
    label: 'cylinder',
    type: 'function',
    detail: '(size: vec2) => void',
    info: 'Add a cylinder SDF. Also accepts radius and height scalar values.',
    apply: 'cylinder(vec2(0.35, 1.0))'
  },
  {
    label: 'boxFrame',
    type: 'function',
    detail: '(...) => void',
    info: 'Shader Park SDF helper from shader-park-core.',
    apply: 'boxFrame()'
  },
  {
    label: 'link',
    type: 'function',
    detail: '(...) => void',
    info: 'Shader Park SDF helper from shader-park-core.',
    apply: 'link()'
  },
  {
    label: 'cappedTorus',
    type: 'function',
    detail: '(...) => void',
    info: 'Shader Park SDF helper from shader-park-core.',
    apply: 'cappedTorus()'
  },

  // Shape composition and transforms
  { label: 'union', type: 'function', detail: '() => void', apply: 'union()' },
  { label: 'difference', type: 'function', detail: '() => void', apply: 'difference()' },
  { label: 'intersect', type: 'function', detail: '() => void', apply: 'intersect()' },
  { label: 'blend', type: 'function', detail: '(amount: float) => void', apply: 'blend(0.2)' },
  { label: 'mixGeo', type: 'function', detail: '(amount: float) => void', apply: 'mixGeo(0.5)' },
  { label: 'getSpace', type: 'function', detail: '() => vec3', apply: 'getSpace()' },
  {
    label: 'shape',
    type: 'function',
    detail: '(callback: () => void) => void',
    apply: 'shape(() => {\n  \n})'
  },
  { label: 'setSDF', type: 'function', detail: '(sdf: float) => void', apply: 'setSDF()' },
  { label: 'reset', type: 'function', detail: '() => void', apply: 'reset()' },
  {
    label: 'displace',
    type: 'function',
    detail: '(x: float, y: float, z: float) => void',
    apply: 'displace(0, 0, 0)'
  },
  { label: 'setSpace', type: 'function', detail: '(space: vec3) => void', apply: 'setSpace()' },
  {
    label: 'repeat',
    type: 'function',
    detail: '(spacing: float | vec3) => void',
    apply: 'repeat(1.0)'
  },
  { label: 'rotateX', type: 'function', detail: '(angle: float) => void', apply: 'rotateX(time)' },
  { label: 'rotateY', type: 'function', detail: '(angle: float) => void', apply: 'rotateY(time)' },
  { label: 'rotateZ', type: 'function', detail: '(angle: float) => void', apply: 'rotateZ(time)' },
  { label: 'mirrorX', type: 'function', detail: '() => void', apply: 'mirrorX()' },
  { label: 'mirrorY', type: 'function', detail: '() => void', apply: 'mirrorY()' },
  { label: 'mirrorZ', type: 'function', detail: '() => void', apply: 'mirrorZ()' },
  { label: 'mirrorXYZ', type: 'function', detail: '() => void', apply: 'mirrorXYZ()' },
  { label: 'flipX', type: 'function', detail: '() => void', apply: 'flipX()' },
  { label: 'flipY', type: 'function', detail: '() => void', apply: 'flipY()' },
  { label: 'flipZ', type: 'function', detail: '() => void', apply: 'flipZ()' },
  { label: 'expand', type: 'function', detail: '(amount: float) => void', apply: 'expand(0.1)' },
  { label: 'shell', type: 'function', detail: '(thickness: float) => void', apply: 'shell(0.05)' },

  // Materials and render controls
  {
    label: 'color',
    type: 'function',
    detail: '(r: float, g: float, b: float) => void',
    apply: 'color(1, 1, 1)'
  },
  { label: 'metal', type: 'function', detail: '(amount: float) => void', apply: 'metal(0.5)' },
  { label: 'shine', type: 'function', detail: '(amount: float) => void', apply: 'shine(0.8)' },
  {
    label: 'lightDirection',
    type: 'function',
    detail: '(x: float, y: float, z: float) => void',
    apply: 'lightDirection(0, 1, 0)'
  },
  {
    label: 'backgroundColor',
    type: 'function',
    detail: '(r: float, g: float, b: float) => void',
    apply: 'backgroundColor(0, 0, 0)'
  },
  { label: 'noLighting', type: 'function', detail: '() => void', apply: 'noLighting()' },
  {
    label: 'occlusion',
    type: 'function',
    detail: '(amount: float) => void',
    apply: 'occlusion(0.5)'
  },
  {
    label: 'setStepSize',
    type: 'function',
    detail: '(size: float) => void',
    apply: 'setStepSize(0.85)'
  },
  {
    label: 'setGeometryQuality',
    type: 'function',
    detail: '(quality: float) => void',
    apply: 'setGeometryQuality(1)'
  },
  {
    label: 'setMaxIterations',
    type: 'function',
    detail: '(count: number) => void',
    apply: 'setMaxIterations(300)'
  },

  // Inputs, vectors, coordinates, and GLSL helpers
  {
    label: 'input',
    type: 'function',
    detail: '(value: number, min?: number, max?: number) => number',
    apply: 'input(0.5, 0, 1)'
  },
  {
    label: 'input2D',
    type: 'function',
    detail: '(x: number, y: number) => vec2-like setting',
    apply: 'input2D(0, 0)'
  },
  { label: 'vec2', type: 'function', detail: '(x: float, y?: float) => vec2', apply: 'vec2(0)' },
  {
    label: 'vec3',
    type: 'function',
    detail: '(x: float, y?: float, z?: float) => vec3',
    apply: 'vec3(0)'
  },
  {
    label: 'vec4',
    type: 'function',
    detail: '(x: float, y?: float, z?: float, w?: float) => vec4',
    apply: 'vec4(0)'
  },
  {
    label: 'mouseIntersection',
    type: 'function',
    detail: '() => vec3',
    apply: 'mouseIntersection()'
  },
  { label: 'getRayDirection', type: 'function', detail: '() => vec3', apply: 'getRayDirection()' },
  { label: 'getPixelCoord', type: 'function', detail: '() => vec2', apply: 'getPixelCoord()' },
  { label: 'getResolution', type: 'function', detail: '() => vec2', apply: 'getResolution()' },
  { label: 'get2DCoords', type: 'function', detail: '() => vec2', apply: 'get2DCoords()' },
  { label: 'enable2D', type: 'function', detail: '() => void', apply: 'enable2D()' },
  { label: 'getSpherical', type: 'function', detail: '() => vec3', apply: 'getSpherical()' },
  {
    label: 'glslFunc',
    type: 'function',
    detail: '(source: string) => Function',
    apply: 'glslFunc(`\n\n`)'
  },
  {
    label: 'glslFuncES3',
    type: 'function',
    detail: '(source: string) => Function',
    apply: 'glslFuncES3(`\n\n`)'
  },
  {
    label: 'glslSDF',
    type: 'function',
    detail: '(source: string) => Function',
    apply: 'glslSDF(`\n\n`)'
  },

  // Math
  { label: 'mix', type: 'function', detail: '(a, b, amount) => value', apply: 'mix(0, 1, 0.5)' },
  { label: 'nsin', type: 'function', detail: '(value: float) => float', apply: 'nsin(time)' },
  { label: 'ncos', type: 'function', detail: '(value: float) => float', apply: 'ncos(time)' },
  { label: 'round', type: 'function', detail: '(value: float) => float', apply: 'round()' },
  {
    label: 'hsv2rgb',
    type: 'function',
    detail: '(color: vec3) => vec3',
    apply: 'hsv2rgb(vec3(0, 1, 1))'
  },
  {
    label: 'rgb2hsv',
    type: 'function',
    detail: '(color: vec3) => vec3',
    apply: 'rgb2hsv(vec3(1, 1, 1))'
  },
  {
    label: 'rotateVec',
    type: 'function',
    detail: '(value: vec3, axis: vec3, angle: float) => vec3',
    apply: 'rotateVec(getSpace(), vec3(0, 1, 0), time)'
  },
  {
    label: 'toSpherical',
    type: 'function',
    detail: '(value: vec3) => vec3',
    apply: 'toSpherical(getSpace())'
  },
  {
    label: 'fromSpherical',
    type: 'function',
    detail: '(value: vec3) => vec3',
    apply: 'fromSpherical()'
  },
  { label: 'osc', type: 'function', detail: '(value: float) => float', apply: 'osc(time)' },
  {
    label: '_hash33',
    type: 'function',
    detail: '(value: vec3) => vec3',
    apply: '_hash33(getSpace())'
  },
  {
    label: '_hash13',
    type: 'function',
    detail: '(value: vec3) => float',
    apply: '_hash13(getSpace())'
  },
  {
    label: 'noise',
    type: 'function',
    detail: '(value: vec3) => float',
    apply: 'noise(getSpace())'
  },
  {
    label: 'fractalNoise',
    type: 'function',
    detail: '(value: vec3) => float',
    apply: 'fractalNoise(getSpace())'
  },
  {
    label: 'sphericalDistribution',
    type: 'function',
    detail: '(value: vec3, amount: float) => vec4',
    apply: 'sphericalDistribution(getSpace(), 1)'
  },
  ...[
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'exp',
    'log',
    'exp2',
    'log2',
    'sqrt',
    'inversesqrt',
    'abs',
    'sign',
    'floor',
    'ceil',
    'fract',
    'pow',
    'mod',
    'min',
    'max',
    'atan',
    'clamp',
    'step',
    'smoothstep',
    'length',
    'distance',
    'dot',
    'cross',
    'normalize',
    'reflect',
    'refract'
  ].map((label) => ({
    label,
    type: 'function',
    detail: 'GLSL-style math helper',
    apply: `${label}()`
  }))
];

const shaderParkCompletions: Completion[] = rawShaderParkCompletions.map((completion) => ({
  ...completion,
  info:
    completion.info ?? shaderParkCompletionInfo[completion.label] ?? 'Shader Park Sculpt helper.'
}));

export function shouldShowPatchiesCompletions(context?: PatchiesContext): boolean {
  if (!context?.nodeType) return true;

  return !PATCHIES_COMPLETION_DISABLED_NODE_TYPES.has(context.nodeType);
}

function isCompletionSuppressedByComment(context: CMCompletionContext, from: number): boolean {
  const line = context.state.doc.lineAt(context.pos);
  const lineText = line.text;
  const posInLine = context.pos - line.from;

  const commentStart = lineText.indexOf('//');
  if (commentStart !== -1 && posInLine > commentStart) {
    return true;
  }

  const textBefore = context.state.doc.sliceString(Math.max(0, from - 100), from);
  const lastBlockCommentStart = textBefore.lastIndexOf('/*');
  const lastBlockCommentEnd = textBefore.lastIndexOf('*/');

  return lastBlockCommentStart > lastBlockCommentEnd;
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
export function createPatchiesCompletionSource(patchiesContext?: PatchiesContext) {
  return (context: CMCompletionContext) => {
    if (!shouldShowPatchiesCompletions(patchiesContext)) return null;

    // Skip completions for non-JS nodes (expressions are pure, messages are JSON5)
    if (patchiesContext?.nodeType === 'expr') return null;
    if (patchiesContext?.nodeType === 'msg') return null;

    // Check for member completions (kv., clock., settings.)
    const memberMatch = context.matchBefore(/\w+\.\w*/);

    if (memberMatch) {
      const dotIdx = memberMatch.text.indexOf('.');
      const obj = memberMatch.text.slice(0, dotIdx);
      const methods = memberCompletions[obj];

      if (methods) {
        const partial = memberMatch.text.slice(dotIdx + 1).toLowerCase();

        return {
          from: memberMatch.from + dotIdx + 1,
          options: partial
            ? methods.filter((m) => m.label.toLowerCase().startsWith(partial))
            : methods
        };
      }
    }

    const word = context.matchBefore(/\w*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;

    if (isCompletionSuppressedByComment(context, word.from)) return null;

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

export function createShaderParkCompletionSource(patchiesContext?: PatchiesContext) {
  return (context: CMCompletionContext) => {
    if (patchiesContext?.nodeType !== SHADERPARK_NODE_TYPE) return null;

    const word = context.matchBefore(/[A-Za-z_$][\w$]*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;
    if (isCompletionSuppressedByComment(context, word.from)) return null;

    const typedText = context.state.doc.sliceString(word.from, word.to).toLowerCase();
    const options = typedText
      ? shaderParkCompletions.filter((completion) =>
          completion.label.toLowerCase().startsWith(typedText)
        )
      : shaderParkCompletions;

    return {
      from: word.from,
      options,
      validFor: /^[A-Za-z_$][\w$]*$/
    };
  };
}

/**
 * CodeMirror extension that provides Patchies API completions
 * @param context Optional context with node type information
 */
export const patchiesCompletions = (context?: PatchiesContext) =>
  createPatchiesCompletionSource(context);

export const shaderParkCompletionsSource = (context?: PatchiesContext) =>
  createShaderParkCompletionSource(context);
