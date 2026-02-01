import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';
import { nodeNames } from '$lib/nodes/node-types';

export interface ObjectItem {
  name: string;
  description: string;
  category: string;
}

export interface CategoryGroup {
  title: string;
  objects: ObjectItem[];
}

/**
 * Manual descriptions for visual nodes and other special nodes
 */
export const VISUAL_NODE_DESCRIPTIONS: Record<string, string> = {
  p5: 'P5.js creative coding canvas for generative graphics',
  hydra: 'Live coding video synthesizer with feedback loops',
  glsl: 'GLSL fragment shader for GPU-accelerated graphics',
  swgl: 'SwissGL shader programming with simplified syntax',
  textmode: 'Textmode.js, ASCII text-mode rendering for retro graphics',
  'textmode.dom': 'Textmode.js ASCII text-mode rendering with mouse and keyboard interactivity',
  three: 'Three.js 3D graphics and WebGL rendering',
  'three.dom': 'Three.js 3D graphics with mouse and keyboard interactivity',
  canvas: 'Offscreen canvas for 2D drawing and animations',
  'canvas.dom': 'Interactive canvas with mouse and keyboard inputs',
  dom: 'DOM manipulation with direct JavaScript access to root element',
  vue: 'Vue 3 reactive components with Composition API',
  bchrn: 'Butterchurn milkdrop visualizer with audio reactivity',
  'bg.out': 'Background output canvas for fullscreen visuals',
  img: 'Static image display from file or URL',
  webcam: 'Live webcam video input capture',
  screen: 'Screen capture for desktop/window recording',
  video: 'Video file player with playback controls',
  button: 'Clickable button that sends bang messages',
  toggle: 'Toggle switch for boolean on/off states',
  slider: 'Number slider for parameter control',
  keyboard: 'Keyboard input capture for key events',
  textbox: 'Text input field for string messages',
  msg: 'Message box for sending fixed messages',
  label: 'Text label for annotations and notes',
  markdown: 'Markdown text display with formatting',
  js: 'JavaScript code execution environment',
  python: 'Python code execution with Pyodide',
  expr: 'Mathematical expression evaluator',
  filter: 'Filter messages with JavaScript conditions',
  map: 'Transform messages with JavaScript expressions',
  tap: 'Execute side effects and pass messages through',
  scan: 'Accumulate values with stateful scanning',
  uniq: 'Filter consecutive duplicate values',
  peek: 'Display latest received value',
  worker: 'JavaScript execution in dedicated Web Worker thread',
  ruby: 'Ruby code execution with ruby.wasm',
  'ai.txt': 'AI text generation with Gemini',
  'ai.img': 'AI image generation with Gemini',
  'ai.music': 'AI music generation with Lyria',
  'ai.tts': 'AI text-to-speech synthesis',
  'midi.in': 'MIDI input device receiver',
  'midi.out': 'MIDI output device sender',
  netsend: 'Network message sender via WebSocket',
  netrecv: 'Network message receiver via WebSocket',
  mqtt: 'MQTT pub/sub client for IoT messaging',
  sse: 'Server-Sent Events (EventSource) receiver',
  tts: 'Text-to-speech using Web Speech API',
  asm: 'Assembly virtual machine (VASM)',
  'asm.mem': 'External memory buffer for assembly programs',
  orca: 'Orca livecoding environment',
  strudel: 'Strudel live coding for algorithmic patterns',
  uxn: 'UXN virtual machine',
  iframe: 'Embedded web page in iframe',
  link: 'Clickable hyperlink button',
  'merge~': 'Audio channel merger (mono to stereo)',
  'split~': 'Audio channel splitter (stereo to mono)',
  'meter~': 'Audio level meter display',
  'vdo.ninja.push': 'Push video/audio/data to VDO.Ninja',
  'vdo.ninja.pull': 'Pull video/audio/data from VDO.Ninja'
};

/**
 * Category mapping for visual nodes
 */
const VISUAL_NODE_CATEGORIES: Record<string, string> = {
  p5: 'Video',
  hydra: 'Video',
  glsl: 'Video',
  swgl: 'Video',
  textmode: 'Video',
  'textmode.dom': 'Video',
  three: 'Video',
  'three.dom': 'Video',
  canvas: 'Video',
  'canvas.dom': 'Video',
  dom: 'UI',
  vue: 'UI',
  'bg.out': 'Video',
  webcam: 'Video Sources',
  screen: 'Video Sources',
  video: 'Video Sources',
  img: 'Video Sources',
  button: 'UI',
  toggle: 'UI',
  slider: 'UI',
  keyboard: 'UI',
  textbox: 'UI',
  msg: 'UI',
  label: 'UI',
  markdown: 'UI',
  js: 'Code',
  python: 'Code',
  expr: 'Code',
  filter: 'Code',
  map: 'Code',
  tap: 'Code',
  scan: 'Code',
  uniq: 'Code',
  peek: 'Code',
  worker: 'Code',
  ruby: 'Code',
  'ai.txt': 'AI',
  'ai.img': 'AI',
  'ai.music': 'AI',
  'ai.tts': 'AI',
  'midi.in': 'I/O',
  'midi.out': 'I/O',
  netsend: 'I/O',
  netrecv: 'I/O',
  mqtt: 'I/O',
  sse: 'I/O',
  tts: 'I/O',
  asm: 'Code',
  'asm.mem': 'Code',
  orca: 'Audio',
  strudel: 'Audio',
  uxn: 'Code',
  iframe: 'Code',
  link: 'UI',
  'merge~': 'Audio FX',
  'split~': 'Audio FX',
  'meter~': 'Audio',
  bchrn: 'Unstable',
  'vdo.ninja.push': 'I/O',
  'vdo.ninja.pull': 'I/O'
};

/**
 * Audio node categories based on group classification
 */
const AUDIO_CODE_NODES = ['chuck~', 'tone~', 'dsp~', 'elem~', 'csound~', 'expr~', 'sonic~'];

/**
 * Get all objects categorized by type
 * @param includeAiFeatures - Whether to include AI-related objects (default: true)
 */
export function getCategorizedObjects(includeAiFeatures: boolean = true): CategoryGroup[] {
  const allObjects: ObjectItem[] = [];
  const seenNames = new Set<string>();

  const audioRegistry = AudioRegistry.getInstance();
  const objectRegistry = ObjectRegistry.getInstance();

  // Get audio nodes from AudioRegistry (excluding headless nodes)
  const audioNodeTypes = audioRegistry.getVisibleNodeTypes();
  for (const nodeType of audioNodeTypes) {
    if (seenNames.has(nodeType)) continue;
    seenNames.add(nodeType);

    const nodeClass = audioRegistry.get(nodeType);
    if (!nodeClass) continue;

    let category = '';
    if (AUDIO_CODE_NODES.includes(nodeType)) {
      category = 'Audio';
    } else if (nodeClass.group === 'sources') {
      category = 'Audio Sources';
    } else if (nodeClass.group === 'processors') {
      category = 'Audio FX';
    } else if (nodeClass.group === 'destinations') {
      category = 'Audio';
    }

    allObjects.push({
      name: nodeType,
      description: nodeClass.description || `${nodeType} audio node`,
      category
    });
  }

  // Get text objects from ObjectRegistry (primary types only, no aliases)
  const textObjectTypes = objectRegistry.getPrimaryObjectTypes();
  for (const objectType of textObjectTypes) {
    if (seenNames.has(objectType)) continue;
    seenNames.add(objectType);

    const objectClass = objectRegistry.get(objectType);
    if (!objectClass) continue;

    allObjects.push({
      name: objectType,
      description: objectClass.description || `${objectType} control object`,
      category: 'Control'
    });
  }

  // Get visual nodes
  for (const nodeName of nodeNames) {
    // Skip 'object' and 'asm.value' as they're not user-facing
    if (nodeName === 'object' || nodeName === 'asm.value') continue;

    // Skip if already added from registries
    if (seenNames.has(nodeName)) continue;
    seenNames.add(nodeName);

    const category = VISUAL_NODE_CATEGORIES[nodeName];
    if (!category) continue;

    allObjects.push({
      name: nodeName,
      description: VISUAL_NODE_DESCRIPTIONS[nodeName] || `${nodeName} node`,
      category
    });
  }

  // Filter out AI objects if AI features are disabled
  const filteredObjects = includeAiFeatures
    ? allObjects
    : allObjects.filter((obj) => !obj.name.startsWith('ai.'));

  // Group objects by category
  const categoryMap = new Map<string, ObjectItem[]>();
  for (const obj of filteredObjects) {
    if (!categoryMap.has(obj.category)) {
      categoryMap.set(obj.category, []);
    }
    categoryMap.get(obj.category)!.push(obj);
  }

  // Sort objects within each category
  for (const objects of categoryMap.values()) {
    objects.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Define category order - UI, Code, Control first as they're most fundamental
  const categoryOrder = [
    'UI',
    'Code',
    'Control',
    'Video',
    'Video Sources',
    'Audio',
    'Audio Sources',
    'Audio FX',
    'I/O',
    'AI',
    'Unstable'
  ];

  // Build final category groups in order
  const result: CategoryGroup[] = [];

  for (const title of categoryOrder) {
    const objects = categoryMap.get(title);

    if (objects && objects.length > 0) {
      result.push({ title, objects });
    }
  }

  return result;
}
