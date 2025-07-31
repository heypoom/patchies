import regl from 'regl';

// Render a simple quad for a vertex shader.
const VERTEX_SHADER = `
  precision highp float;
  attribute vec2 position;
	varying vec2 uv;

  void main() {
		uv = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0, 1);
  }
`;

const PLACEHOLDER_MAIN_IMAGE = `
	void mainImage(out vec4 fragColor, in vec2 fragCoord) {
		fragColor = vec4(0.0);
	}
`;

type TextureOrFramebuffer = regl.Texture2D | regl.Framebuffer2D;

type P = {
	lastTime: number;
	iFrame: number;
	mouseX: number;
	mouseY: number;
	textures: [
		TextureOrFramebuffer,
		TextureOrFramebuffer,
		TextureOrFramebuffer,
		TextureOrFramebuffer
	];
};

export function DrawToFbo({
	code,
	regl,
	width,
	height,
	framebuffer
}: {
	code: string;
	regl: regl.Regl;
	width: number;
	height: number;
	framebuffer: regl.Framebuffer2D | null;
}): regl.DrawCommand {
	// Fragment shader with ShaderToy-compatible uniforms and textures
	const fragmentShader = `
    precision highp float;
    
    uniform vec3 iResolution;
    uniform float iTime;
    uniform vec4 iMouse;
    uniform vec4 iDate;
    uniform float iTimeDelta;
    uniform int iFrame;
    
    uniform sampler2D iChannel0;
    uniform sampler2D iChannel1;
    uniform sampler2D iChannel2;
    uniform sampler2D iChannel3;

		varying vec2 uv;
    
    ${code ?? PLACEHOLDER_MAIN_IMAGE}
    
    void main() {
      vec4 fragColor = vec4(0.0);
      mainImage(fragColor, gl_FragCoord.xy);
      gl_FragColor = fragColor;
    }
  `;

	return regl({
		frag: fragmentShader,
		vert: VERTEX_SHADER,
		framebuffer,

		attributes: {
			position: regl.buffer([
				[-1, -1],
				[1, -1],
				[-1, 1],
				[1, 1]
			])
		},

		primitive: 'triangle strip',
		count: 4,

		uniforms: {
			iResolution: ({ pixelRatio }) => {
				return [width * pixelRatio, height * pixelRatio, 1.0];
			},

			iTime: ({ time }) => time,
			iTimeDelta: ({ time }, props: P) => time - props.lastTime,
			iFrame: (_, props: P) => props.iFrame,
			iMouse: (_, props: P) => [props.mouseX, props.mouseY, 0, 0],
			iDate: () => getDate(),
			iChannel0: (_, props: P) => props.textures[0],
			iChannel1: (_, props: P) => props.textures[1],
			iChannel2: (_, props: P) => props.textures[2],
			iChannel3: (_, props: P) => props.textures[3]
		}
	});
}

const getDate = () => {
	const now = new Date();

	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	const day = now.getDate();

	const timeInSeconds =
		now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;

	return [year, month, day, timeInSeconds];
};
