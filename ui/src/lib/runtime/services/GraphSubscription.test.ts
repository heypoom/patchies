import { describe, expect, it } from 'vitest';

import { createTestPatchRuntime } from '../utils/runtime-test-utils';

describe('PatchRuntime graph subscriptions', () => {
  it('notifies a tag query after matching object data changes', async () => {
    const runtime = createTestPatchRuntime();
    const matchingNodeIds: string[][] = [];

    runtime.subscribeGraph({ tags: ['shader/foo/*'] }, (snapshot) =>
      matchingNodeIds.push(snapshot.nodes.map(({ id }) => id))
    );

    await runtime.setObjects([
      {
        id: 'fragment',
        type: 'js',
        data: { tags: ['shader/foo/function'] }
      }
    ]);

    expect(matchingNodeIds).toEqual([['fragment']]);

    runtime.destroy();
  });
});
