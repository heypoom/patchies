import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectionChangeController } from './SelectionChangeController';

describe('custom widget selection', () => {
  let selected: boolean;
  let onError: ReturnType<typeof vi.fn>;
  let controller: SelectionChangeController;

  beforeEach(() => {
    selected = false;
    onError = vi.fn();
    controller = new SelectionChangeController({ getSelected: () => selected, onError });
  });

  it.each([false, true])('initializes a widget with selected=%s', (initialSelected) => {
    selected = initialSelected;
    const callback = vi.fn();

    controller.onSelectionChange(callback);

    expect(callback).toHaveBeenCalledExactlyOnceWith(initialSelected);
  });

  it('reports selection and deselection without duplicate notifications', () => {
    const callback = vi.fn();
    controller.onSelectionChange(callback);

    controller.update(false);
    controller.update(true);
    controller.update(true);
    controller.update(false);

    expect(callback.mock.calls).toEqual([[false], [true], [false]]);
  });

  it('unsubscribes independently, even when callbacks are shared', () => {
    const callback = vi.fn();
    const unsubscribe = controller.onSelectionChange(callback);
    controller.onSelectionChange(callback);
    callback.mockClear();

    unsubscribe();
    unsubscribe();
    controller.update(true);

    expect(callback).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('clears old widgets before registering a new run', () => {
    const oldCallback = vi.fn();
    controller.onSelectionChange(oldCallback);
    oldCallback.mockClear();

    controller.clear();
    selected = true;
    const newCallback = vi.fn();
    controller.onSelectionChange(newCallback);
    controller.update(false);

    expect(oldCallback).not.toHaveBeenCalled();

    expect(newCallback.mock.calls).toEqual([[true], [false]]);
  });

  it('skips a subscription removed by another callback', () => {
    let removeSecond = () => {};
    controller.onSelectionChange((isSelected) => {
      if (isSelected) removeSecond();
    });
    const second = vi.fn();
    removeSecond = controller.onSelectionChange(second);
    second.mockClear();

    controller.update(true);

    expect(second).not.toHaveBeenCalled();
  });

  it('reports callback errors without preventing other widgets from updating', () => {
    const error = new Error('widget failed');
    controller.onSelectionChange(() => {
      throw error;
    });
    const callback = vi.fn();
    controller.onSelectionChange(callback);
    callback.mockClear();
    onError.mockClear();

    controller.update(true);

    expect(onError).toHaveBeenCalledExactlyOnceWith(error);

    expect(callback).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('reports rejected async callbacks', async () => {
    const error = new Error('async widget failed');
    controller.onSelectionChange(async () => {
      throw error;
    });

    await Promise.resolve();

    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
  });
});
