import type { CookPolicy } from '$workers/rendering/CookStateManager';

/**
 * Textmode draws via a persistent callback. That callback can animate arbitrary
 * module state, which cannot be determined by source inspection.
 */
export const createTextmodeCookPolicy = (_code: string): CookPolicy => ({ mode: 'always' });
