import { describe, expect, it } from 'vitest';
import { extractJson } from './extract-json';

describe('extractJson', () => {
  it('returns plain JSON unchanged', () => {
    const input = '{"type":"p5","code":"circle(100,100,50)"}';
    expect(extractJson(input)).toBe(input);
  });

  it('extracts JSON from ```json fences', () => {
    const input = '```json\n{"type":"p5"}\n```';
    expect(extractJson(input)).toBe('{"type":"p5"}');
  });

  it('extracts JSON from plain ``` fences', () => {
    const input = '```\n{"type":"p5"}\n```';
    expect(extractJson(input)).toBe('{"type":"p5"}');
  });

  it('extracts nested JSON correctly', () => {
    const input = '```json\n{"type":"p5","data":{"code":"circle(100,100,50);"}}\n```';
    expect(extractJson(input)).toBe('{"type":"p5","data":{"code":"circle(100,100,50);"}}');
  });

  it('extracts JSON arrays', () => {
    const input = '```json\n[{"type":"p5"},{"type":"js"}]\n```';
    expect(extractJson(input)).toBe('[{"type":"p5"},{"type":"js"}]');
  });

  it('trims whitespace from plain JSON', () => {
    const input = '  {"type":"p5"}  ';
    expect(extractJson(input)).toBe('{"type":"p5"}');
  });

  it('handles multiline JSON in fences', () => {
    const input = '```json\n{\n  "type": "p5",\n  "code": "circle(100, 100, 50);"\n}\n```';
    const result = extractJson(input);
    expect(JSON.parse(result)).toEqual({ type: 'p5', code: 'circle(100, 100, 50);' });
  });
});
