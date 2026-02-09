import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
import { normalizeMessageType } from '$lib/messages/message-types';

import type { ObjectShorthand } from './v2/interfaces/shorthands';

/**
 * Default built-in shorthands.
 */
export const BUILTIN_OBJECT_SHORTHANDS: ObjectShorthand[] = [
  // Trigger object - sends messages through multiple outlets right-to-left
  {
    names: ['trigger', 't'],
    nodeType: 'trigger',
    description: 'Send messages through multiple outlets in right-to-left order',
    transform: (expr, name) => {
      const parts = expr.trim().split(/\s+/);
      const typeSpecs = parts.slice(1);

      // Filter to only valid type specifiers
      const validTypes = typeSpecs.filter((t) => normalizeMessageType(t) !== undefined);

      // Default to two bang outlets if no valid types specified
      const types = validTypes.length > 0 ? validTypes : ['b', 'n'];

      return {
        nodeType: 'trigger',
        data: {
          types,
          shorthand: name === 't',
          showHelp: false
        }
      };
    }
  },
  // Legacy alias: dac~ → out~ (for backwards compatibility)
  {
    names: ['dac~'],
    nodeType: 'out~',
    description: 'Audio output to speakers (alias for out~)',
    transform: () => ({
      nodeType: 'out~',
      data: { deviceId: '' }
    })
  },
  {
    names: ['msg', 'm'],
    nodeType: 'msg',
    description: 'Message object',
    transform: (expr, name) => ({
      nodeType: 'msg',
      data: { message: expr.replace(name, '').trim() }
    })
  },
  {
    names: ['label'],
    nodeType: 'label',
    description: 'Text label',
    transform: (expr, name) => ({
      nodeType: 'label',
      data: { message: expr.replace(name, '').trim() }
    })
  },
  {
    names: ['link'],
    nodeType: 'link',
    description: 'URL link',
    transform: (expr, name) => {
      const url = expr.replace(name, '').trim() || 'https://example.com';
      return {
        nodeType: 'link',
        data: { url, displayText: url }
      };
    }
  },
  {
    names: ['expr'],
    nodeType: 'expr',
    description: 'Expression evaluator',
    transform: (expr, name) => ({
      nodeType: 'expr',
      data: { expr: expr.replace(name, '').trim() }
    })
  },
  {
    names: ['filter'],
    nodeType: 'filter',
    description: 'Filter messages with JS condition',
    transform: (expr, name) => ({
      nodeType: 'filter',
      data: { expr: expr.replace(name, '').trim() }
    })
  },
  {
    names: ['map'],
    nodeType: 'map',
    description: 'Transform messages with JS expression',
    transform: (expr, name) => ({
      nodeType: 'map',
      data: { expr: expr.replace(name, '').trim() }
    })
  },
  {
    names: ['tap'],
    nodeType: 'tap',
    description: 'Execute side effects and pass through',
    transform: (expr, name) => ({
      nodeType: 'tap',
      data: { expr: expr.replace(name, '').trim() }
    })
  },
  {
    names: ['scan'],
    nodeType: 'scan',
    description: 'Accumulate values with stateful scanning',
    transform: (expr, name) => ({
      nodeType: 'scan',
      data: { expr: expr.replace(name, '').trim() }
    })
  },
  {
    names: ['peek'],
    nodeType: 'peek',
    description: 'Display received values',
    transform: (expr, name) => ({
      nodeType: 'peek',
      data: { expr: expr.replace(name, '').trim() }
    })
  },
  {
    names: ['expr~'],
    nodeType: 'expr~',
    description: 'Audio-rate expression',
    transform: (expr, name) => ({
      nodeType: 'expr~',
      data: { expr: expr.replace(name, '').trim() }
    })
  },
  {
    names: ['netsend'],
    nodeType: 'netsend',
    description: 'Network message sender',
    transform: (expr, name) => ({
      nodeType: 'netsend',
      data: { channel: expr.replace(name, '').trim() || 'foo' }
    })
  },
  {
    names: ['netrecv'],
    nodeType: 'netrecv',
    description: 'Network message receiver',
    transform: (expr, name) => ({
      nodeType: 'netrecv',
      data: { channel: expr.replace(name, '').trim() || 'foo' }
    })
  },
  {
    names: ['send.vdo', 'sv'],
    nodeType: 'send.vdo',
    description: 'Send video to a named channel',
    transform: (expr, name) => ({
      nodeType: 'send.vdo',
      data: { channel: expr.replace(name, '').trim() || 'foo' }
    })
  },
  {
    names: ['recv.vdo', 'rv'],
    nodeType: 'recv.vdo',
    description: 'Receive video from a named channel',
    transform: (expr, name) => ({
      nodeType: 'recv.vdo',
      data: { channel: expr.replace(name, '').trim() || 'foo' }
    })
  },
  {
    names: ['slider'],
    nodeType: 'slider',
    description: 'Integer slider. Format: slider <min> <max> [default]',
    transform: (expr, name) => {
      const [min, max, defaultValue] = parseSliderExpr(expr, name, 100);
      return {
        nodeType: 'slider',
        data: { min, max, defaultValue, isFloat: false }
      };
    }
  },
  {
    names: ['fslider'],
    nodeType: 'slider',
    description: 'Float slider. Format: fslider <min> <max> [default]',
    transform: (expr, name) => {
      const [min, max, defaultValue] = parseSliderExpr(expr, name, 1);
      return {
        nodeType: 'slider',
        data: { min, max, defaultValue, isFloat: true }
      };
    }
  },
  {
    names: ['vslider'],
    nodeType: 'slider',
    description: 'Vertical integer slider. Format: vslider <min> <max> [default]',
    transform: (expr, name) => {
      const [min, max, defaultValue] = parseSliderExpr(expr, name, 100);

      return {
        nodeType: 'slider',
        data: { min, max, defaultValue, isFloat: false, vertical: true }
      };
    }
  },
  {
    names: ['vfslider'],
    nodeType: 'slider',
    description: 'Vertical float slider. Format: vfslider <min> <max> [default]',
    transform: (expr, name) => {
      const [min, max, defaultValue] = parseSliderExpr(expr, name, 1);
      return {
        nodeType: 'slider',
        data: { min, max, defaultValue, isFloat: true, vertical: true }
      };
    }
  },
  {
    names: ['keyboard'],
    nodeType: 'keyboard',
    description: 'Keyboard input',
    transform: (expr, name) => {
      const keybindPart = expr.replace(name, '').trim();
      const nodeData = getDefaultNodeData(name);

      if (keybindPart.length > 0) {
        nodeData.keybind = keybindPart;
        nodeData.mode = 'filtered';
      }

      return { nodeType: name, data: nodeData };
    }
  },
  {
    names: ['iframe'],
    nodeType: 'iframe',
    description: 'Embedded web content',
    transform: (expr, name) => {
      let url = expr.replace(name, '').trim();

      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      return {
        nodeType: 'iframe',
        data: { url, width: 400, height: 300 }
      };
    }
  },
  {
    names: ['sse'],
    nodeType: 'sse',
    description: 'Server-Sent Events source',
    transform: (expr, name) => {
      let url = expr.replace(name, '').trim();

      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }

      return { nodeType: 'sse', data: { url } };
    }
  }
];

/**
 * Parse slider expression: "slider min max [default]"
 */
function parseSliderExpr(expr: string, name: string, defaultMax: number): [number, number, number] {
  const [min = 0, max = defaultMax, _defaultValue] = expr
    .replace(name, '')
    .trim()
    .split(' ')
    .map(Number);

  let defaultValue = _defaultValue;

  if (defaultValue === undefined) {
    defaultValue = (min + max) / 2;
  }

  return [min, max, defaultValue];
}
