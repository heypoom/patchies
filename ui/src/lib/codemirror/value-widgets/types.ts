import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common';

export type InlineValueWidgetKind = 'number' | 'xy' | 'color';
export type InlineValueWidgetLanguage = 'javascript' | 'glsl' | 'peppermint';

export interface InlineValueComponent {
  from: number;
  to: number;
  text: string;
  value: number;
}

export interface InlineValueWidgetInfo {
  kind: InlineValueWidgetKind;
  from: number;
  to: number;
  text: string;
  components: InlineValueComponent[];
  colorPicker?: boolean;
}

export interface InlineValueWidgetContext {
  nodeType?: string;
}

export interface EmbeddedRange {
  from: number;
  to: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface GridRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GridPosition {
  left: number;
  top: number;
}

export type VectorComponentTexts = [string, string] | [string, string, string];

export type NumericSyntaxNode = Pick<SyntaxNode | SyntaxNodeRef, 'name' | 'from' | 'to'> & {
  parent?: SyntaxNode | null;
  node?: SyntaxNode;
};
