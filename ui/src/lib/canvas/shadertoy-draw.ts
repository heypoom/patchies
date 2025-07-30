import regl from 'regl';

// Render a simple quad for a vertex shader.
const VERTEX_SHADER = `
  precision mediump float;
  attribute vec2 position;

  void main() {
    gl_Position = vec4(position, 0, 1);
  }
`;

export function getShadertoyDrawCommand({
	code,
	regl,
	width,
	height,
	textures,
	framebuffer
}: {
	code: string;
	regl: regl.Regl;
	width: number;
	height: number;
	textures: [regl.Texture2D, regl.Texture2D, regl.Texture2D, regl.Texture2D];
	framebuffer: regl.Framebuffer2D;
}): regl.DrawCommand {
	// Fragment shader with ShaderToy-compatible uniforms and textures
	const fragmentShader = `
    precision mediump float;
    
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
    
    ${code}
    
    void main() {
      vec4 fragColor = vec4(0.0);
      mainImage(fragColor, gl_FragCoord.xy);
      gl_FragColor = fragColor;
    }
  `;

	type P = { lastTime: number; iFrame: number; mouseX: number; mouseY: number };

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
			iChannel0: () => textures[0],
			iChannel1: () => textures[1],
			iChannel2: () => textures[2],
			iChannel3: () => textures[3]
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
