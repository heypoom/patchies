import type regl from 'regl';

export const getFramebuffer = (
  reglFramebuffer: regl.Framebuffer2D | null
): WebGLFramebuffer | null => {
  // @ts-expect-error -- hack: access WebGLFramebuffer directly
  return reglFramebuffer._framebuffer.framebuffer || null;
};
