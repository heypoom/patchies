/**
 * Bytebeat Node Presets
 *
 * Pre-configured bytebeat formulas and demos
 */

export const BYTEBEAT_PRESETS = {
  'sine-power.beat': {
    type: 'bytebeat~',
    data: {
      expr: `// sine of power
// by: lhphr
// from: https://dollchan.net/btb/res/3.html#54

(t%32768>>4)**sin(t/2/'66546657'[t>>13&7])&t>>4`,
      type: 'bytebeat',
      syntax: 'infix',
      sampleRate: 8000
    }
  },

  'explosive.beat': {
    type: 'bytebeat~',
    data: {
      expr: `// "Explosive beat"
// Formulas family discovered by experimenting
// with "Explosions" (t>>2)*(t>>5)|t>>5
// by: SthephanShi

(t>>4)*(t>>3)|t>>3`,
      type: 'bytebeat',
      syntax: 'infix',
      sampleRate: 8000
    }
  },

  'rickroll.beat': {
    type: 'bytebeat~',
    data: {
      expr: `// some kind of 80s synth type thing (Never Gonna Give You Up)
// by: gasman
// from: http://www.pouet.net/topic.php?which=8357&page=12#c389109

(t<<3)*[8/9,1,9/8,6/5,4/3,3/2,0][[0xd2d2c8,0xce4088,0xca32c8,0x8e4009][t>>14&3]>>(0x3dbe4688>>((t>>10&15)>9?18:t>>10&15)*3&7)*3&7]`,
      type: 'bytebeat',
      syntax: 'infix',
      sampleRate: 8000
    }
  },

  'floatbeat.beat': {
    type: 'bytebeat~',
    data: {
      expr: `// Floatbeat to bytebeat
// by: lehandsomeguy

time = (t/32000),
PI = 3.14159265358979323,
fract=function(x) {
    return ((x%1)+1)%1;
},
mod=function(a,b) {
    return ((a%b)+b)%b;
},
mix=function(a,b,c) {
    return (a*(1-c))+(b*c)
},
clamp=function(a,b,c) {
    return max(min(a,c),b);
},
tri=function(x) {
    return asin(sin(x))/(PI/2.)
},
pulse=function(x) {
    return (floor(sin(x))+0.5)*2.;
},
saw=function(x) {
    return (fract((x/2.)/PI)-0.5)*2.;
},
hash=function(x) {
    return fract(sin(x*1342.874+sin(5212.42*x))*414.23);
},
noise=function(x) {
    return sin((x+10)*sin(pow((x+10),fract(x)+10)));
},
floattobyte=function(x) {
    return (clamp(x,-.9999,.9999)*128)+128
}
,
a = noise(time)*pow(1-fract(time*8),4)*.25,
a += sin(pow(1-fract(time*2),10)*100),
a /= 3,
floattobyte(a)`,
      type: 'floatbeat',
      syntax: 'infix',
      sampleRate: 32000
    }
  }
};
