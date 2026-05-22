import { describe, expect, it } from 'vitest';

import { parseCanvasDimensions } from './component-helpers';

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
});
