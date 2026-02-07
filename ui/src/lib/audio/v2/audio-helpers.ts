import type { ObjectMetadata } from '$lib/objects/v2/object-metadata';
import { AudioRegistry } from '$lib/registry/AudioRegistry';

import type { AudioNodeGroup } from './interfaces/audio-nodes';

/**
 * Validate if a connection is allowed between two nodes based on their group types.
 */
export function validateGroupConnection(
  sourceGroup: AudioNodeGroup,
  targetGroup: AudioNodeGroup
): boolean {
  // Destinations are input-only (e.g. out~) and must never act as a source.
  if (sourceGroup === 'destinations') return false;
  if (sourceGroup === 'sources' && targetGroup === 'sources') return false;
  if (sourceGroup === 'sources' && targetGroup === 'processors') return true;
  if (sourceGroup === 'sources' && targetGroup === 'destinations') return true;
  if (sourceGroup === 'processors' && targetGroup === 'sources') return false;
  if (sourceGroup === 'processors' && targetGroup === 'processors') return true;
  if (sourceGroup === 'processors' && targetGroup === 'destinations') return true;

  return true;
}

/**
 * Get all audio object names from the V2 audio registry.
 * Audio objects are automatically detected by having signal inlets or outlets.
 */
export function getAudioObjectNames(): string[] {
  const registry = AudioRegistry.getInstance();

  return registry.getNodeTypes().filter((name) => {
    const nodeClass = registry.get(name);

    return nodeClass && hasSignalPorts(nodeClass);
  });
}

/**
 * Check if a node has any signal inlets or outlets (i.e., is an audio node).
 */
export function hasSignalPorts(metadata: ObjectMetadata): boolean {
  const hasSignalInlet = metadata.inlets?.some((inlet) => inlet.type === 'signal');
  const hasSignalOutlet = metadata.outlets?.some((outlet) => outlet.type === 'signal');

  return !!(hasSignalInlet || hasSignalOutlet);
}
