import { describe, expect, it } from 'vitest';

import { parseCanvasDimensions, shouldResetP5CanvasSize } from './component-helpers';

describe('parseCanvasDimensions', () => {
  it('should extract width and height from createCanvas call', () => {
    const code = `function setup() {
			createCanvas(400, 300)
		}`;

    expect(parseCanvasDimensions(code)).toEqual({ width: 400, height: 300 });
  });

  it('should ignore the renderer argument in createCanvas call', () => {
    const code = `function setup() {
			createCanvas(300, 300, WEBGL);
		}`;

    expect(parseCanvasDimensions(code)).toEqual({ width: 300, height: 300 });
  });

  it('should return null when no createCanvas call is found', () => {
    const code = `function setup() {
			background(0)
		}`;

    expect(parseCanvasDimensions(code)).toBeNull();
  });

  it('keeps preloaded canvas dimensions when code calls createCanvas', () => {
    expect(
      shouldResetP5CanvasSize(`function setup() {
			createCanvas(320, 180)
		}`)
    ).toBe(false);
  });

  it('keeps preloaded canvas dimensions when code calls createSurfaceCanvas', () => {
    expect(
      shouldResetP5CanvasSize(`function setup() {
			createSurfaceCanvas()
		}`)
    ).toBe(false);
  });

  it('clears preloaded canvas dimensions when code no longer calls createCanvas', () => {
    expect(
      shouldResetP5CanvasSize(`function setup() {
			background(0)
		}`)
    ).toBe(true);
  });

  it('clears preloaded canvas dimensions when createCanvas only appears in comments', () => {
    expect(
      shouldResetP5CanvasSize(`function setup() {
			// createCanvas(320, 180)
			background(0)
		}`)
    ).toBe(true);

    expect(
      shouldResetP5CanvasSize(`function setup() {
			/* createCanvas(320, 180) */
			background(0)
		}`)
    ).toBe(true);
  });
});
