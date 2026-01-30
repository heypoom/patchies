// from https://gist.github.com/gre/1650294

export default {
  // no easing, no acceleration
  linear(t: number) {
    return t;
  },
  // accelerating from zero velocity
  easeInQuad(t: number) {
    return t * t;
  },
  // decelerating to zero velocity
  easeOutQuad(t: number) {
    return t * (2 - t);
  },
  // acceleration until halfway, then deceleration
  easeInOutQuad(t: number) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  // accelerating from zero velocity
  easeInCubic(t: number) {
    return t * t * t;
  },
  // decelerating to zero velocity
  easeOutCubic(t: number) {
    return --t * t * t + 1;
  },
  // acceleration until halfway, then deceleration
  easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  },
  // accelerating from zero velocity
  easeInQuart(t: number) {
    return t * t * t * t;
  },
  // decelerating to zero velocity
  easeOutQuart(t: number) {
    return 1 - --t * t * t * t;
  },
  // acceleration until halfway, then deceleration
  easeInOutQuart(t: number) {
    return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t;
  },
  // accelerating from zero velocity
  easeInQuint(t: number) {
    return t * t * t * t * t;
  },
  // decelerating to zero velocity
  easeOutQuint(t: number) {
    return 1 + --t * t * t * t * t;
  },
  // acceleration until halfway, then deceleration
  easeInOutQuint(t: number) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
  },
  // sin shape
  sin(t: number) {
    return (1 + Math.sin(Math.PI * t - Math.PI / 2)) / 2;
  }
} as const;
