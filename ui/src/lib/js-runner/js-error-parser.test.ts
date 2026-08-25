import { describe, expect, it } from 'vitest';

import { parseJSError } from './js-error-parser';

describe('parseJSError', () => {
  it('maps a Pixi draw wrapper runtime error to the user-code line', () => {
    const error = new Error('Pixi draw failed');
    error.stack = 'Error: Pixi draw failed\n    at <anonymous>:12:7';

    expect(parseJSError(error, 5, 1)).toEqual({
      message: 'Pixi draw failed',
      lineErrors: { 4: ['Pixi draw failed'] }
    });
  });
});
