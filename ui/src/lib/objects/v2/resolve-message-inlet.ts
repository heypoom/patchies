import { deriveHandleId } from '$lib/utils/handle-id';

import type { MessageMeta } from './interfaces/text-objects';
import type { ObjectInlet } from './object-metadata';

export function resolveMessageInlet(
  inlets: ObjectInlet[] | undefined,
  meta: MessageMeta
): { inlet?: number; inletName?: string } {
  if (!inlets) {
    return {
      inlet: meta.inlet,
      inletName: meta.inletName
    };
  }

  const inlet = meta.inlet ?? getInletIndexFromHandleKey(inlets, meta.inletKey);

  return {
    inlet,
    inletName: inlet === undefined ? meta.inletName : (inlets[inlet]?.name ?? meta.inletName)
  };
}

function getInletIndexFromHandleKey(inlets: ObjectInlet[], inletKey?: string): number | undefined {
  if (!inletKey) return undefined;

  const index = inlets.findIndex(
    (inlet, inletIndex) => getInletHandleId(inlet, inletIndex) === inletKey
  );

  return index === -1 ? undefined : index;
}

function getInletHandleId(inlet: ObjectInlet, index: number): string {
  const handle = inlet.handle ?? {
    handleType: getDefaultHandleType(inlet),
    handleId: index
  };

  return deriveHandleId({
    port: 'inlet',
    type: handle.handleType,
    id: handle.handleId
  });
}

function getDefaultHandleType(inlet: ObjectInlet) {
  if (inlet.type === 'signal') return 'audio';
  if (inlet.type === 'analysis') return 'analysis';
  return 'message';
}
