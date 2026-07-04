import type { ObjectSchema } from '$lib/objects/schemas/types';
export { TRIGGER_TYPE_SPECS, getTriggerTypeSpec } from '$lib/objects/trigger-type-specs';

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
      description: 'Any message triggers all outputs in right-to-left order',
      handle: { handleType: 'message' }
    }
  ],
  outlets: [
    {
      id: 'dynamic',
      description: 'Outlets are created based on type specifiers (e.g., "trigger b b n")',
      handle: { handleType: 'message' }
    }
  ],
  tags: ['flow', 'routing', 'bang', 'sequence'],
  hasDynamicOutlets: true
};
