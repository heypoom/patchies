import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';
import { msg } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

export interface EditorAppearanceData {
  fontFamily?: string;
  fontSize?: number;
  expandedFontSize?: number;
  styles?: Record<string, string>;
}

export function resolveEditorFontSizes(
  data: EditorAppearanceData,
  defaultFontSize: number,
  defaultExpandedFontSize: number
) {
  const normal = data.fontSize ?? defaultFontSize;
  const expanded = Math.max(normal + 1, data.expandedFontSize ?? defaultExpandedFontSize);

  return { normal, expanded };
}

const SetFontSize = msg('setFontSize', { value: Type.Number() });
const SetExpandedFontSize = msg('setExpandedFontSize', { value: Type.Number() });
const SetFontFamily = msg('setFontFamily', { value: Type.String() });
const SetStyles = msg('setStyles', {
  value: Type.Object({ container: Type.Optional(Type.String()) })
});

export const editorAppearanceMessages = {
  setFontSize: schema(SetFontSize),
  setExpandedFontSize: schema(SetExpandedFontSize),
  setFontFamily: schema(SetFontFamily),
  setStyles: schema(SetStyles)
};

export const editorAppearanceMessageSchemas = [
  { schema: SetFontSize, description: 'Set normal editor font size' },
  { schema: SetExpandedFontSize, description: 'Set expanded editor font size' },
  { schema: SetFontFamily, description: 'Set editor font family' },
  { schema: SetStyles, description: 'Set custom styles for editor container' }
];

export const getEditorAppearanceUpdate = (message: unknown): EditorAppearanceData | undefined =>
  match(message)
    .with(editorAppearanceMessages.setFontSize, ({ value }) => ({ fontSize: value }))
    .with(editorAppearanceMessages.setExpandedFontSize, ({ value }) => ({
      expandedFontSize: value
    }))
    .with(editorAppearanceMessages.setFontFamily, ({ value }) => ({ fontFamily: value }))
    .with(editorAppearanceMessages.setStyles, ({ value }) => ({ styles: value }))
    .otherwise(() => undefined);
