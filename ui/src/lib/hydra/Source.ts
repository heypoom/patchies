import type { Texture2D, TextureImageData } from 'regl';
import type { GlEnvironment } from './Hydra';

export class Source {
  environment: GlEnvironment;
  src?: TextureImageData;
  dynamic: boolean;
  tex: Texture2D;

  constructor(environment: GlEnvironment) {
    this.environment = environment;
    this.src = undefined;
    this.dynamic = true;

    this.tex = environment.regl.texture({
      shape: [1, 1]
    });
  }

  init = (opts: { src: Source['src']; dynamic: boolean }) => {
    if (opts.src) {
      this.src = opts.src;
      this.tex = this.environment.regl.texture(this.src);
    }

    if (opts.dynamic) {
      this.dynamic = opts.dynamic;
    }
  };

  // These are all placeholders.
  // We are in the rendering pipeline, so these are not supported.
  initCam = () => {};
  initVideo = () => {};
  initImage = () => {};
  initScreen = () => {};

  clear = () => {
    if (this.src && 'srcObject' in this.src && this.src.srcObject) {
      if ('getTracks' in this.src.srcObject && this.src.srcObject.getTracks) {
        this.src.srcObject.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    }
    this.src = undefined;
    this.tex = this.environment.regl.texture({ shape: [1, 1] });
  };

  tick = () => {
    if (this.src && this.dynamic) {
      if (
        'videoWidth' in this.src &&
        this.src.videoWidth &&
        this.src.videoWidth !== this.tex.width
      ) {
        this.tex.resize(this.src.videoWidth, this.src.videoHeight);
      }

      if ('width' in this.src && this.src.width && this.src.width !== this.tex.width) {
        this.tex.resize(this.src.width, this.src.height);
      }

      this.tex.subimage(this.src);
    }
  };

  // Used by glsl-utils/formatArguments
  getTexture = () => {
    return this.tex;
  };
}
