/**
 * Auto-dispose utilities for tone~ node.
 *
 * Regex-matches `const/let/var X = new Tone.XXX` declarations in user code
 * and injects tracking code so those objects can be automatically disposed
 * on cleanup — even if the user omits a `return { cleanup }` block.
 */

/**
 * Extract variable names assigned from `new Tone.XXX` constructors.
 * Matches: const synth = new Tone.Synth(...), let rev = new Tone.Reverb(), etc.
 */
export function extractToneVarNames(code: string): string[] {
  const regex = /\b(?:const|let|var)\s+(\w+)\s*=\s*new\s+Tone\./g;
  const names: string[] = [];

  let m;

  while ((m = regex.exec(code)) !== null) {
    names.push(m[1]);
  }

  return names;
}

/**
 * Find the line index of the last top-level `return` statement.
 * Uses brace-depth counting to skip returns inside nested functions/callbacks.
 */
function findTopLevelReturnLine(lines: string[]): number {
  let depth = 0;
  let lastReturn = -1;

  for (let i = 0; i < lines.length; i++) {
    if (depth === 0 && /^\s*return\b/.test(lines[i])) {
      lastReturn = i;
    }

    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }
  }

  return lastReturn;
}

/**
 * Inject auto-dispose tracking into user code.
 * Pushes detected Tone.js variables to `__toneInstances` before the top-level return.
 * If there is no return, appends at the end.
 */
export function injectAutoDispose(code: string, varNames: string[]): string {
  if (varNames.length === 0) return code;

  const trackingCode = varNames
    .map(
      (v) =>
        `try { if (typeof ${v} !== 'undefined' && typeof ${v}?.dispose === 'function') __toneInstances.push(${v}); } catch(__e) {}`
    )
    .join('\n');

  const lines = code.split('\n');
  const returnLine = findTopLevelReturnLine(lines);

  if (returnLine >= 0) {
    lines.splice(returnLine, 0, trackingCode);
  } else {
    lines.push(trackingCode);
  }

  return lines.join('\n');
}
