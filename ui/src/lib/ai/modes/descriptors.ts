import {
  Sparkles,
  Network,
  PenLine,
  Replace,
  Wrench,
  ArrowRight,
  ArrowLeft,
  Scissors,
  GitFork,
  Cable,
  Unplug,
  Trash2,
  Move
} from '@lucide/svelte/icons';
import { match } from 'ts-pattern';
import type { AiModeDescriptor, AiModeContext, AiPromptMode, AiPromptColor } from './types';

/** Shared color → Tailwind class mapping for action cards */
export function getActionColorClass(color: AiPromptColor): string {
  return match(color)
    .with('purple', () => 'border-purple-500/40 bg-purple-950/30 text-purple-400')
    .with('blue', () => 'border-blue-500/40 bg-blue-950/30 text-blue-400')
    .with('amber', () => 'border-amber-500/40 bg-amber-950/30 text-amber-400')
    .with('green', () => 'border-green-500/40 bg-green-950/30 text-green-400')
    .with('red', () => 'border-red-500/40 bg-red-950/30 text-red-400')
    .exhaustive();
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
    requiresNode: false
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
    requiresNode: false
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
    requiresNode: true
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
    requiresNode: true
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
    promptOptional: true
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
    promptOptional: true
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
    promptOptional: true
  },

  split: {
    id: 'split',
    label: 'Split',
    shortLabel: 'Split',
    description: () => 'Split into multiple objects',
    placeholder: () => 'e.g., "separate drawing and data logic"',
    loadingLabel: 'Splitting',
    generatingLabel: (t) => `Cooking ${t}`,
    color: 'blue',
    icon: Scissors,
    isMulti: true,
    requiresNode: true
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
    requiresNode: true
  },

  'connect-edges': {
    id: 'connect-edges',
    label: 'Connect Edges',
    shortLabel: 'Connect',
    description: () => 'Connect existing objects with edges',
    placeholder: () => 'e.g., "connect the oscillator to the filter"',
    loadingLabel: 'Connecting',
    generatingLabel: () => 'Connecting',
    color: 'green',
    icon: Cable,
    isMulti: false,
    requiresNode: false
  },

  'disconnect-edges': {
    id: 'disconnect-edges',
    label: 'Disconnect Edges',
    shortLabel: 'Disconnect',
    description: () => 'Remove edges between objects',
    placeholder: () => 'e.g., "disconnect the oscillator from the filter"',
    loadingLabel: 'Disconnecting',
    generatingLabel: () => 'Disconnecting',
    color: 'red',
    icon: Unplug,
    isMulti: false,
    requiresNode: false
  },

  'delete-objects': {
    id: 'delete-objects',
    label: 'Delete Objects',
    shortLabel: 'Delete',
    description: () => 'Delete existing objects',
    placeholder: () => 'e.g., "delete the unused oscillator"',
    loadingLabel: 'Deleting',
    generatingLabel: () => 'Deleting',
    color: 'red',
    icon: Trash2,
    isMulti: false,
    requiresNode: false
  },

  'move-objects': {
    id: 'move-objects',
    label: 'Move Objects',
    shortLabel: 'Move',
    description: () => 'Move existing objects',
    placeholder: () => 'e.g., "move the sequencer left"',
    loadingLabel: 'Moving',
    generatingLabel: () => 'Moving',
    color: 'green',
    icon: Move,
    isMulti: false,
    requiresNode: false
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
    'make-consumer',
    'make-producer',
    'split',
    'turn-into'
  ];

  return modes;
}
