import type { RawPatchData, Migration } from './types';
import { migration001 } from './migrations/001-message-node-placeholder-inlets';

/**
 * All migrations in order. Each migration upgrades from version N-1 to N.
 * Add new migrations to the end of this array.
 */
const migrations: Migration[] = [migration001];

/**
 * Current patch version - derived from the highest migration version
 */
export const CURRENT_PATCH_VERSION =
	migrations.length > 0 ? Math.max(...migrations.map((m) => m.version)) : 0;

/**
 * Parse version string to number for comparison.
 * Handles:
 *   - undefined/null -> 0
 *   - '0.0.1' (old semver format) -> 0
 *   - numeric strings -> parsed number
 *   - numbers -> as-is
 */
function parseVersion(version: string | number | undefined): number {
	if (version === undefined || version === null) return 0;
	if (typeof version === 'number') return version;

	// Old semver format '0.0.1' is treated as version 0 (pre-migration)
	if (version.includes('.')) return 0;

	const parsed = parseInt(version, 10);
	return isNaN(parsed) ? 0 : parsed;
}

/**
 * Migrate a patch from its current version to the latest version.
 *
 * This is a pure function - it does not mutate the input patch.
 * Call this immediately after parsing JSON but before using the patch data.
 *
 * @param patch - Raw patch data (possibly from old version)
 * @returns Migrated patch data with updated version
 */
export function migratePatch(patch: RawPatchData): RawPatchData {
	if (!patch) return patch;

	let currentVersion = parseVersion(patch.version);
	let migratedPatch = { ...patch };

	for (const migration of migrations) {
		if (migration.version > currentVersion) {
			console.log(`[patch-migration] Applying migration ${migration.version}: ${migration.name}`);
			migratedPatch = migration.migrate(migratedPatch);
			currentVersion = migration.version;
		}
	}

	// Update version to current
	if (currentVersion > 0) {
		migratedPatch.version = String(currentVersion);
	}

	return migratedPatch;
}

/**
 * Check if a patch needs migration
 */
export function needsMigration(patch: RawPatchData): boolean {
	const version = parseVersion(patch?.version);
	return version < CURRENT_PATCH_VERSION;
}
