/**
 * Patch-to-Prompt Generator
 *
 * Generates LLM-friendly prompts/specifications from patches,
 * enabling users to recreate patch functionality in their own projects.
 */

export {
  cleanPatch,
  patchToJson,
  type CleanedPatch,
  type CleanedNode,
  type CleanedEdge
} from './patch-transformer';

export {
  getContextForTypes,
  getBriefDescriptions,
  getImplementationHints
} from './context-injector';

export {
  buildDirectTemplate,
  estimateTemplateSize,
  isTemplateTooLarge,
  SIZE_THRESHOLD,
  type TemplateOptions
} from './template-builder';

export { EXAMPLE_PROMPTS, getRandomPrompt } from './example-prompts';

export { refineSpec, hasGeminiApiKey, type RefineOptions } from './spec-refiner';
