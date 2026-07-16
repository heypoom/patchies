import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';

export type RuntimeAudioObjectDescriptor = {
  id: string;
  objectType: string;
  params: unknown[];
};

export interface RuntimeAudioObjectService {
  removeNodeById(nodeId: string): void;
  createNode(nodeId: string, objectType: string, params: unknown[]): Promise<AudioNodeV2 | null>;
  send(nodeId: string, key: string, message: unknown): void;
  getNodeById(nodeId: string): AudioNodeV2 | null;
}
