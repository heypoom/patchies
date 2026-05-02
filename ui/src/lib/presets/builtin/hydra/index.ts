import { preset as preset0 } from './pipe';
import { preset as preset1 } from './add';
import { preset as preset2 } from './diff';
import { preset as preset3 } from './sub';
import { preset as preset4 } from './blend';
import { preset as preset5 } from './mask';
import { preset as preset6 } from './fft';
import { preset as preset7 } from './flor-de-fuego';
import { preset as preset8 } from './olivia-kaleid-feedback';
import { preset as preset9 } from './nelson-vera';
import { preset as preset10 } from './debora-falleiros-gonzales';
import { preset as preset11 } from './rodrigo-magenta-rotation';
import { preset as preset12 } from './rodrigo-pink-grid';
import { preset as preset13 } from './zach-magenta-machine';
import { preset as preset14 } from './zach-pixel-kaleid';
import { preset as preset15 } from './acid-bus-seat';
import { preset as preset16 } from './olivia-golden-kaleid';
import { preset as preset17 } from './olivia-gold-oscillator';
import { preset as preset18 } from './olivia-pixel-noise';
import { preset as preset19 } from './moire';
import { preset as preset20 } from './olivia-pink-pixelate';
import { preset as preset21 } from './dreamy-diamond';
import { preset as preset22 } from './tag-sweep';
import { preset as preset23 } from './monochrome-memoar';
import { preset as preset24 } from './galaxy-trip';
import { preset as preset25 } from './sumet';
import { preset as preset26 } from './port';
import { preset as preset27 } from './pixelscape';
import { preset as preset28 } from './naoto-color-pixelate';
import { preset as preset29 } from './naoto-blue-layers';
import { preset as preset30 } from './random-trypophobia';
import { preset as preset31 } from './corrupted-screensaver';
import { preset as preset32 } from './tropical-juice';
import { preset as preset33 } from './trying-to-get-closer';
import { preset as preset34 } from './disintegration';
import { preset as preset35 } from './flor-de-fuego-posterize';
import { preset as preset36 } from './mahalia-kaleid-flow';
import { preset as preset37 } from './mahalia-mouse-shape';
import { preset as preset38 } from './velvet-pool';
import { preset as preset39 } from './mahalia-fft-mask';
import { preset as preset40 } from './cellular-blobular';
import { preset as preset41 } from './3-0';
import { preset as preset42 } from './3-3';
import { preset as preset43 } from './asdrubal-gomez';
import { preset as preset44 } from './hydra-glitchy-slit-scan';
import { preset as preset45 } from './glitch-river';
import { preset as preset46 } from './clouds-of-passage';
import { preset as preset47 } from './sand-spirals';
import { preset as preset48 } from './ameba';
import { preset as preset49 } from './crazy-squares';
import { preset as preset50 } from './happy-mandala';
import { preset as preset51 } from './perpetual-elevator-buttons';
import { preset as preset52 } from './really-love';
import { preset as preset53 } from './aqautic-blubs';
import { preset as preset54 } from './puertas-ii';
import { preset as preset55 } from './puertas-iii';
import { preset as preset56 } from './puertas';
import { preset as preset57 } from './the-wall';
import { preset as preset58 } from './eye-of-the-beholder';
import { preset as preset59 } from './egg-of-the-phoenix';
import { preset as preset60 } from './filet-mignon';
import { preset as preset61 } from './ee-2-multiverse';
import { preset as preset62 } from './ee-3-lines';
import { preset as preset63 } from './ee-5-fugitive-geometry-vhs';
import { preset as preset64 } from './ee-1-eye-in-the-sky';

import type { HydraPreset } from './types';

const HYDRA_DEMO_PRESETS: Record<string, HydraPreset> = {
  'Flor de Fuego': preset7,
  'ojack Kaleid Feedback': preset8,
  nel_sonologia: preset9,
  gonzalesdebora: preset10,
  'yecto Magenta Rotation': preset11,
  'yecto Pink Grid': preset12,
  'zachkrall Magenta Machine': preset13,
  'zachkrall Pixel Kaleid': preset14,
  'Acid Bus Seat': preset15,
  'ojack Golden Kaleid': preset16,
  'ojack Gold Oscillator': preset17,
  'ojack Pixel Noise': preset18,
  moire: preset19,
  'ojack Pink Pixelate': preset20,
  'Dreamy Diamond': preset21,
  'Tag & Sweep': preset22,
  'Monochrome Memoar': preset23,
  'Galaxy Trip': preset24,
  Sumet: preset25,
  port: preset26,
  Pixelscape: preset27,
  'naoto_hieda Color Pixelate': preset28,
  'naoto_hieda Blue Layers': preset29,
  'random trypophobia': preset30,
  'corrupted screensaver': preset31,
  'tropical juice': preset32,
  'trying to get closer': preset33,
  disintegration: preset34,
  'flordefuego Posterize': preset35,
  'mm_hr Kaleid Flow': preset36,
  'mm_hr Mouse Shape': preset37,
  'Velvet Pool': preset38,
  'mm_hr FFT Mask': preset39,
  'Cellular & Blobular': preset40,
  '3.0': preset41,
  '3.3': preset42,
  asdrubal: preset43,
  'Glitchy Slit Scan': preset44,
  'Glitch River': preset45,
  'clouds of passage': preset46,
  'sand spirals': preset47,
  ameba: preset48,
  'crazy squares': preset49,
  'Happy Mandala': preset50,
  'Perpetual elevator': preset51,
  'Really Love': preset52,
  'Aqautic blubs': preset53,
  'Puertas II': preset54,
  'Puertas III': preset55,
  Puertas: preset56,
  'the-wall': preset57,
  'eye of the beholder': preset58,
  'egg of the phoenix': preset59,
  'filet mignon': preset60,
  'ee_2 . MULTIVERSE': preset61,
  'ee_3 . LINES': preset62,
  'ee_5 . FUGITIVE GEOMETRY VHS': preset63,
  'ee_1 . EYE IN THE SKY': preset64
};

export const HYDRA_PRESETS: Record<string, HydraPreset> = {
  'hydra>': preset0,
  'add.hydra': preset1,
  'diff.hydra': preset2,
  'sub.hydra': preset3,
  'blend.hydra': preset4,
  'mask.hydra': preset5,
  'fft.hydra': preset6,
  ...HYDRA_DEMO_PRESETS
};

export const HYDRA_DEMO_PRESET_KEYS = Object.keys(HYDRA_DEMO_PRESETS);

export type { HydraPreset } from './types';
