export const VALUE_WIDGET_CHANGE_EVENT = 'patchies:value-widget-change';
export const VALUE_WIDGET_VIEWPORT_CHANGE_EVENT = 'patchies:value-widget-viewport-change';

export const shouldRunOnValueWidgetChange = (language: string, nodeType?: string) =>
  language === 'glsl' || nodeType === 'shaderpark';
