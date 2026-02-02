import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';
import { nodeNames } from '$lib/nodes/node-types';
import { BUILT_IN_PACKS, type ExtensionPack } from '../../../stores/extensions.store';

export interface ObjectItem {
  name: string;
  description: string;
  category: string;
}

export interface CategoryGroup {
  title: string;
  icon: string; // lucide icon name
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
 * Build a reverse lookup from object name to its pack
 */
function buildObjectToPackMap(): Map<string, ExtensionPack> {
  const map = new Map<string, ExtensionPack>();
  for (const pack of BUILT_IN_PACKS) {
    for (const obj of pack.objects) {
      map.set(obj, pack);
    }
  }
  return map;
}

const objectToPackMap = buildObjectToPackMap();

/**
 * Get the description for an object from various sources
 */
function getObjectDescription(name: string): string {
  // Check manual descriptions first
  if (VISUAL_NODE_DESCRIPTIONS[name]) {
    return VISUAL_NODE_DESCRIPTIONS[name];
  }

  // Check audio registry
  const audioRegistry = AudioRegistry.getInstance();
  const audioNode = audioRegistry.get(name);
  if (audioNode?.description) {
    return audioNode.description;
  }

  // Check object registry
  const objectRegistry = ObjectRegistry.getInstance();
  const textObject = objectRegistry.get(name);
  if (textObject?.description) {
    return textObject.description;
  }

  return `${name} node`;
}

/**
 * Get all objects categorized by extension pack
 * Uses BUILT_IN_PACKS as the single source of truth for categorization
 *
 * @param includeAiFeatures - Whether to include AI-related objects (default: true)
 * @param enabledObjects - Optional set of enabled object names. If provided, only these objects are included.
 */
export function getCategorizedObjects(
  includeAiFeatures: boolean = true,
  enabledObjects?: Set<string>
): CategoryGroup[] {
  const seenNames = new Set<string>();
  const packObjects = new Map<string, ObjectItem[]>();

  // Initialize empty arrays for each pack
  for (const pack of BUILT_IN_PACKS) {
    packObjects.set(pack.id, []);
  }

  const audioRegistry = AudioRegistry.getInstance();
  const objectRegistry = ObjectRegistry.getInstance();

  // Collect all available object names
  const allObjectNames = new Set<string>();

  // From audio registry
  for (const nodeType of audioRegistry.getVisibleNodeTypes()) {
    allObjectNames.add(nodeType);
  }

  // From object registry
  for (const objectType of objectRegistry.getPrimaryObjectTypes()) {
    allObjectNames.add(objectType);
  }

  // From node names
  for (const nodeName of nodeNames) {
    if (nodeName !== 'object' && nodeName !== 'asm.value') {
      allObjectNames.add(nodeName);
    }
  }

  // Categorize each object by its pack
  for (const name of allObjectNames) {
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    // Skip AI objects if disabled
    if (!includeAiFeatures && name.startsWith('ai.')) continue;

    // Skip if not in enabled objects
    if (enabledObjects && !enabledObjects.has(name)) continue;

    const pack = objectToPackMap.get(name);
    if (!pack) continue; // Object not in any pack

    const objects = packObjects.get(pack.id)!;
    objects.push({
      name,
      description: getObjectDescription(name),
      category: pack.name
    });
  }

  // Sort objects within each pack
  for (const objects of packObjects.values()) {
    objects.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Build result in pack order
  const result: CategoryGroup[] = [];

  for (const pack of BUILT_IN_PACKS) {
    const objects = packObjects.get(pack.id)!;
    if (objects.length > 0) {
      result.push({
        title: pack.name,
        icon: pack.icon,
        objects
      });
    }
  }

  return result;
}
