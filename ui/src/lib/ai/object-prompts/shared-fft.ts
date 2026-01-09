/**
 * Shared FFT instructions for objects that support audio analysis.
 * Used by: p5, hydra, glsl, canvas, canvas.dom, js
 */
export const fftInstructions = `
**CRITICAL - FFT Audio Analysis:**
- Connect an fft~ object's purple "analyzer" outlet to this object's inlet
- Call fft() to get real-time audio analysis (NOT p5.FFT() or a.fft[])
- fft() returns FFTAnalysis with: .a (bins 0-255), .f (normalized 0-1), .rms, .avg, .centroid
- fft().getEnergy('bass')/255 - bass energy (also: lowMid, mid, highMid, treble)
- fft().getEnergy(40, 200)/255 - custom frequency range energy
- fft({type: 'freq'}) - frequency spectrum (default is waveform)
`.trim();
