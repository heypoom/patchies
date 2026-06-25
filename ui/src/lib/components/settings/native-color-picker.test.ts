import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetNativeColorPickerForTests,
  dismissActiveNativeColorPicker,
  openNativeColorPicker
} from './native-color-picker';

type Listener = () => void;

class FakeColorInput {
  type = '';
  value = '';
  className = '';
  tabIndex = 0;
  ariaHidden = '';
  style = {};
  blurred = false;
  clicked = false;
  shown = false;

  private listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  blur() {
    this.blurred = true;
  }

  click() {
    this.clicked = true;
  }

  showPicker() {
    this.shown = true;
  }
}

class FakeDocument {
  input: FakeColorInput | null = null;
  createCount = 0;
  body = {
    appendChild: vi.fn()
  };

  createElement(tag: string) {
    expect(tag).toBe('input');
    this.createCount += 1;
    this.input = new FakeColorInput();
    return this.input;
  }
}

describe('native color picker helper', () => {
  beforeEach(() => {
    __resetNativeColorPickerForTests();
  });

  it('keeps applying input events after a best-effort dismiss', () => {
    const doc = new FakeDocument();
    const values: string[] = [];

    const session = openNativeColorPicker({
      value: '#111111',
      onInput: (value) => values.push(value),
      getDocument: () => doc as unknown as Document
    });

    expect(doc.input).not.toBeNull();
    expect(doc.input?.shown).toBe(true);

    doc.input!.value = '#222222';
    doc.input!.dispatch('input');

    dismissActiveNativeColorPicker(session);
    expect(doc.input?.blurred).toBe(true);

    doc.input!.value = '#333333';
    doc.input!.dispatch('input');

    expect(values).toEqual(['#222222', '#333333']);
  });

  it('reuses the persistent input and routes events to the latest opener', () => {
    const doc = new FakeDocument();
    const firstValues: string[] = [];
    const secondValues: string[] = [];

    openNativeColorPicker({
      value: '#111111',
      onInput: (value) => firstValues.push(value),
      getDocument: () => doc as unknown as Document
    });

    const input = doc.input;

    openNativeColorPicker({
      value: '#222222',
      onInput: (value) => secondValues.push(value),
      getDocument: () => doc as unknown as Document
    });

    expect(doc.createCount).toBe(1);
    expect(doc.input).toBe(input);

    doc.input!.value = '#444444';
    doc.input!.dispatch('input');

    expect(firstValues).toEqual([]);
    expect(secondValues).toEqual(['#444444']);
  });
});
