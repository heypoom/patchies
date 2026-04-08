import { createGenerators, createTransformChainClass } from './createGenerators';
import { generatorTransforms, modifierTransforms } from './transformDefinitions';

export const TransformChainClass = createTransformChainClass(modifierTransforms);
const generators = createGenerators(generatorTransforms, TransformChainClass);

export const { gradient, noise, osc, shape, solid, src, voronoi } = generators;
