import {
  Sparkles,
  Network,
  PenLine,
  Replace,
  Wrench,
  ArrowRight,
  ArrowLeft,
  Scissors,
  GitFork
} from '@lucide/svelte/icons';
import type { AiModeDescriptor, AiModeContext, AiPromptMode } from './types';

function nodeName(ctx: AiModeContext): string {
  const d = ctx.selectedNode?.data as Record<string, unknown> | undefined;
  return (d?.name as string) || (d?.title as string) || ctx.selectedNode?.type || 'object';
}

export const modeDescriptors: Record<string, AiModeDescriptor> = {
  insert: {
    id: 'insert',
    label: 'Object Insert',
    shortLabel: 'Single',
    description: () => 'Describe one object to create',
    placeholder: () => 'e.g., "a bouncing ball"',
    loadingLabel: 'Deciding',
    generatingLabel: (t) => `Cooking ${t}`,
    color: 'purple',
    icon: Sparkles,
    isMulti: false,
    requiresNode: false,
    availableInChat: true,
    chatToolDescription: 'Create a new object on the canvas from a natural language description',
    chatToolSchema: {
      type: 'object',
      properties: { prompt: { type: 'string', description: 'What to create' } },
      required: ['prompt']
    }
  },

  multi: {
    id: 'multi',
    label: 'Multi Insert',
    shortLabel: 'Multi',
    description: () => 'Describe connected objects to create',
    placeholder: () => 'e.g., "slider controlling oscillator frequency"',
    loadingLabel: 'Planning',
    generatingLabel: (t) => `Cooking ${t}`,
    color: 'blue',
    icon: Network,
    isMulti: true,
    requiresNode: false,
    availableInChat: true,
    chatToolDescription: 'Create multiple connected objects on the canvas',
    chatToolSchema: {
      type: 'object',
      properties: { prompt: { type: 'string', description: 'What to create' } },
      required: ['prompt']
    }
  },

  edit: {
    id: 'edit',
    label: 'Edit',
    shortLabel: 'Edit',
    description: () => 'Make changes to object',
    placeholder: () => 'e.g., "make it go faster"',
    loadingLabel: 'Editing',
    generatingLabel: () => 'Editing',
    color: 'amber',
    icon: PenLine,
    isMulti: false,
    requiresNode: true,
    availableInChat: true,
    chatToolDescription: 'Edit an existing object on the canvas',
    chatToolSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID of the node to edit' },
        prompt: { type: 'string', description: 'What to change' }
      },
      required: ['nodeId', 'prompt']
    }
  },

  'turn-into': {
    id: 'turn-into',
    label: 'Turn Into',
    shortLabel: 'Into',
    description: () => 'Turn object into something else',
    placeholder: (ctx) => `Replace this ${ctx.selectedNode?.type || 'object'} with...`,
    loadingLabel: 'Replacing',
    generatingLabel: (t) => `Replacing with ${t}`,
    color: 'amber',
    icon: Replace,
    isMulti: false,
    requiresNode: true,
    availableInChat: true,
    chatToolDescription: 'Replace an existing object with a different type',
    chatToolSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID of the node to replace' },
        prompt: { type: 'string', description: 'What to replace it with' }
      },
      required: ['nodeId', 'prompt']
    }
  },

  'fix-error': {
    id: 'fix-error',
    label: 'Fix Error',
    shortLabel: 'Fix',
    description: () => 'Fix a code or console error',
    placeholder: () => 'Optional: additional instructions',
    loadingLabel: 'Fixing',
    generatingLabel: () => 'Fixing',
    color: 'red',
    icon: Wrench,
    isMulti: false,
    requiresNode: true,
    promptOptional: true,
    availableInChat: true,
    chatToolDescription: 'Fix a code error in an existing object',
    chatToolSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID of the node with errors' },
        errors: { type: 'array', items: { type: 'string' }, description: 'Error messages' },
        prompt: { type: 'string', description: 'Additional instructions (optional)' }
      },
      required: ['nodeId', 'errors']
    }
  },

  'make-consumer': {
    id: 'make-consumer',
    label: 'Make Consumer',
    shortLabel: 'Consumer',
    description: () => `Object that uses its output`,
    placeholder: () => 'Optional: e.g., "visualize as a bar chart"',
    loadingLabel: 'Making consumer',
    generatingLabel: (t) => `Cooking ${t}`,
    color: 'green',
    icon: ArrowRight,
    isMulti: false,
    requiresNode: true,
    promptOptional: true,
    availableInChat: false
  },

  'make-producer': {
    id: 'make-producer',
    label: 'Make Producer',
    shortLabel: 'Producer',
    description: () => `Object that produces its input`,
    placeholder: () => 'Optional: e.g., "send a sine wave"',
    loadingLabel: 'Making producer',
    generatingLabel: (t) => `Cooking ${t}`,
    color: 'green',
    icon: ArrowLeft,
    isMulti: false,
    requiresNode: true,
    promptOptional: true,
    availableInChat: false
  },

  split: {
    id: 'split',
    label: 'Split',
    shortLabel: 'Split',
    description: () => 'Decompose into multiple objects',
    placeholder: () => 'e.g., "separate drawing and data logic"',
    loadingLabel: 'Decomposing',
    generatingLabel: (t) => `Cooking ${t}`,
    color: 'blue',
    icon: Scissors,
    isMulti: true,
    requiresNode: true,
    availableInChat: true,
    chatToolDescription: 'Split a complex object into multiple focused connected objects',
    chatToolSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID of the node to decompose' },
        prompt: { type: 'string', description: 'How to split it' }
      },
      required: ['nodeId', 'prompt']
    }
  },

  fork: {
    id: 'fork',
    label: 'Fork',
    shortLabel: 'Fork',
    description: () => 'Make a new object based on this one',
    placeholder: () => 'e.g., "as a canvas node" or "draw spirals instead"',
    loadingLabel: 'Forking',
    generatingLabel: (t) => `Forking ${t}`,
    color: 'purple',
    icon: GitFork,
    isMulti: false,
    requiresNode: true,
    availableInChat: true,
    chatToolDescription:
      'Create a new standalone object derived from an existing one — can stay the same type or become a different type based on the prompt',
    chatToolSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID of the source node to fork from' },
        prompt: {
          type: 'string',
          description:
            'What to change or what type to fork into (e.g. "as a canvas node", "draw triangles instead")'
        }
      },
      required: ['nodeId', 'prompt']
    }
  }
} satisfies Record<string, AiModeDescriptor>;

export function getModeDescriptor(mode: string): AiModeDescriptor {
  const descriptor = modeDescriptors[mode];
  if (!descriptor) throw new Error(`Unknown AI mode: ${mode}`);
  return descriptor;
}

/**
 * Returns the selectable modes for the current context.
 *
 * - No node selected → [single, multi]
 * - Node selected    → [edit, replace, decompose, create-consumer, create-producer]
 *
 * create-consumer/producer are valid for ANY node — any node can produce output
 * that another consumes, or receive input from another that produces it.
 */
export function getAvailableModesForContext(ctx: AiModeContext): AiPromptMode[] {
  if (!ctx.selectedNode) {
    return ['insert', 'multi'];
  }

  const modes: AiPromptMode[] = [
    'edit',
    'fork',
    'fix-error',
    'turn-into',
    'split',
    'make-consumer',
    'make-producer'
  ];

  return modes;
}
