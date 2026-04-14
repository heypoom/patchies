import { describe, expect, it } from 'vitest';
import {
  isAssignment,
  parseMultiOutletExpressions,
  parseOutletCount,
  createMultiOutletEvaluator
} from './expr-parser';

describe('isAssignment', () => {
  it('detects simple assignments', () => {
    expect(isAssignment('a = 5')).toBe(true);
    expect(isAssignment('foo = $1 * 2')).toBe(true);
  });

  it('rejects comparisons', () => {
    expect(isAssignment('$1 == 5')).toBe(false);
    expect(isAssignment('$1 != 3')).toBe(false);
    expect(isAssignment('$1 <= 10')).toBe(false);
    expect(isAssignment('$1 >= 0')).toBe(false);
  });

  it('rejects plain expressions', () => {
    expect(isAssignment('$1 + $2')).toBe(false);
    expect(isAssignment('$1.note + 20')).toBe(false);
  });
});

describe('parseMultiOutletExpressions', () => {
  it('single expression = 1 outlet', () => {
    const result = parseMultiOutletExpressions('$1 + $2');

    expect(result.outletCount).toBe(1);
    expect(result.outletExpressions).toEqual(['$1 + $2']);
    expect(result.assignments).toEqual([]);
  });

  it('semicolon-separated expressions = multiple outlets', () => {
    const result = parseMultiOutletExpressions('$1 + 1; $1 * 2');

    expect(result.outletCount).toBe(2);
    expect(result.outletExpressions).toEqual(['$1 + 1', '$1 * 2']);
  });

  it('newline-only expressions stay as single outlet (newlines are not separators)', () => {
    const result = parseMultiOutletExpressions('$1 > 20\n  ? "ok"\n  : "no"');

    expect(result.outletCount).toBe(1);
    expect(result.outletExpressions).toHaveLength(1);
  });

  it('assignments do not create outlets', () => {
    const result = parseMultiOutletExpressions('a = $1 * 2; b = $2 + 3; a + b');

    expect(result.outletCount).toBe(1);
    expect(result.assignments).toEqual(['a = $1 * 2', 'b = $2 + 3']);
    expect(result.outletExpressions).toEqual(['a + b']);
  });

  it('mixed assignments and outlets', () => {
    const result = parseMultiOutletExpressions('a = $1 * 2; a + 1; a - 1; a * 3');

    expect(result.outletCount).toBe(3);
    expect(result.assignments).toEqual(['a = $1 * 2']);
    expect(result.outletExpressions).toEqual(['a + 1', 'a - 1', 'a * 3']);
  });

  it('empty expression = 1 outlet', () => {
    const result = parseMultiOutletExpressions('');

    expect(result.outletCount).toBe(1);
  });
});

describe('parseOutletCount', () => {
  it('returns 1 for empty/single expressions', () => {
    expect(parseOutletCount('')).toBe(1);
    expect(parseOutletCount('$1 + 2')).toBe(1);
  });

  it('counts non-assignment expressions', () => {
    expect(parseOutletCount('$1 + 1; $1 * 2')).toBe(2);
    expect(parseOutletCount('a = $1; a + 1; a - 1')).toBe(2);
  });
});

describe('createMultiOutletEvaluator', () => {
  it('single expression evaluates correctly', () => {
    const result = createMultiOutletEvaluator('$1 + $2');
    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.fns).toHaveLength(1);
    expect(result.fns[0](3, 7)).toBe(10);
  });

  it('multiple outlets evaluate independently', () => {
    const result = createMultiOutletEvaluator('$1 + 1; $1 * 2');
    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.fns).toHaveLength(2);
    expect(result.fns[0](5)).toBe(6);
    expect(result.fns[1](5)).toBe(10);
  });

  it('assignments are shared across outlet evaluators', () => {
    const result = createMultiOutletEvaluator('a = $1 * 2; a + 1; a - 1');
    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.fns).toHaveLength(2);
    expect(result.fns[0](5)).toBe(11); // a=10, 10+1
    expect(result.fns[1](5)).toBe(9); // a=10, 10-1
  });

  it('returns error for invalid expression', () => {
    const result = createMultiOutletEvaluator('$1 +');

    expect(result.success).toBe(false);
  });
});
