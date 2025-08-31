/**
 * Calculate the position of a port (inlet or outlet) based on count and index.
 * Returns a CSS percentage string for positioning.
 */
export function getPortPosition(count: number, index: number): string {
	if (count === 1) return '50%';
	if (count <= 3) return `${35 + (index / (count - 1)) * 30}%`;
	if (count <= 6) return `${20 + (index / (count - 1)) * 60}%`;
	if (count <= 9) return `${15 + (index / (count - 1)) * 70}%`;

	return `${5 + (index / (count - 1)) * 90}%`;
}
