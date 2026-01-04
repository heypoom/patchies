import type { AudioNodeGroup } from './interfaces/audio-nodes';

/**
 * Validate if a connection is allowed between two nodes based on their group types.
 */
export function validateGroupConnection(
	sourceGroup: AudioNodeGroup,
	targetGroup: AudioNodeGroup
): boolean {
	// Destinations are input-only (e.g. dac~) and must never act as a source.
	if (sourceGroup === 'destinations') return false;
	if (sourceGroup === 'sources' && targetGroup === 'sources') return false;
	if (sourceGroup === 'sources' && targetGroup === 'processors') return true;
	if (sourceGroup === 'sources' && targetGroup === 'destinations') return true;
	if (sourceGroup === 'processors' && targetGroup === 'sources') return false;
	if (sourceGroup === 'processors' && targetGroup === 'processors') return true;
	if (sourceGroup === 'processors' && targetGroup === 'destinations') return true;

	return true;
}
