const PASSTHRU_SWGL = `
setVideoCount(1)

function render({t}) {
  glsl({
    t,
    tex: getTexture(0),
    FP: \`tex(UV)\`
  })
}
`;

type Schema = {
  code: string;
  videoInletCount?: number;
  videoOutletCount?: number;
  messageInletCount?: number;
  messageOutletCount?: number;
};

export const SWGL_PRESETS: Record<string, { type: string; data: Schema }> = {
  'swgl>': {
    type: 'swgl',
    data: {
      code: PASSTHRU_SWGL.trim(),
      videoInletCount: 1,
      videoOutletCount: 1,
      messageInletCount: 1,
      messageOutletCount: 0
    }
  }
};
