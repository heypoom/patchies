/**
 * Schema types for object documentation.
 *
 * These types define the structure for documenting Patchies objects
 * in a way that can be used for:
 * - Inlet/outlet tooltips
 * - Help sidebar content
 * - Static /docs pages
 * - ts-pattern message validation
 */

/**
 * Defines an inlet message that an object accepts.
 */
export interface InletSchema {
  /** Unique identifier for this inlet message (e.g., 'bang', 'set', 'start') */
  id: string;

  /** Human-readable description shown in tooltips and docs */
  description: string;

  /** Optional argument names for messages that take parameters */
  args?: string[];

  /** Example usage */
  example?: string;
}

/**
 * Defines an outlet message that an object emits.
 */
export interface OutletSchema {
  /** Unique identifier for this outlet (e.g., '0', '1', 'out') */
  id: string;

  /** Human-readable description shown in tooltips and docs */
  description: string;
}

/**
 * Complete schema for documenting a Patchies object.
 */
export interface ObjectSchema {
  /** Object type name (e.g., 'trigger', 'metro', 'mqtt') */
  type: string;

  /** Category for organization (e.g., 'control', 'audio', 'network') */
  category: string;

  /** Short description shown in object browser */
  description: string;

  /** Inlet definitions */
  inlets: InletSchema[];

  /** Outlet definitions */
  outlets: OutletSchema[];

  /** Optional tags for search */
  tags?: string[];

  /** Whether this object has dynamic outlets (like trigger) */
  hasDynamicOutlets?: boolean;
}

/**
 * Registry of all object schemas, keyed by object type.
 */
export type ObjectSchemaRegistry = Record<string, ObjectSchema>;
