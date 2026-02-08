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

  function hasAnyOutletConnection(): boolean {
    const edges = getEdges();

    return edges.some((edge) => edge.source === nodeId);
  }

  function warnIfNoAudioConnection() {
    if (!hasAudioOutletConnection()) {
      toast.warning('Audio outlet not connected', {
        description: 'Connect the audio outlet to hear sound output.'
      });
    }
  }

  /**
   * Warn only if no outlets (audio or message) are connected.
   * Use for nodes like ChucK that can be used for analysis (message output only).
   */
  function warnIfNoOutletConnection() {
    if (!hasAnyOutletConnection()) {
      toast.warning('No outlets connected', {
        description: 'Connect an audio or message outlet to use output.'
      });
    }
  }

  return {
    hasAudioOutletConnection,
    hasAnyOutletConnection,
    warnIfNoAudioConnection,
    warnIfNoOutletConnection
  };
}
