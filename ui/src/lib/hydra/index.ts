// Modified from hydra-ts (AGPL-3.0) - January 2025
// Vendored to enable configurable error handling for virtual console support

export { Hydra } from './Hydra';
export type { HydraErrorHandler, HydraErrorContext } from './Hydra';
export { Source } from './Source';
export { Output } from './Output';
export * as generators from './glsl';
export {
	generatorTransforms as defaultGenerators,
	modifierTransforms as defaultModifiers
} from './glsl/transformDefinitions';
export { createGenerators, createTransformChainClass } from './glsl/createGenerators';
