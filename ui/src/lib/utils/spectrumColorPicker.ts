let spectrumColorPickerReady: Promise<void> | null = null;

export function loadSpectrumColorPicker() {
  spectrumColorPickerReady ??= Promise.all([
    import('@spectrum-web-components/color-area/sp-color-area.js'),
    import('@spectrum-web-components/color-field/sp-color-field.js'),
    import('@spectrum-web-components/color-slider/sp-color-slider.js'),
    import('@spectrum-web-components/theme/sp-theme.js'),
    import('@spectrum-web-components/theme/theme-dark.js'),
    import('@spectrum-web-components/theme/scale-medium.js')
  ])
    .then(() => undefined)
    .catch((error) => {
      spectrumColorPickerReady = null;
      throw error;
    });

  return spectrumColorPickerReady;
}
