/**
 * Orca Node Presets
 *
 * Pre-configured Orca patterns and demos
 */

// Helper to create a grid string from a visual pattern
function createGrid(width: number, height: number, pattern: string): string {
	const grid = new Array(width * height).fill('.');
	const lines = pattern.trim().split('\n');
	for (let y = 0; y < Math.min(lines.length, height); y++) {
		const line = lines[y];
		for (let x = 0; x < Math.min(line.length, width); x++) {
			grid[y * width + x] = line[x];
		}
	}
	return grid.join('');
}

export const ORCA_PRESETS = {
	'orca.hello': {
		type: 'orca',
		data: {
			grid: createGrid(
				64,
				16,
				`..D8....
......*.
A12.....`
			),
			width: 64,
			height: 16,
			bpm: 120,
			frame: 0
		}
	},

	'orca.clock': {
		type: 'orca',
		data: {
			grid: createGrid(
				64,
				16,
				`..C4....
......*.
A12.....`
			),
			width: 64,
			height: 16,
			bpm: 120,
			frame: 0
		}
	},

	'orca.euclidean': {
		type: 'orca',
		data: {
			grid: createGrid(
				64,
				16,
				`..U24...
......*.
:.35C.*.
B12.....`
			),
			width: 64,
			height: 16,
			bpm: 140,
			frame: 0
		}
	},

	'orca.melody': {
		type: 'orca',
		data: {
			grid: createGrid(
				64,
				16,
				`..D8....
:.35C.*.
A12.....`
			),
			width: 64,
			height: 16,
			bpm: 120,
			frame: 0
		}
	},

	'orca.random': {
		type: 'orca',
		data: {
			grid: createGrid(
				64,
				16,
				`..D8....
:R05C.*.
A12.....`
			),
			width: 64,
			height: 16,
			bpm: 120,
			frame: 0
		}
	},

	'orca.counter': {
		type: 'orca',
		data: {
			grid: createGrid(
				64,
				16,
				`..C1....
......*.
I12.....`
			),
			width: 64,
			height: 16,
			bpm: 120,
			frame: 0
		}
	},

	'orca.empty': {
		type: 'orca',
		data: {
			grid: new Array(64 * 16).fill('.').join(''),
			width: 64,
			height: 16,
			bpm: 120,
			frame: 0
		}
	}
};
