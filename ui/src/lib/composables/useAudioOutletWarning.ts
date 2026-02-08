import { useSvelteFlow } from '@xyflow/svelte';
import { toast } from 'svelte-sonner';

/**
 * Composable for warning users when audio outlet is not connected.
 * Use this in audio nodes to alert users they won't hear sound output.
 */
export function useAudioOutletWarning(nodeId: string) {
  const { getEdges } = useSvelteFlow();

  function hasAudioOutletConnection(): boolean {
    const edges = getEdges();

    return edges.some((edge) => edge.source === nodeId && edge.sourceHandle === 'audio-out');
  }

  function warnIfNoAudioConnection() {
    if (!hasAudioOutletConnection()) {
      toast.warning('Audio outlet not connected', {
        description: 'Connect the audio outlet to hear sound output.'
      });
    }
  }

  return {
    hasAudioOutletConnection,
    warnIfNoAudioConnection
  };
}
