/**
 * UniformsStore manages uniform values that persist across graph rebuilds.
 * GLSL nodes read from this store during render to get their uniform values.
 */
export class UniformsStore {
	/** Uniform values per node: nodeId -> uniformName -> value */
	private uniforms = new Map<string, Map<string, unknown>>();

	/**
	 * Get a uniform value for a specific node and uniform name.
	 */
	get(nodeId: string, name: string): unknown {
		return this.uniforms.get(nodeId)?.get(name);
	}

	/**
	 * Set a uniform value for a specific node and uniform name.
	 */
	set(nodeId: string, name: string, value: unknown): void {
		if (!this.uniforms.has(nodeId)) {
			this.uniforms.set(nodeId, new Map());
		}

		this.uniforms.get(nodeId)!.set(name, value);
	}

	/**
	 * Get all uniforms for a specific node.
	 */
	getAll(nodeId: string): Map<string, unknown> | undefined {
		return this.uniforms.get(nodeId);
	}

	/**
	 * Clear all uniforms for a specific node.
	 */
	clear(nodeId: string): void {
		this.uniforms.delete(nodeId);
	}
}
