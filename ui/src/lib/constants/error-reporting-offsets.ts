// TODO: remove these wrapper offsets.
// They were a remnant of the old execution environment.
// With the new JSRunner, we don't need to adjust the error line numbers.
export const CANVAS_WRAPPER_OFFSET = 0;
export const CANVAS_DOM_WRAPPER_OFFSET = 0;
export const TONE_WRAPPER_OFFSET = 0;
export const ELEM_WRAPPER_OFFSET = 0;
export const SONIC_WRAPPER_OFFSET = 0;
export const HYDRA_WRAPPER_OFFSET = 0;
export const DOM_WRAPPER_OFFSET = 0;
export const VUE_WRAPPER_OFFSET = 0;

// three and three.dom has different wrapper structures
export const THREE_WRAPPER_OFFSET = 4;
export const THREE_DOM_WRAPPER_OFFSET = 3;

// p5 has different wrapper structures
export const P5_WRAPPER_OFFSET = 4;

// dsp~ does not use JSRunner
export const DSP_WRAPPER_OFFSET = -2;
