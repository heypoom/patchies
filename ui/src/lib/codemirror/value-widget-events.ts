export const VALUE_WIDGET_CHANGE_EVENT = 'patchies:value-widget-change';
export const VALUE_WIDGET_VIEWPORT_CHANGE_EVENT = 'patchies:value-widget-viewport-change';

export const VALUE_WIDGET_GLSL_RUN_THROTTLE_MS = 30;
export const VALUE_WIDGET_HYDRA_RUN_THROTTLE_MS = 30;
export const VALUE_WIDGET_P5_RUN_THROTTLE_MS = 50;
export const VALUE_WIDGET_SHADERPARK_RUN_THROTTLE_MS = 120;

export const shouldRunOnValueWidgetChange = (language: string, nodeType?: string) =>
  language === 'glsl' || nodeType === 'hydra' || nodeType === 'p5' || nodeType === 'shaderpark';

export const valueWidgetRunThrottleMs = (language: string, nodeType?: string) => {
  if (language === 'glsl') {
    return VALUE_WIDGET_GLSL_RUN_THROTTLE_MS;
  }

  if (language === 'javascript' && nodeType === 'hydra') {
    return VALUE_WIDGET_HYDRA_RUN_THROTTLE_MS;
  }

  if (language === 'javascript' && nodeType === 'p5') {
    return VALUE_WIDGET_P5_RUN_THROTTLE_MS;
  }

  if (language === 'javascript' && nodeType === 'shaderpark') {
    return VALUE_WIDGET_SHADERPARK_RUN_THROTTLE_MS;
  }

  return 0;
};
