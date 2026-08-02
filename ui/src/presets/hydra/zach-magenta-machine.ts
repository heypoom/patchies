import type { HydraPreset } from './types';

const code = `// by Zach Krall
// http://zachkrall.online/

osc( 215, 0.1, 2 )
.modulate(
  osc( 2, -0.3, 100 )
  .rotate(15)
)
.mult(
  osc( 215, -0.1, 2)
  .pixelate( 50, 50 )
)
.color( 0.9, 0.0, 0.9 )
.modulate(
  osc( 6, -0.1 )
  .rotate( 9 )
)
.add(
  osc( 10, -0.9, 900 )
  .color(1,0,1)
)
.mult(
  shape(900, 0.2, 1)
  .luma()
  .repeatX(2)
  .repeatY(2)
  .colorama(10)
)
.modulate(
  osc( 9, -0.3, 900 )
  .rotate( 6 )
)
.add(
  osc(4, 1, 90)
  .color(0.2,0,1)
)
.out()`;

export const preset: HydraPreset = {
  type: 'hydra',
  data: {
    code: code.trim(),
    messageInletCount: 0,
    messageOutletCount: 0,
    videoInletCount: 0,
    videoOutletCount: 1
  }
};
