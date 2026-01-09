/**
 * Main entry point for AI object resolution.
 * Re-exports from specialized modules to keep the codebase clean and maintainable.
 */

// Export types
export type { SimplifiedEdge, MultiObjectResult } from './multi-object-resolver';

// Export single object resolution
export { resolveObjectFromPrompt } from './single-object-resolver';

// Export multi-object resolution
export { resolveMultipleObjectsFromPrompt } from './multi-object-resolver';

// Export edit object resolution
export { editObjectFromPrompt } from './edit-object-resolver';
