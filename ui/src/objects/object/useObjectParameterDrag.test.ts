import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageSystem } from '$lib/messages/MessageSystem';

import { useObjectParameterDrag } from './useObjectParameterDrag.svelte';

const tracker = vi.hoisted(() => ({ capture: vi.fn(), commitIfChanged: vi.fn() }));

vi.mock('$lib/history', () => ({ useObjectDataTracker: () => tracker }));
vi.mock('$lib/runtime', () => ({ getPatchRuntime: () => null }));

class ParameterElement extends EventTarget {
  closest = () => this;
  getAttribute = () => '0';
  setPointerCapture = vi.fn();
  hasPointerCapture = () => false;
  releasePointerCapture = vi.fn();
}

const pointerEvent = (type: string, clientY: number) =>
  Object.assign(new Event(type), { altKey: true, button: 0, pointerId: 1, clientY });

afterEach(() => {
  MessageSystem.getInstance().unregisterNode('object-drag-test');

  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('object parameter drag messages', () => {
  it('delivers the dragged value to the existing inlet endpoint', () => {
    vi.stubGlobal('Element', ParameterElement);
    vi.stubGlobal('window', new EventTarget());

    const receive = vi.fn();
    MessageSystem.getInstance().registerNode('object-drag-test').addCallback(receive);

    const drag = useObjectParameterDrag({
      getNodeId: () => 'object-drag-test',
      getData: () => ({ name: 'osc~', expr: 'osc~ 440', params: [440] }),
      getInlets: () => [{ name: 'frequency', type: 'float' }]
    });

    const element = new ParameterElement();
    const detach = drag.attach(element as unknown as HTMLDivElement);

    element.dispatchEvent(pointerEvent('pointerdown', 100));
    element.dispatchEvent(pointerEvent('pointermove', 90));
    element.dispatchEvent(pointerEvent('pointerup', 90));

    expect(receive).toHaveBeenCalledExactlyOnceWith(
      450,
      expect.objectContaining({ source: 'object-drag-test', inlet: 0 })
    );

    expect(tracker.capture).toHaveBeenCalledTimes(1);
    expect(tracker.commitIfChanged).toHaveBeenCalledTimes(1);

    detach();
  });
});
