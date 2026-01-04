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
	| 'marker';

/**
 * Inlet definition for a node.
 */
export interface ObjectInlet {
	name?: string;
	type?: ObjectDataType;
	description?: string;

	/** Does this inlet represent an audio parameter in the audio node? **/
	isAudioParam?: boolean;

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
