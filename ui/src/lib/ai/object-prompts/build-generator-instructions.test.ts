import { describe, expect, it } from 'vitest';

import { buildMultiObjectInstructionParts } from './build-generator-instructions';

describe('buildMultiObjectInstructionParts', () => {
  it('deduplicates shared object instruction bodies across different object types', () => {
    const { objectInstructions } = buildMultiObjectInstructionParts(['+', '-', '*', '/']);

    expect(objectInstructions.match(/## Numeric Operator Object Instructions/g)).toHaveLength(1);
    expect(objectInstructions).toContain('Applies to: +, -, *, /');
  });
});
