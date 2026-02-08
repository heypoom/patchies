import type { ObjectSchema } from './types';

/**
 * Type specifier metadata for trigger outputs.
 * This is the single source of truth for type information used in:
 * - TriggerNode.svelte tooltips
 * - Help panel content
 * - Documentation
 */
export const TRIGGER_TYPE_SPECS = {
  b: {
    name: 'bang',
    description: 'Always outputs a bang, regardless of input',
    color: 'text-orange-400',
    hoverColor: 'hover:text-orange-400'
  },
  a: {
    name: 'any',
    description: 'Passes input through unchanged',
    color: 'text-green-400',
    hoverColor: 'hover:text-green-400'
  },
  s: {
    name: 'symbol',
    description: 'Passes thru symbols or strings',
    color: 'text-blue-400',
    hoverColor: 'hover:text-blue-400'
  },
  t: {
    name: 'text',
    description: 'Passes through strings',
    color: 'text-blue-400',
    hoverColor: 'hover:text-blue-400'
  },
  l: {
    name: 'list',
    description: 'Passes through arrays',
    color: 'text-purple-400',
    hoverColor: 'hover:text-purple-400'
  },
  n: {
    name: 'number',
    description: 'Passes through numbers',
    color: 'text-yellow-400',
    hoverColor: 'hover:text-yellow-400'
  },
  f: {
    name: 'float',
    description: 'Passes through numbers',
    color: 'text-yellow-400',
    hoverColor: 'hover:text-yellow-400'
  },
  i: {
    name: 'int',
    description: 'Passes through integers only',
    color: 'text-amber-400',
    hoverColor: 'hover:text-amber-400'
  },
  o: {
    name: 'object',
    description: 'Passes through plain objects',
    color: 'text-cyan-400',
    hoverColor: 'hover:text-cyan-400'
  }
} as const;

export type TriggerTypeKey = keyof typeof TRIGGER_TYPE_SPECS;

/**
 * Get type spec by key or name.
 */
export function getTriggerTypeSpec(type: string) {
  // First try direct key lookup (short form like 'b')
  if (type in TRIGGER_TYPE_SPECS) {
    return TRIGGER_TYPE_SPECS[type as TriggerTypeKey];
  }

  // Then try matching by name (full form like 'bang')
  const lowerType = type.toLowerCase();
  const entry = Object.entries(TRIGGER_TYPE_SPECS).find(([, spec]) => spec.name === lowerType);
  if (entry) {
    return entry[1];
  }

  return {
    name: type,
    description: 'Unknown type',
    color: 'text-zinc-400',
    hoverColor: 'hover:text-zinc-400'
  };
}

/**
 * Schema for the trigger object.
 */
export const triggerSchema: ObjectSchema = {
  type: 'trigger',
  category: 'control',
  description: 'Outputs messages through multiple outlets in right-to-left order',
  inlets: [
    {
      id: 'message',
      description: 'Any message triggers all outputs in right-to-left order'
    }
  ],
  outlets: [
    {
      id: 'dynamic',
      description: 'Outlets are created based on type specifiers (e.g., "trigger b b n")'
    }
  ],
  tags: ['flow', 'routing', 'bang', 'sequence'],
  hasDynamicOutlets: true
};
