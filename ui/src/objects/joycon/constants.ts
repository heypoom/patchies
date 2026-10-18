export type JoyconSide = 'left' | 'right';
export type JoyconDeviceFilter = 'any' | JoyconSide;
export type JoyconAxis = 'x' | 'y' | 'z';
export type MotionDirection = 'positive' | 'negative' | 'neutral';

export interface JoyconNodeData {
  device: JoyconDeviceFilter;
  threshold: number;
}

export const DEFAULT_JOYCON_DATA: JoyconNodeData = {
  device: 'any',
  threshold: 20
};

export const JOYCON_VENDOR_ID = 0x057e;
export const JOYCON_LEFT_PRODUCT_ID = 0x2006;
export const JOYCON_RIGHT_PRODUCT_ID = 0x2007;

export const JOYCON_AXES: JoyconAxis[] = ['x', 'y', 'z'];
