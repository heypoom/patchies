import type P5 from 'p5';
import { addData } from './data';
import { addPreload } from './preload';
import { addShapes } from './shapes';

export function registerCompatibilityLibraries(P5Constructor: typeof P5) {
  // @types/p5 describes v1 and does not include v2's addon registration API.
  const p5 = P5Constructor as unknown as {
    registerAddon: (addon: typeof addPreload | typeof addShapes | typeof addData) => void;
  };

  p5.registerAddon(addPreload);
  p5.registerAddon(addShapes);
  p5.registerAddon(addData);
}
