import { stripJavaScriptComments } from '$lib/utils/javascript-comments';

export const getModuleNameByNode = (nodeId: string) => `node-${nodeId}.js`;

export const isSnippetModule = (code: string): boolean => {
  const withoutComments = code.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  return /\b(import|export)\b/.test(withoutComments);
};

export type JavaScriptModuleSpecifier = {
  specifier: string;
  start: number;
  end: number;
};

const identifierCharacter = /[\w$]/;

const skipWhitespace = (code: string, start: number): number => {
  let index = start;

  while (index < code.length) {
    if (/\s/.test(code[index])) {
      index += 1;
      continue;
    }

    if (code.startsWith('//', index)) {
      const nextLine = code.indexOf('\n', index + 2);
      index = nextLine === -1 ? code.length : nextLine + 1;
      continue;
    }

    if (code.startsWith('/*', index)) {
      const commentEnd = code.indexOf('*/', index + 2);
      if (commentEnd === -1) throw new Error('Unterminated JavaScript comment');

      index = commentEnd + 2;
      continue;
    }

    break;
  }

  return index;
};

const readQuotedString = (
  code: string,
  start: number
): { specifier: JavaScriptModuleSpecifier; next: number } | null => {
  const quote = code[start];
  if (quote !== "'" && quote !== '"') return null;

  let index = start + 1;
  let value = '';

  while (index < code.length) {
    const character = code[index];

    if (character === quote) {
      return {
        specifier: { specifier: value, start: start + 1, end: index },
        next: index + 1
      };
    }

    if (character === '\\') {
      const escaped = code[index + 1];
      if (!escaped) throw new Error('Unterminated JavaScript string');

      value += escaped;
      index += 2;
      continue;
    }

    if (character === '\n' || character === '\r') {
      throw new Error('Unterminated JavaScript string');
    }

    value += character;
    index += 1;
  }

  throw new Error('Unterminated JavaScript string');
};

const skipString = (code: string, start: number): number => {
  const string = readQuotedString(code, start);
  if (string) return string.next;

  if (code[start] !== '`') return start + 1;

  let index = start + 1;

  while (index < code.length) {
    if (code[index] === '\\') {
      index += 2;
      continue;
    }

    if (code[index] === '`') return index + 1;

    index += 1;
  }

  throw new Error('Unterminated JavaScript template string');
};

const readWord = (code: string, start: number): { word: string; next: number } | null => {
  if (!/[A-Za-z_$]/.test(code[start] ?? '')) return null;

  let end = start + 1;
  while (identifierCharacter.test(code[end] ?? '')) end += 1;

  return { word: code.slice(start, end), next: end };
};

const findFromSpecifier = (code: string, start: number): JavaScriptModuleSpecifier | null => {
  let index = start;

  while (index < code.length) {
    index = skipWhitespace(code, index);
    const character = code[index];

    if (character === ';' || character === '\n' || !character) return null;
    if (character === "'" || character === '"' || character === '`') {
      index = skipString(code, index);
      continue;
    }

    const word = readWord(code, index);
    if (word?.word === 'from') {
      const stringStart = skipWhitespace(code, word.next);
      return readQuotedString(code, stringStart)?.specifier ?? null;
    }

    index = word?.next ?? index + 1;
  }

  return null;
};

/** Finds static imports, re-exports, and literal dynamic imports without matching comments or strings. */
export const getJavaScriptModuleSpecifiers = (code: string): JavaScriptModuleSpecifier[] => {
  const specifiers: JavaScriptModuleSpecifier[] = [];
  let index = 0;

  while (index < code.length) {
    index = skipWhitespace(code, index);
    const character = code[index];

    if (character === "'" || character === '"' || character === '`') {
      index = skipString(code, index);
      continue;
    }

    const word = readWord(code, index);
    if (!word || (word.word !== 'import' && word.word !== 'export')) {
      index += 1;
      continue;
    }

    const next = skipWhitespace(code, word.next);
    const directSpecifier = readQuotedString(code, next);

    if (word.word === 'import' && directSpecifier) {
      specifiers.push(directSpecifier.specifier);
      index = directSpecifier.next;
      continue;
    }

    if (word.word === 'import' && code[next] === '(') {
      const dynamicSpecifier = readQuotedString(code, skipWhitespace(code, next + 1));

      if (dynamicSpecifier) specifiers.push(dynamicSpecifier.specifier);

      index = dynamicSpecifier?.next ?? next + 1;
      continue;
    }

    const fromSpecifier = findFromSpecifier(code, next);
    if (fromSpecifier) specifiers.push(fromSpecifier);

    index = fromSpecifier ? fromSpecifier.end + 1 : word.next;
  }

  return specifiers;
};

/** Return the module specifiers imported by a JavaScript module. */
export const getImportedModuleNames = (code: string): Set<string> =>
  new Set(getJavaScriptModuleSpecifiers(code).map(({ specifier }) => specifier));

type ModuleNode = {
  id: string;
  data: Record<string, unknown>;
};

type KnownModuleResolver = {
  resolveKnown: (specifier: string, importer: string) => string | null;
};

/**
 * Find node importers of a canonical module source in dependency order.
 * VFS modules participate in traversal without pretending to be canvas nodes.
 */
export const getModuleDependentNodeIds = (
  nodes: ModuleNode[],
  changedSource: string,
  modules: ReadonlyMap<string, string>,
  resolver: KnownModuleResolver,
  sourceNodeId?: string
): string[] => {
  const sourceCode = new Map<string, string>();
  const nodeIdBySource = new Map<string, string>();

  for (const [moduleName, code] of modules) {
    if (moduleName.startsWith('patch://') || moduleName.startsWith('user://')) {
      sourceCode.set(moduleName, code);
    }
  }

  for (const node of nodes) {
    const code = typeof node.data.code === 'string' ? node.data.code : null;
    if (!code) continue;

    const source = getModuleNameByNode(node.id);

    sourceCode.set(source, code);
    nodeIdBySource.set(source, node.id);
  }

  const dependentsBySource = new Map<string, string[]>();

  for (const [importer, code] of sourceCode) {
    for (const specifier of getImportedModuleNames(code)) {
      let dependency: string | null;

      try {
        dependency = resolver.resolveKnown(specifier, importer);
      } catch {
        continue;
      }

      if (!dependency) continue;

      const dependents = dependentsBySource.get(dependency) ?? [];
      dependents.push(importer);
      dependentsBySource.set(dependency, dependents);
    }
  }

  const queue = [changedSource];
  const visitedSources = new Set(queue);
  const dependentNodeIds: string[] = [];

  while (queue.length > 0) {
    const source = queue.shift()!;

    for (const dependent of dependentsBySource.get(source) ?? []) {
      if (visitedSources.has(dependent)) continue;

      visitedSources.add(dependent);
      queue.push(dependent);

      const nodeId = nodeIdBySource.get(dependent);
      if (nodeId && nodeId !== sourceNodeId) dependentNodeIds.push(nodeId);
    }
  }

  return dependentNodeIds;
};

export function deleteAfterComment(s: string, delimiter: string) {
  // Use the String.prototype.indexOf() method to find the starting index of the delimiter.
  const index = s.indexOf(delimiter);

  // If the delimiter is found (index is not -1), return the part of the string
  // from the beginning up to the delimiter's start.
  // The substring method with one argument extracts characters from the start
  // index up to the end of the string.
  // By passing `0` and `index`, we get the substring from the start to the delimiter.
  if (index !== -1) {
    return s.substring(0, index);
  }

  // If the delimiter is not found, return the original string unchanged.
  return s;
}
