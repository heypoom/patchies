import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick, type ComponentProps } from 'svelte';
import ArrowKeyMoveFlow from './test-fixtures/ArrowKeyMoveFlow.svelte';

type Harness = Parameters<ComponentProps<typeof ArrowKeyMoveFlow>['onReady']>[0];

let component: ReturnType<typeof mount> | undefined;

async function setup() {
  let harness: Harness | undefined;

  component = mount(ArrowKeyMoveFlow, {
    target: document.body,
    props: { onReady: (value) => (harness = value) }
  });

  await vi.waitFor(() => {
    expect(harness).toBeDefined();

    expect(
      document.querySelector('[data-id="protected"]')?.getBoundingClientRect().width
    ).toBeGreaterThan(0);
  });

  return harness!;
}

afterEach(async () => {
  if (component) await unmount(component);

  component = undefined;
});

it('blocks focused-node arrow movement while allowing keyboard events and pointer dragging', async () => {
  const harness = await setup();
  const node = document.querySelector<HTMLElement>('[data-id="protected"]')!;
  const onKeyDown = vi.fn();

  node.addEventListener('keydown', onKeyDown);
  harness.noArrowKeyMove();
  node.focus();

  const shiftRight = new KeyboardEvent('keydown', {
    key: 'ArrowRight',
    shiftKey: true,
    bubbles: true
  });

  node.dispatchEvent(shiftRight);
  await tick();

  expect(harness.getNodes().find((node) => node.id === 'protected')?.position.x).toBe(0);
  expect(harness.getNodes().find((node) => node.id === 'other')?.position.x).toBe(220);
  expect(onKeyDown).toHaveBeenCalledOnce();
  expect(node.classList.contains('draggable')).toBe(true);
  expect(harness.getState().dragEnabled).toBe(true);

  harness.reset();

  const right = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
  node.dispatchEvent(right);
  await tick();

  expect(harness.getNodes().find((node) => node.id === 'protected')?.position.x).toBe(5);
});

it('includes arrow movement in noInteract and restores it on rerun', async () => {
  const harness = await setup();
  harness.noInteract();
  harness.moveSelection();
  await tick();

  expect(harness.getState()).toEqual({
    dragEnabled: false,
    panEnabled: false,
    wheelEnabled: false,
    arrowKeyMoveEnabled: false
  });

  expect(harness.getNodes().find((node) => node.id === 'protected')?.position.x).toBe(0);
  expect(harness.getNodes().find((node) => node.id === 'other')?.position.x).toBe(220);

  harness.reset();
  harness.moveSelection();
  await tick();

  expect(harness.getNodes().find((node) => node.id === 'protected')?.position.x).toBe(20);
});

it('keeps arrow movement available when only pointer interactions are disabled', async () => {
  const harness = await setup();
  harness.noDrag();
  harness.noPan();
  harness.noWheel();
  harness.moveSelection();
  await tick();

  expect(harness.getState().arrowKeyMoveEnabled).toBe(true);
  expect(harness.getNodes().find((node) => node.id === 'protected')?.position.x).toBe(20);
  expect(harness.getNodes().find((node) => node.id === 'other')?.position.x).toBe(220);
});
