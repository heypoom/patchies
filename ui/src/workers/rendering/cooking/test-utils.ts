export const COOK_TEST_UTILS = {
  ALWAYS: { mode: 'always' },
  ON_DEMAND: { mode: 'on-demand' },
  TIME_DEPENDENT: { mode: 'on-demand', timeDependent: true },
  MOUSE_DEPENDENT: { mode: 'on-demand', mouseDependent: true },
  FFT_DEPENDENT: { mode: 'on-demand', fftDependent: true },
  FRAME_DEPENDENT: { mode: 'on-demand', frameDependent: true },
  DATE_DEPENDENT: { mode: 'on-demand', dateDependent: true },
  FEEDBACK_DEPENDENT: { mode: 'on-demand', feedbackDependent: true }
};
