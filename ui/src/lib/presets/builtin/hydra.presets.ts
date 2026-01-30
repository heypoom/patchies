const PASSTHRU = `setVideoCount(1)
src(s0).out(o0)`;

const DIFF = `setVideoCount(2)
src(s0).diff(s1).out(o0)`;

const BLEND = `setVideoCount(2)
src(s0).diff(s1).out(o0)`;

const MASK = `setVideoCount(2)
src(s0).mask(s1, 0.5).out(o0)`;

const ADD = `setVideoCount(2)
src(s0).add(s1).out(o0)`;

const SUB = `setVideoCount(2)
src(s0).sub(s1, 0.5).out(o0)`;

const BEANS = `osc(30,0.01,1)
  .mult(osc(20,-0.1,1).modulate(noise(3,1)).rotate(0.7))
  .out(o0)`;

const HYDRA_FFT = `let a = () => fft().getEnergy('bass') / 255

osc(40, 0.09, 0.9)
.color(.9,0,5)
.modulate(osc(10).rotate(1, 0.5))
.rotate(1, 0.2)
.out(o1)

shape(({time})=>Math.sin(time)+1*3, .5,.01)
.repeat(5,3, ()=> a()*2, ()=> a()*2)
.scrollY(.5,0.1)
.layer(
  src(o1)
  .mask(o0)
  .luma(.01, .1)
  .invert(.2)
)
.modulate(o1,.02)
.out(o0)

render(o0)`;

const FILET_MIGNON = `// licensed with CC BY-NC-SA 4.0
// https://creativecommons.org/licenses/by-nc-sa/4.0
// filet mignon :: AFALFL :: instagram/a_f_alfl 

osc(100, -0.0018, 0.17)
  .diff(osc(20, 0.00008).rotate(Math.PI / 0.00003))
  .modulateScale(
    noise(1.5, 0.18).modulateScale(
      osc(13).rotate(() => Math.sin(time / 22))
    ), 3)
  .color(11, 0.5, 0.4, 0.9, 0.2, 0.011, 5, 22, 0.5, -1)
  .contrast(1.4)
  .add(src(o0).modulate(o0, .04), .6, .9)
  .invert()
  .brightness(0.0003, 2)
  .contrast(0.5, 2, 0.1, 2)
  .color(4, -2, 0.1)
  .modulateScale(osc(2), -0.2, 2, 1, 0.3)
  .posterize(200)
  .rotate(1, 0.2, 0.01, 0.001)
  .color(22, -2, 0.5, 0.5, 0.0001, 0.1, 0.2, 8)
  .contrast(0.18, 0.3, 0.1, 0.2, 0.03, 1)
  .brightness(0.0001, -1, 10)
  .out()`;

type HydraNodeData = {
  code: string;
  messageInletCount?: number;
  messageOutletCount?: number;
  videoInletCount?: number;
  videoOutletCount?: number;
  title?: string;
};

const defaultsOneVideoIn: HydraNodeData = {
  code: '',
  messageInletCount: 0,
  messageOutletCount: 0,
  videoInletCount: 1,
  videoOutletCount: 1
};

const defaultsTwoVideoIn: HydraNodeData = { ...defaultsOneVideoIn, videoInletCount: 2 };

export const HYDRA_PRESETS: Record<string, { type: string; data: HydraNodeData }> = {
  'passthru.hydra': {
    type: 'hydra',
    data: { ...defaultsOneVideoIn, code: PASSTHRU.trim() }
  },
  'pipe.hydra': {
    type: 'hydra',
    data: { ...defaultsOneVideoIn, code: PASSTHRU.trim() }
  },
  'diff.hydra': {
    type: 'hydra',
    data: { ...defaultsTwoVideoIn, code: DIFF.trim() }
  },
  'add.hydra': {
    type: 'hydra',
    data: { ...defaultsTwoVideoIn, code: ADD.trim() }
  },
  'sub.hydra': {
    type: 'hydra',
    data: { ...defaultsTwoVideoIn, code: SUB.trim() }
  },
  'blend.hydra': {
    type: 'hydra',
    data: { ...defaultsTwoVideoIn, code: BLEND.trim() }
  },
  'mask.hydra': {
    type: 'hydra',
    data: { ...defaultsTwoVideoIn, code: MASK.trim() }
  },
  'beans.hydra': {
    type: 'hydra',
    data: { ...defaultsOneVideoIn, code: BEANS.trim(), videoInletCount: 0 }
  },
  'filet-mignon.hydra': {
    type: 'hydra',
    data: { ...defaultsOneVideoIn, code: FILET_MIGNON.trim(), videoInletCount: 0 }
  },
  'fft.hydra': {
    type: 'hydra',
    data: {
      code: HYDRA_FFT.trim(),
      messageInletCount: 1,
      messageOutletCount: 0,
      videoInletCount: 0,
      videoOutletCount: 1
    }
  }
};
