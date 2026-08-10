import { stripJavaScriptComments } from '$lib/utils/javascript-comments';

export const getModuleNameByNode = (nodeId: string) => `node-${nodeId}.js`;

export const isSnippetModule = (code: string): boolean => {
  const withoutComments = code.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  return /\b(import|export)\b/.test(withoutComments);
};

/**
 * If a code has a comment like // @lib <lib-name>, return the lib name.
 *
 * Example: '// @lib lodash' => 'lodash'
 */
export const getLibName = (code: string): string | null => {
  const match = code.match(/\/\/\s*@lib\s+(\S+)/);

  return match ? match[1] : null;
};

/** Return the module specifiers imported by a JavaScript module. */
export const getImportedModuleNames = (code: string): Set<string> => {
  const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
  const moduleNames = new Set<string>();
  const codeWithoutComments = stripJavaScriptComments(code);
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(codeWithoutComments)) !== null) {
    moduleNames.add(match[1]);
  }

  return moduleNames;
};

type ModuleNode = {
  id: string;
  data: Record<string, unknown>;
};

/**
 * Find every node that needs to run after a named canvas library is refreshed.
 * Library importers are included so that their own dependents can be discovered.
 */
export const getLibraryDependentNodeIds = (
  nodes: ModuleNode[],
  libraryName: string,
  sourceNodeId: string
): string[] => {
  const moduleNames = [libraryName];
  const dependentNodeIds: string[] = [];

  let foundNewLibrary: boolean;

  do {
    foundNewLibrary = false;

    for (const node of nodes) {
      const nodeCode = typeof node.data.code === 'string' ? node.data.code : null;
      if (!nodeCode || node.id === sourceNodeId || dependentNodeIds.includes(node.id)) continue;

      const importedModuleNames = getImportedModuleNames(nodeCode);
      if (!moduleNames.some((moduleName) => importedModuleNames.has(moduleName))) continue;

      dependentNodeIds.push(node.id);

      const dependentLibraryName =
        typeof node.data.libraryName === 'string' ? node.data.libraryName : getLibName(nodeCode);

      if (dependentLibraryName && !moduleNames.includes(dependentLibraryName)) {
        moduleNames.push(dependentLibraryName);
        foundNewLibrary = true;
      }
    }
  } while (foundNewLibrary);

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
