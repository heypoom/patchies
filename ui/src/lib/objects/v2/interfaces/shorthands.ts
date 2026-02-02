/** What node type and initial node data should be */
export interface ShorthandResult {
  nodeType: string;
  data: Record<string, unknown>;
}

/**
 * Object shorthand definition.
 * Shorthands are macros that transform user input into specific node types.
 */
export interface ObjectShorthand {
  /** Names that trigger this shorthand (e.g. ['msg', 'm']) */
  names: string[];

  /** The target node type this shorthand creates (for filtering by enabled objects) */
  nodeType: string;

  /** Description for autocomplete UI */
  description?: string;

  /** Transform function that returns the node type and data */
  transform: (expr: string, matchedName: string) => ShorthandResult;
}
