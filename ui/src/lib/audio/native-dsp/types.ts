/**
 * Shared types for native DSP nodes.
 *
 * Used by both main-thread node definitions and AudioWorklet processors.
 */

import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * Shared port schema for native DSP nodes.
 *
 * This allows both the main-thread node definition and the AudioWorklet
 * processor to share the same inlet/outlet definitions, ensuring consistency
 * and enabling automatic AudioParam generation from isAudioParam inlets.
 */
export interface DspPortSchema {
  inlets: ObjectInlet[];
  outlets: ObjectOutlet[];
}

/**
 * AudioParam descriptor derived from inlet definitions.
 * Matches the Web Audio API's AudioParamDescriptor interface.
 */
export interface DspAudioParamDescriptor {
  name: string;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  automationRate?: 'a-rate' | 'k-rate';
}

/**
 * Extract AudioParam descriptors from inlets marked with isAudioParam.
 */
export function extractAudioParamDescriptors(inlets: ObjectInlet[]): DspAudioParamDescriptor[] {
  return inlets
    .filter((inlet) => inlet.isAudioParam && inlet.name)
    .map((inlet) => ({
      name: inlet.name!,
      defaultValue: typeof inlet.defaultValue === 'number' ? inlet.defaultValue : 0,
      minValue: inlet.minNumber ?? -3.4028235e38,
      maxValue: inlet.maxNumber ?? 3.4028235e38,
      automationRate: inlet.audioParamAutomationRate ?? 'a-rate'
    }));
}
