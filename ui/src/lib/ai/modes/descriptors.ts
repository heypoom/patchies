import {
  Sparkles,
  Network,
  PenLine,
  Replace,
  Wrench,
  ArrowRight,
  ArrowLeft,
  Scissors
} from '@lucide/svelte/icons';
import type { AiModeDescriptor, AiModeContext } from './types';

function nodeName(ctx: AiModeContext): string {
  const d = ctx.selectedNode?.data as Record<string, unknown> | undefined;
  return (d?.name as string) || (d?.title as string) || ctx.selectedNode?.type || 'object';
}

export const modeDescriptors: Record<string, AiModeDescriptor> = {
  single: {
    id: 'single',
    label: 'AI Object Insert',
    description: () => 'Describe the object you want to create',
    placeholder: () => 'e.g., "a bouncing ball"',
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
    label: 'AI Multi-Object Insert',
    description: () => 'Describe connected objects to create',
    placeholder: () => 'e.g., "slider controlling oscillator frequency"',
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
    label: 'AI Object Edit',
    description: (ctx) => `Editing: ${nodeName(ctx)}`,
    placeholder: () => 'e.g., "make it go faster"',
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

  replace: {
    id: 'replace',
    label: 'AI Object Replace',
    description: (ctx) => `Replacing: ${nodeName(ctx)}`,
    placeholder: (ctx) => `e.g., "Replace this ${ctx.selectedNode?.type || 'object'} with..."`,
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
    label: 'AI Fix Error',
    description: (ctx) => `Fixing: ${nodeName(ctx)}`,
    placeholder: () => 'Optional: additional instructions',
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

  'create-from-sender': {
    id: 'create-from-sender',
    label: 'AI Create Receiver',
    description: (ctx) => `Creating receiver for: ${nodeName(ctx)}`,
    placeholder: () => 'Optional: e.g., "visualize as a bar chart"',
    color: 'green',
    icon: ArrowRight,
    isMulti: false,
    requiresNode: true,
    promptOptional: true,
    availableInChat: false
  },

  'create-from-consumer': {
    id: 'create-from-consumer',
    label: 'AI Create Sender',
    description: (ctx) => `Creating sender for: ${nodeName(ctx)}`,
    placeholder: () => 'Optional: e.g., "send a sine wave"',
    color: 'green',
    icon: ArrowLeft,
    isMulti: false,
    requiresNode: true,
    promptOptional: true,
    availableInChat: false
  },

  decompose: {
    id: 'decompose',
    label: 'AI Decompose',
    description: (ctx) => `Decomposing: ${nodeName(ctx)}`,
    placeholder: () => 'e.g., "separate drawing and data logic"',
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
  }
} satisfies Record<string, AiModeDescriptor>;

export function getModeDescriptor(mode: string): AiModeDescriptor {
  const descriptor = modeDescriptors[mode];
  if (!descriptor) throw new Error(`Unknown AI mode: ${mode}`);
  return descriptor;
}
