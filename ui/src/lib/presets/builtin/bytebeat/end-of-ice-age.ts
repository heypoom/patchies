/**
 * End of Ice Age
 * by: SthephanShi
 * from: https://battleofthebits.org/arena/Entry/End+of+Ice+Age/53085/
 */

export const END_OF_ICE_AGE_PRESET = {
  'ice-age.beat': {
    type: 'bytebeat~',
    data: {
      expr: `// End of Ice Age
// by: SthephanShi
// from: https://battleofthebits.org/arena/Entry/End+of+Ice+Age/53085/

t /= 44100, // Sample rate
bpm = 105, // Song speed
len = 256, // Song length
b = (bpm * t / 60) % len,

// Notes
C = 262, Db = 277, D = 294, Eb = 311, EE = 330, F = 349,
Gb = 370, G = 392, Ab = 415, A = 440, Bb = 466, B = 494,

// Notes arrays
intro = [C, D, G, C, D, G, C, D, A, C, D, A, A, A, A,, D, G, B, D, G, B, D, G, A, C, G, A, A, A, A],
song1 = [,, G,, Gb, A,, Gb, B,, G, B,,, A,,,, C * 2,, B, D * 2,, B, EE * 2,,B, EE * 2,,, D * 2],
song2 = [C, D, G, D, Gb, A, EE, G, B, D, Gb, A, C * 2, D, G, D * 2, Gb, B, EE * 2, G, B, D * 2, Gb, A],

// Wave modifier
wave = amp => amp * 1E-4 * sin(44 * t),

// Square arpeggiators
arp1 = (arr, echo) => (i = b - echo, w = b % 8 > 6, (w ? 12 : 24) * (2 * (t + (w && wave(4))) *
	arr[int(2 * i) % 32] % 2 | 0)),
arp2 = (arr, shift, echo) => (i = b - shift - echo, 24 * ((i & 16 ? 4 : 2) * t *
	arr[int(2 * i) % 32] % 2 | 0)),
arp3 = (arr, shift, echo) => (i = b - shift - echo, 24 * ((i & 16 ? 4 : 2) * (t + ((i & 32) && wave(5))) *
	arr[3 * ((i >> 1) % 8) + int((i & 64 ? 22 : 2) * i) % 3] % 2 | 0)),
arpEcho = (fn, ...args) =>
	fn(...args, 0) + .8 * fn(...args, .4) + .6 * fn(...args, .8) + .4 * fn(...args, 1.2),

// Square bass pad
pad = (pitch, echo) => 18 * int(.7 * (pitch * (t + wave(5)) * [
	C, D, EE, D, C, D, B / 2, C
][((b - echo) >> 1) % 8] % 2)),

// Triangle pad
tri = (pitch, echo) => .3 * (abs(((255 * pitch * (t + wave(4)) * [
	D, Gb, G, B, EE, Gb, G, Gb,
	D, EE, G, A, EE, Gb, G, Gb
][((b - echo) >> 1) % 16]) & 255) - 128)),

// Noise for drums
noise = (arr, speed, len, pitch) =>
	arr[int(speed * b) % len] * (int(1E5 * sin(int(t * pitch) ** 2)) & 255),

// Kick
(((b > 80 && b < 128) || (b > 160 && b < 192)) &&
	53 * int(b * (256 >> 32 * b) % 2)) +
// Hi-hats
(((b > 64 && b < 128) || (b > 144 && b < 192)) &&
	noise('1000000010000000111111001000100010000000111111001000000011111000', 16, 64, 3E4) / 8) +
// Snare
(((b > 80 && b < 128) || (b > 160 && b < 192)) &&
	noise('0010', 2, 4, 35E2) / 5) +
// Explosions
(((b > 128 && b < 160)) &&
	noise('30020010010010003222111111111000', 8, 32, 20E2) / 8) +
// Bass pad
(b > 32 &&
	.6 * pad(1, 0) + pad(1.5, 1) + .8 * pad(2, 1)) +
// Lead intro
(b < 32 &&
	arpEcho(arp1, intro)) +
// Lead song #1
((b > 32 && b < 65 || b > 192 && b < 225) &&
	arpEcho(arp2, song1, b > 192 ? 192 : 32)) +
// Lead song #2
(b > 64 && b < 193 &&
	arpEcho(arp3, song2, 64)) +
// Triangle
(b > 192 &&
	tri(1, 0) + .8 * tri(1, .4) + .6 * tri(2, 1) + .4 * tri(1, 1.2));`,
      type: 'floatbeat',
      syntax: 'infix',
      sampleRate: 44100
    }
  }
};
