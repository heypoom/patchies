import { describe, expect, it } from 'vitest';
import { transformFExprExpression } from './fexpr-transform';

describe('transformFExprExpression', () => {
  it('converts control values: $1 → c1', () => {
    expect(transformFExprExpression('$1 + $2')).toBe('c1 + c2');
  });

  it('converts bare s with history: s[-1] → x1(-1)', () => {
    expect(transformFExprExpression('s[-1]')).toBe('x1(-1)');
    expect(transformFExprExpression('s[-2.5]')).toBe('x1(-2.5)');
  });

  it('converts input history access: x1[-1] → x1(-1)', () => {
    expect(transformFExprExpression('x1[-1]')).toBe('x1(-1)');
    expect(transformFExprExpression('s1[-2]')).toBe('s1(-2)');
    expect(transformFExprExpression('x2[-1.5]')).toBe('x2(-1.5)');
  });

  it('converts output history access: y1[-1] → y1(-1)', () => {
    expect(transformFExprExpression('y1[-1]')).toBe('y1(-1)');
    expect(transformFExprExpression('y2[-3]')).toBe('y2(-3)');
  });

  it('converts bare variables to current sample: x1 → x1(0)', () => {
    expect(transformFExprExpression('x1 + x2')).toBe('x1(0) + x2(0)');
    expect(transformFExprExpression('s1 * s2')).toBe('s1(0) * s2(0)');
  });

  it('converts bare s to x1(0)', () => {
    expect(transformFExprExpression('s * 2')).toBe('x1(0) * 2');
  });

  it('does not double-convert already-converted accessors', () => {
    // x1[-1] should become x1(-1), not x1(-1)(0)
    expect(transformFExprExpression('x1[-1] + x1')).toBe('x1(-1) + x1(0)');
  });

  it('handles a full IIR filter expression', () => {
    const input = 'x1 * 0.1 + y1[-1] * 0.9';
    const expected = 'x1(0) * 0.1 + y1(-1) * 0.9';

    expect(transformFExprExpression(input)).toBe(expected);
  });

  it('handles multi-outlet with cross-outlet y references', () => {
    expect(transformFExprExpression('y2[-1] * 0.5')).toBe('y2(-1) * 0.5');
  });
});
