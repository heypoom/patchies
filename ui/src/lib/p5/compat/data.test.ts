import { describe, expect, it, vi } from 'vitest';
import { addData } from './data';

const createDataAddon = () => {
  const p5 = {
    Element: { prototype: { mouseMoved: vi.fn() } }
  } as unknown as Parameters<typeof addData>[0];

  const sketch = {} as Parameters<typeof addData>[1];
  addData(p5, sketch);

  return { p5, sketch };
};

describe('p5 data compatibility', () => {
  it('copies arrays into the destination with all v1 call signatures', () => {
    const { sketch } = createDataAddon();

    const source = [1, 2, 3, 4];
    const destination = [10, 20, 30, 40];

    sketch.arrayCopy(source, destination);
    expect(destination).toEqual(source);

    sketch.arrayCopy([8, 9, 10], destination, 2);
    expect(destination).toEqual([8, 9, 3, 4]);

    sketch.arrayCopy(source, 1, destination, 2, 2);
    expect(destination).toEqual([8, 9, 2, 3]);
    expect(source).toEqual([1, 2, 3, 4]);
  });

  it('installs dictionaries with numeric operations and entry management', () => {
    const { p5 } = createDataAddon();
    const strings = new p5.StringDict({ greeting: 'hello' });
    const numbers = new p5.NumberDict({ '2': 4, '10': 8 });

    strings.create('farewell', 'bye');
    expect(strings.get('greeting')).toBe('hello');
    expect(strings.get('farewell')).toBe('bye');

    numbers.add('2', 3);
    numbers.mult('10', 2);
    expect(numbers.get('2')).toBe(7);
    expect(numbers.maxValue()).toBe(16);
    expect(numbers.minKey()).toBe('2');

    numbers.remove('2');
    expect(numbers.hasKey('2')).toBe(false);
    expect(numbers.size()).toBe(1);
  });

  it('only forwards element touch movement while the primary button is pressed', () => {
    const { p5 } = createDataAddon();
    const element = p5.Element.prototype;

    const callback = vi.fn();
    const mouseMoved = vi.mocked(element.mouseMoved);
    element.touchMoved(callback);

    const move = mouseMoved.mock.calls[0][0] as (event: MouseEvent) => unknown;
    move({ buttons: 0 } as MouseEvent);
    move({ buttons: 1 } as MouseEvent);

    expect(callback).toHaveBeenCalledExactlyOnceWith({ buttons: 1 });

    element.touchMoved(false);
    expect(mouseMoved).toHaveBeenLastCalledWith(false);
  });
});
