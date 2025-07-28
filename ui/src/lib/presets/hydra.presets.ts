const PASSTHRU = `initSource(s0)
src(s0).out()`;

const DIFF = `initSource(s0, 0)
initSource(s1, 1)
src(s0).diff(s1).out()`;

const BEANS = `// licensed with CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
//Flor de Fuego
//https://flordefuego.github.io/
osc(30,0.01,1)
.mult(osc(20,-0.1,1).modulate(noise(3,1)).rotate(0.7))
.posterize([3,10,2].fast(0.5).smooth(1))
.out()`;

const CAM = `s0.initCam()
src(s0).out()`;

export const HYDRA_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'passthru.hydra': { type: 'hydra', data: { code: PASSTHRU.trim() } },
	'diff.hydra': { type: 'hydra', data: { code: DIFF.trim() } },
	'beans.hydra': { type: 'hydra', data: { code: BEANS.trim() } },
	'cam.hydra': { type: 'hydra', data: { code: CAM.trim() } }
};
