import type { TSchema } from '@sinclair/typebox';

/**
 * Data types for node inlets/outlets.
 */
export type ObjectDataType =
  | 'any'
  | 'message'
  | 'signal'
  | 'bang'
  | 'float'
  | 'int'
  | 'string'
  | 'bool'
  | 'int[]'
  | 'float[]'
  | 'analysis'
  | 'marker'
  | 'symbol';

/**
 * Message schema definition with TypeBox for validation.
 */
export interface InletMessage<T extends TSchema = TSchema> {
  /** TypeBox schema for runtime validation and type inference */
  schema: T;

  /** Human-readable description shown in tooltips and docs */
  description: string;

  /** Optional example of the message */
  example?: string;
}

/**
 * Inlet definition for a node.
 */
export interface ObjectInlet {
  name?: string;
  type?: ObjectDataType;
  description?: string;

  /**
   * TypeBox message schemas for rich validation and documentation.
   * When provided, these are used for docs generation and validation.
   */
  messages?: InletMessage[];

  /** Does this inlet represent an audio parameter in the audio node? **/
  isAudioParam?: boolean;

  /**
   * When true, the inlet is hidden from the UI but still available as a parameter.
   * Useful for configuration inlets like store names that are set via arguments
   * but don't need visible handles (e.g., `[kv storename]`).
   */
  hidden?: boolean;

  /** Floating point precision for displays. */
  precision?: number;

  /** Maximum floating point precision. */
  maxPrecision?: number;

  /** Default value. */
  defaultValue?: unknown;

  /** Valid values */
  options?: unknown[];

  minNumber?: number;
  maxNumber?: number;

  /** Maximum number of values to display for arrays. */
  maxDisplayLength?: number;

  /** Custom validator. */
  validator?: (value: unknown) => boolean;

  /** Custom formatter. */
  formatter?: (value: unknown) => string | null;
}

/**
 * Outlet definition for a node.
 */
export interface ObjectOutlet {
  name?: string;
  type?: ObjectDataType;
  description?: string;

  /**
   * TypeBox message schemas for documentation.
   */
  messages?: InletMessage[];
}

/**
 * Metadata for a node type (inlets, outlets, description, tags).
 * These are optional static properties on node classes.
 */
export interface ObjectMetadata {
  inlets?: ObjectInlet[];
  outlets?: ObjectOutlet[];
  description?: string;
  tags?: string[];
}
