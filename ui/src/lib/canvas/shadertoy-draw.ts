import regl from 'regl';
import type { GLUniformDef } from '../../types/uniform-config';

// Render a simple quad for a vertex shader.
const VERTEX_SHADER = `#version 300 es
  precision highp float;
  in vec2 position;
	out vec2 uv;

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

type UserUniformInputs = Record<string, (_: regl.DefaultContext, props: P) => void>;

type P = {
	lastTime: number;
	iFrame: number;
	mouseX: number;
	mouseY: number;
	userParams: any[];
};

export function createShaderToyDrawCommand({
	code,
	regl,
	width,
	height,
	framebuffer,
	uniformDefs
}: {
	code: string;
	uniformDefs: GLUniformDef[];
	regl: regl.Regl;
	width: number;
	height: number;
	framebuffer: regl.Framebuffer2D | null;
}): regl.DrawCommand {
	// Fragment shader with ShaderToy-compatible uniforms and textures
	const fragmentShader = `#version 300 es
    precision highp float;
    
    uniform vec3 iResolution;
    uniform float iTime;
    uniform vec4 iMouse;
    uniform vec4 iDate;
    uniform float iTimeDelta;
    uniform int iFrame;

		in vec2 uv;
		out vec4 fragColor;
    
    ${code ?? PLACEHOLDER_MAIN_IMAGE}
    
    void main() {
      fragColor = vec4(0.0);
      mainImage(fragColor, gl_FragCoord.xy);
    }
  `;

	const userUniformInputs: UserUniformInputs = {};

	uniformDefs.forEach((def, paramIndex) => {
		userUniformInputs[def.name] = (_, props) => props.userParams[paramIndex];
	});

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
			iResolution: ({ pixelRatio }) => [width * pixelRatio, height * pixelRatio, 1.0],
			iTime: ({ time }) => time,
			iTimeDelta: ({ time }, props: P) => time - props.lastTime,
			iFrame: (_, props: P) => props.iFrame,
			iMouse: (_, props: P) => [props.mouseX, props.mouseY, 0, 0],
			iDate: () => getDate(),
			...userUniformInputs
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
