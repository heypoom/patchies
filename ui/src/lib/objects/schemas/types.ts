/**
 * Schema types for object documentation.
 *
 * These types define the structure for documenting Patchies objects
 * in a way that can be used for:
 * - Inlet/outlet tooltips
 * - Help sidebar content
 * - Static /docs pages
 * - ts-pattern message validation (via TypeBox schemas)
 */

import { type TSchema, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { P } from 'ts-pattern';
import type { HandleType } from '$lib/utils/handle-id';

/**
 * Declarative handle spec for an inlet or outlet.
 * Combined with port direction to derive the xyflow handle ID via `deriveHandleId()`.
 */
export interface HandleSpec {
  /** Handle type for coloring and ID derivation (video=orange, audio=blue, message=gray) */
  handleType?: HandleType;

  /** Explicit ID segment (combined with handleType + portDir to produce final handle ID) */
  handleId?: string | number;
}

/**
 * Template pattern for dynamic handles (runtime-determined port count).
 * Used for AI context generation — tells the AI what handle ID shape to expect.
 */
export interface HandlePattern {
  /** Template string with `{index}` placeholder, e.g. 'in-{index}', 'video-in-{index}-{name}-{type}' */
  template: string;

  /** Handle type for coloring */
  handleType?: HandleType;

  /** Human-readable description of what varies */
  description?: string;
}

/**
 * A message schema with TypeBox type and description.
 */
export interface MessageSchema<T extends TSchema = TSchema> {
  /** TypeBox schema for runtime validation and type inference */
  schema: T;

  /** Human-readable description shown in tooltips and docs */
  description: string;

  /** Optional example of the message */
  example?: string;
}

/**
 * Defines an inlet that an object accepts messages on.
 */
export interface InletSchema {
  /** Unique identifier for this inlet (e.g., 'message', 'data', 'trigger') */
  id: string;

  /** Data type (e.g., 'signal', 'message', 'float') */
  type?: string;

  /** Human-readable description shown in tooltips */
  description: string;

  /** Message types this inlet accepts */
  messages?: MessageSchema[];

  /** Whether this inlet is a modulatable audio parameter (can accept signal connections) */
  isAudioParam?: boolean;

  /** Declarative handle spec for deriving the xyflow handle ID */
  handle?: HandleSpec;
}

/**
 * Defines an outlet that an object emits messages from.
 */
export interface OutletSchema {
  /** Unique identifier for this outlet (e.g., '0', '1', 'out') */
  id: string;

  /** Data type (e.g., 'signal', 'message', 'float') */
  type?: string;

  /** Human-readable description shown in tooltips */
  description: string;

  /** Message types this outlet emits */
  messages?: MessageSchema[];

  /** Declarative handle spec for deriving the xyflow handle ID */
  handle?: HandleSpec;
}

/**
 * Helper to create a ts-pattern matcher from a TypeBox schema.
 * Usage: match(msg).with(schema(BangMessage), () => ...)
 */
export function schema<T extends TSchema>(s: T) {
  return P.when((val): val is Static<T> => Value.Check(s, val));
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

  /** Dynamic handle patterns for AI context (when inlets/outlets are runtime-determined) */
  handlePatterns?: {
    inlet?: HandlePattern;
    outlet?: HandlePattern;
  };
}

/**
 * Registry of all object schemas, keyed by object type.
 */
export type ObjectSchemaRegistry = Record<string, ObjectSchema>;
