import { Patcher } from '$lib/core/Patcher';

// Global Patcher instance store
let patcherInstance: Patcher | null = null;

export function getPatcher(): Patcher {
	if (!patcherInstance) {
		patcherInstance = new Patcher();
	}
	return patcherInstance;
}

export function setPatcher(patcher: Patcher): void {
	patcherInstance = patcher;
}

export function destroyPatcher(): void {
	if (patcherInstance) {
		patcherInstance.destroy();
		patcherInstance = null;
	}
}