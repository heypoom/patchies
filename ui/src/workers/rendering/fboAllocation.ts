import type regl from 'regl';
import { match, P } from 'ts-pattern';
import type { FBOFormat, FBOResolution, RenderNode } from '$lib/rendering/types';
import { getFramebuffer, getRawTexture } from './utils';

export const getMrtCount = (
  node: Pick<RenderNode, 'type'> & { data: Record<string, unknown> },
  gl: WebGL2RenderingContext
): number => {
  const requestedCount = match(node)
    .with({ type: P.union('glsl', 'swgl') }, ({ data }) =>
      Math.max(1, (data.mrtCount as number | undefined) ?? 1)
    )
    .with({ type: P.union('regl', 'hydra', 'shaderpark') }, ({ data }) =>
      Math.max(1, (data.videoOutletCount as number | undefined) ?? 1)
    )
    .otherwise(() => 1);

  const maxCount = Math.min(
    gl.getParameter(gl.MAX_DRAW_BUFFERS),
    gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)
  );

  return Math.max(1, Math.min(requestedCount, maxCount));
};

export const allocateFbo = ({
  regl,
  gl,
  width,
  height,
  mrtCount,
  format,
  createTexture
}: {
  regl: regl.Regl;
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  mrtCount: number;
  format: FBOFormat;
  createTexture: (width: number, height: number, format: FBOFormat) => regl.Texture2D;
}): { colorAttachments: regl.Texture2D[]; framebuffer: regl.Framebuffer2D } => {
  const colorAttachments = Array.from({ length: mrtCount }, () =>
    createTexture(width, height, format)
  );

  const framebuffer = regl.framebuffer({
    color: colorAttachments[0],
    depthStencil: false
  });

  if (mrtCount === 1) {
    return { colorAttachments, framebuffer };
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, getFramebuffer(framebuffer));

  for (let index = 1; index < mrtCount; index++) {
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0 + index,
      gl.TEXTURE_2D,
      getRawTexture(colorAttachments[index]),
      0
    );
  }

  gl.drawBuffers(colorAttachments.map((_, index) => gl.COLOR_ATTACHMENT0 + index));
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { colorAttachments, framebuffer };
};

export const getNodeFormat = (data: Record<string, unknown>): FBOFormat =>
  (data.fboFormat as FBOFormat) || 'rgba8';

export const getNodeResolution = (data: Record<string, unknown>): FBOResolution | undefined =>
  data.resolution as FBOResolution | undefined;
