export { inlineValueWidgets } from './extension';
export { findInlineValueWidgets } from './detection';
export {
  dragDeltaForNumber,
  formatDraggedNumber,
  formatNormalizedVectorComponent,
  formatNormalizedVectorComponents,
  updateDraggedNumberComponent
} from './widgets/number-widget';
export { formatColorComponents, formatNormalizedColorComponents } from './widgets/color-widget';
export type {
  InlineValueComponent,
  InlineValueWidgetContext,
  InlineValueWidgetInfo,
  InlineValueWidgetKind,
  InlineValueWidgetLanguage
} from './types';
