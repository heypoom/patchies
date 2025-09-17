import { writable } from 'svelte/store';

export interface MemoryRegion {
	id: number;
	offset: number;
	size: number;
	color?: number;
	machineId: number;
}

type RegionMap = Record<number, MemoryRegion[]>;

// Store for memory regions per machine
const { subscribe, set, update } = writable<RegionMap>({});

export const memoryRegionStore = {
	subscribe,

	// Add or update a memory region
	setRegion(machineId: number, region: Omit<MemoryRegion, 'machineId'>) {
		update((regions) => {
			if (!regions[machineId]) {
				regions[machineId] = [];
			}

			// Remove any existing region with the same ID
			regions[machineId] = regions[machineId].filter((r) => r.id !== region.id);

			// Add the new region
			regions[machineId].push({ ...region, machineId });

			return regions;
		});
	},

	// Remove a specific region
	removeRegion(machineId: number, regionId: number) {
		update((regions) => {
			if (regions[machineId]) {
				regions[machineId] = regions[machineId].filter((r) => r.id !== regionId);
			}
			return regions;
		});
	},

	// Clear all regions for a machine
	clearMachine(machineId: number) {
		update((regions) => {
			delete regions[machineId];
			return regions;
		});
	},

	// Get regions for a specific machine
	getRegionsForMachine(machineId: number): MemoryRegion[] {
		let regions: MemoryRegion[] = [];
		this.subscribe((allRegions) => {
			regions = allRegions[machineId] || [];
		})();
		return regions;
	},

	// Clear all regions
	clear() {
		set({});
	}
};