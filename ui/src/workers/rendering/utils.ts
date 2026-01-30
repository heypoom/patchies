export const getFramebuffer = (reglFramebuffer: regl.Framebuffer2D): WebGLFramebuffer | null => {
  // @ts-expect-error -- hack: access WebGLFramebuffer directly
  return reglFramebuffer._framebuffer.framebuffer || null;
};
