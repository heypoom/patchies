import type { Node } from '@xyflow/svelte';

import { buildObjectRepresentations, type RepresentationObject } from './representation';
import type { ObjectChange } from './remote-control-types';

export class RepresentationChangeTracker {
  private signatures = new Map<string, string>();

  reset(nodes: Node[]): void {
    this.signatures = representationSignatures(nodes);
  }

  clear(): void {
    this.signatures.clear();
  }

  changes(nodes: Node[]): ObjectChange[] {
    const next = representationSignatures(nodes);
    const changedIDs = new Set<string>();

    for (const [objectID, signature] of next) {
      if (this.signatures.get(objectID) !== signature) {
        changedIDs.add(objectID);
      }
    }

    for (const objectID of this.signatures.keys()) {
      if (!next.has(objectID)) {
        changedIDs.add(objectID);
      }
    }

    return [...changedIDs].sort().map((objectId) => {
      const signature = next.get(objectId);

      return {
        objectId,
        object: signature ? (JSON.parse(signature) as RepresentationObject) : null
      };
    });
  }

  accept(changes: ObjectChange[]): void {
    for (const change of changes) {
      if (change.object) {
        this.signatures.set(change.objectId, JSON.stringify(change.object));
      } else {
        this.signatures.delete(change.objectId);
      }
    }
  }
}

const representationSignatures = (nodes: Node[]): Map<string, string> =>
  new Map(buildObjectRepresentations(nodes).map((object) => [object.id, JSON.stringify(object)]));
