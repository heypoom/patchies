import { describe, it, expect } from 'vitest';
import { extractToneVarNames, injectAutoDispose } from './tone-auto-dispose';

describe('extractToneVarNames', () => {
  it('extracts const declarations', () => {
    const code = `const synth = new Tone.Synth().connect(outputNode);`;

    expect(extractToneVarNames(code)).toEqual(['synth']);
  });

  it('extracts let and var declarations', () => {
    const code = `let rev = new Tone.Reverb(0.5);\nvar gain = new Tone.Gain(0.8);`;

    expect(extractToneVarNames(code)).toEqual(['rev', 'gain']);
  });

  it('extracts multiple declarations', () => {
    const code = [
      `const tom = new Tone.MembraneSynth({ pitchDecay: 0.06 }).connect(outputNode);`,
      `const reverb = new Tone.Reverb(1.5).connect(outputNode);`
    ].join('\n');

    expect(extractToneVarNames(code)).toEqual(['tom', 'reverb']);
  });

  it('handles multiline constructor calls', () => {
    const code = `const tom = new Tone.MembraneSynth({
  pitchDecay: 0.06,
  octaves: 3,
  oscillator: { type: 'sine' }
}).connect(outputNode);`;

    expect(extractToneVarNames(code)).toEqual(['tom']);
  });

  it('returns empty for no Tone constructors', () => {
    const code = `const x = 42;\nrecv((data) => console.log(data));`;
    expect(extractToneVarNames(code)).toEqual([]);
  });

  it('ignores Tone method calls (not constructors)', () => {
    const code = `const ctx = Tone.getContext();`;
    expect(extractToneVarNames(code)).toEqual([]);
  });
});

describe('injectAutoDispose', () => {
  it('returns code unchanged when no varNames', () => {
    const code = `const x = 42;`;
    expect(injectAutoDispose(code, [])).toBe(code);
  });

  it('appends tracking at end when no return', () => {
    const code = [
      `const synth = new Tone.Synth().connect(outputNode);`,
      `recv((data) => synth.triggerAttackRelease("C3", 0.2));`
    ].join('\n');

    const result = injectAutoDispose(code, ['synth']);
    const lines = result.split('\n');

    // Original lines preserved
    expect(lines[0]).toBe(`const synth = new Tone.Synth().connect(outputNode);`);
    expect(lines[1]).toBe(`recv((data) => synth.triggerAttackRelease("C3", 0.2));`);

    // Tracking appended
    expect(lines[2]).toContain('__toneInstances.push(synth)');
  });

  it('injects tracking before top-level return', () => {
    const code = [
      `const synth = new Tone.Synth().connect(outputNode);`,
      `return { cleanup: () => { synth.dispose(); } };`
    ].join('\n');

    const result = injectAutoDispose(code, ['synth']);
    const lines = result.split('\n');

    expect(lines[0]).toBe(`const synth = new Tone.Synth().connect(outputNode);`);
    expect(lines[1]).toContain('__toneInstances.push(synth)');
    expect(lines[2]).toContain('return');
  });

  it('skips return inside nested callbacks (brace depth > 0)', () => {
    const code = [
      `const synth = new Tone.Synth().connect(outputNode);`,
      `recv((data) => {`,
      `  if (!data) return;`,
      `  synth.triggerAttackRelease("C3", 0.2);`,
      `});`
    ].join('\n');

    const result = injectAutoDispose(code, ['synth']);
    const lines = result.split('\n');

    // Tracking should be at the end, not before the inner return
    expect(lines[lines.length - 1]).toContain('__toneInstances.push(synth)');
  });

  it('handles multiple variables', () => {
    const code = [
      `const synth = new Tone.Synth();`,
      `const reverb = new Tone.Reverb();`,
      `return { cleanup: () => {} };`
    ].join('\n');

    const result = injectAutoDispose(code, ['synth', 'reverb']);

    expect(result).toContain('__toneInstances.push(synth)');
    expect(result).toContain('__toneInstances.push(reverb)');

    // Both tracking lines should be before the return
    const lines = result.split('\n');
    const returnIdx = lines.findIndex((l) => l.includes('return'));
    const synthIdx = lines.findIndex((l) => l.includes('push(synth)'));
    const reverbIdx = lines.findIndex((l) => l.includes('push(reverb)'));

    expect(synthIdx).toBeLessThan(returnIdx);
    expect(reverbIdx).toBeLessThan(returnIdx);
  });
});
