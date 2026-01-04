import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
import { nodeNames } from '$lib/nodes/node-types';
import { logger } from '$lib/utils/logger';

import { BUILTIN_OBJECT_SHORTHANDS } from '$lib/objects/builtin-shorthands';
import type { ObjectShorthand, ShorthandResult } from '$lib/objects/v2/interfaces/shorthands';

/**
 * Registry for object shorthands.
 * Allows registration and lookup of macro transformations.
 */
export class ObjectShorthandRegistry {
	private static instance: ObjectShorthandRegistry;
	private shorthands: Map<string, ObjectShorthand> = new Map();

	private constructor() {}

	/**
	 * Register a new shorthand.
	 * If a shorthand with the same primary name already exists, it will be overwritten.
	 *
	 * @param shorthand - The shorthand definition to register
	 */
	public register(shorthand: ObjectShorthand): void {
		// Use the first name as the primary key
		if (shorthand.names.length === 0) {
			logger.warn('shorthand must have at least one name', shorthand);
			return;
		}

		const primaryName = shorthand.names[0];
		this.shorthands.set(primaryName.toLowerCase(), shorthand);
	}

	/**
	 * Get all registered shorthand names for autocomplete.
	 */
	public getShorthandNames(): string[] {
		const names: string[] = [];

		this.shorthands.forEach((shorthand) => {
			names.push(...shorthand.names);
		});

		return names;
	}

	/**
	 * Try to transform an expression into a visual node.
	 * Returns the node type and data if matched, null otherwise.
	 *
	 * @param expr - The user input expression (e.g. "msg hello world")
	 * @returns ShorthandResult or null if no shorthand matches
	 */
	public tryTransform(expr: string): ShorthandResult | null {
		const name = expr.trim().toLowerCase().split(' ')[0];
		if (!name) return null;

		// Check registered shorthands first
		for (const shorthand of this.shorthands.values()) {
			if (shorthand.names.some((n) => n.toLowerCase() === name)) {
				return shorthand.transform(expr, name);
			}
		}

		// Fallback: check if it's a known visual node type
		if (nodeNames.includes(name as (typeof nodeNames)[number])) {
			return { nodeType: name, data: getDefaultNodeData(name) };
		}

		return null;
	}

	/**
	 * Get the singleton instance.
	 */
	public static getInstance(): ObjectShorthandRegistry {
		if (!ObjectShorthandRegistry.instance) {
			ObjectShorthandRegistry.instance = new ObjectShorthandRegistry();

			// Register built-in shorthands.
			BUILTIN_OBJECT_SHORTHANDS.forEach((s) => ObjectShorthandRegistry.instance.register(s));
		}

		return ObjectShorthandRegistry.instance;
	}
}
