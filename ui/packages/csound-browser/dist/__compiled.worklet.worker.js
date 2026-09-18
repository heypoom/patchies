let self = AudioWorkletGlobalScope;
const r = Symbol("Comlink.proxy"),
  t = Symbol("Comlink.endpoint"),
  u = Symbol("Comlink.releaseProxy"),
  v = Symbol("Comlink.thrown"),
  w = (a) => ("object" == typeof a && null !== a) || "function" == typeof a,
  z = new Map([
    [
      "proxy",
      {
        $: (a) => w(a) && a[r],
        fa(a) {
          const { port1: b, port2: c } = new MessageChannel();
          return (x(a, b), [c, [c]]);
        },
        aa: (a) => (a.start(), y(a)),
      },
    ],
    [
      "throw",
      {
        $: (a) => w(a) && v in a,
        fa({ value: a }) {
          let b;
          return (
            (b =
              a instanceof Error
                ? { ca: !0, value: { message: a.message, name: a.name, stack: a.stack } }
                : { ca: !1, value: a }),
            [b, []]
          );
        },
        aa(a) {
          if (a.ca) throw Object.assign(Error(a.value.message), a.value);
          throw a.value;
        },
      },
    ],
  ]);
function x(a, b = self) {
  b.addEventListener("message", function g(d) {
    if (d && d.data) {
      var e = d.data.argumentList,
        { id: f, type: k, path: l } = Object.assign({ path: [] }, d.data);
      e = (e || []).map(A);
      try {
        const h = l.slice(0, -1).reduce((n, q) => n[q], a),
          p = l.reduce((n, q) => n[q], a);
        switch (k) {
          case "GET":
            var m = p;
            break;
          case "SET":
            h[l.slice(-1)[0]] = A(d.data.value);
            m = !0;
            break;
          case "APPLY":
            m = p.apply(h, e);
            break;
          case "CONSTRUCT":
            m = B(new p(...e));
            break;
          case "ENDPOINT":
            const { port1: n, port2: q } = new MessageChannel();
            x(a, q);
            m = C(n, [n]);
            break;
          case "RELEASE":
            m = void 0;
            break;
          default:
            return;
        }
      } catch (h) {
        m = { value: h, [v]: 0 };
      }
      Promise.resolve(m)
        .catch((h) => ({ value: h, [v]: 0 }))
        .then((h) => {
          const [p, n] = D(h);
          b.postMessage({ ...p, id: f }, n);
          "RELEASE" === k && (b.removeEventListener("message", g), E(b));
        });
    }
  });
  b.start && b.start();
}
function E(a) {
  "MessagePort" === a.constructor.name && a.close();
}
function y(a) {
  return (function e(c, d = [], g = function () {}) {
    let f = !1;
    const k = new Proxy(g, {
      get(l, m) {
        if ((F(f), m === u))
          return () =>
            G(c, { type: "RELEASE", path: d.map((h) => h.toString()) }).then(() => {
              E(c);
              f = !0;
            });
        if ("then" === m) {
          if (0 === d.length) return { then: () => k };
          l = G(c, { type: "GET", path: d.map((h) => h.toString()) }).then(A);
          return l.then.bind(l);
        }
        return e(c, [...d, m]);
      },
      set(l, m, h) {
        F(f);
        const [p, n] = D(h);
        return G(c, { type: "SET", path: [...d, m].map((q) => q.toString()), value: p }, n).then(A);
      },
      apply(l, m, h) {
        F(f);
        l = d[d.length - 1];
        if (l === t) return G(c, { type: "ENDPOINT" }).then(A);
        if ("bind" === l) return e(c, d.slice(0, -1));
        const [p, n] = H(h);
        h = { type: "APPLY" };
        h.path = d.map((q) => q.toString());
        h.argumentList = p;
        return G(c, h, n).then(A);
      },
      construct(l, m) {
        F(f);
        const [h, p] = H(m);
        l = { type: "CONSTRUCT" };
        l.path = d.map((n) => n.toString());
        l.argumentList = h;
        return G(c, l, p).then(A);
      },
    });
    return k;
  })(a, [], void 0);
}
function F(a) {
  if (a) throw Error("Proxy has been released and is not useable");
}
function H(a) {
  var b;
  a = a.map(D);
  const c = ((b = a.map((d) => d[1])), Array.prototype.concat.apply([], b));
  return [a.map((d) => d[0]), c];
}
const I = new WeakMap();
function C(a, b) {
  return (I.set(a, b), a);
}
function B(a) {
  return Object.assign(a, { [r]: !0 });
}
function D(a) {
  for (const [b, c] of z)
    if (c.$(a)) {
      const [d, g] = c.fa(a);
      return [{ type: "HANDLER", name: b, value: d }, g];
    }
  return [{ type: "RAW", value: a }, I.get(a) || []];
}
function A(a) {
  switch (a.type) {
    case "HANDLER":
      return z.get(a.name).aa(a.value);
    case "RAW":
      return a.value;
  }
}
function G(a, b, c) {
  return new Promise((d) => {
    const g = Array(4)
      .fill(0)
      .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
      .join("-");
    a.addEventListener("message", function k(f) {
      f.data && f.data.id && f.data.id === g && (a.removeEventListener("message", k), d(f.data));
    });
    a.start && a.start();
    b.id = g;
    a.postMessage(b, c);
  });
}
function J() {}
J.prototype.ready = !1;
J.prototype.port = void 0;
J.prototype.N = () => {};
J.prototype.G = () => {};
const K = (a) => {
    const b = a.H <= 1 || a.J >= a.H ? 0 : (a.H - a.J - 1) / (a.H - 1);
    a.J += 1;
    return b;
  },
  L = (a) => (a ? Math.max(0, a.H - a.J) : 0);
let M;
const N = (a, b, c = ((M = b[0]) == null ? void 0 : M.length) || 0) => {
  if (a && b && b.length !== 0 && !(c <= 0)) {
    c = Math.min(c, ...b.map((d) => d.length));
    for (let d = 0; d < c; d++) {
      const g = K(a);
      b.forEach((e) => {
        e[d] *= g;
      });
    }
  }
};
let O;
O = () => () => {};
const P = (a) => {
  const b = [];
  for (let c = 0; c < a; c++) b.push(new Float64Array(16384));
  return b;
};
const Q = new Map(),
  R = (a, b, c, d) => {
    const g = Math.min(d, 16384 - c);
    b.set(a.subarray(c, c + g));
    g < d && b.set(a.subarray(0, d - g), g);
  };
function S(a, b) {
  var c = Atomics.load(this.h, 2) === 1,
    d = Atomics.load(this.h, 4) === 1;
  const g = Atomics.load(this.h, 5) === 1;
  this.o && (this.o(), delete this.o);
  if (!this.h || (d && !this.g) || (!c && !this.g) || (g && !this.g))
    return ((b[0] || []).forEach((f) => f.fill(0)), !0);
  a = a && a[0];
  b = b && b[0];
  c = b[0].length;
  this.Z !== c && ((this.Z = c), Atomics.store(this.h, 11, c));
  if (this.g) {
    a = Atomics.load(this.h, 15);
    const f = Math.min(a, c);
    b.forEach((k) => k.fill(0));
    f > 0 &&
      ((a = (this.m + f) % 16384),
      b.forEach((k, l) => {
        R(this.O[l], k, this.m, f);
      }),
      (this.m = a),
      Atomics.sub(this.h, 15, f),
      Atomics.store(this.h, 12, this.m),
      N(this.g, b, f));
    if (f === 0 || L(this.g) === 0) this.g = void 0;
    return !0;
  }
  d = a && a.length > 0 ? (this.T + c) % 16384 : 0;
  const e = b && b.length > 0 ? (this.m + c) % 16384 : 0;
  if (Atomics.load(this.h, 15) >= c)
    (this.i && (this.i = 0),
      b.forEach((f, k) => {
        f.set(this.O[k].subarray(this.m, e < this.m ? 16384 : e));
      }),
      a &&
        a[0] &&
        a[0].length > 0 &&
        (a.forEach((f, k) => {
          this.U[k].set(f, this.T);
        }),
        (this.T = d),
        Atomics.add(this.h, 14, a[0].length)),
      (this.m = e),
      Atomics.sub(this.h, 15, c),
      Atomics.store(this.h, 12, this.m));
  else {
    if (this.m > 4098) console.log("buffer underrun");
    else return !0;
    this.i += 1;
    if (this.i === 100)
      return (
        this.l.N("FATAL: 100 buffers failed in a row"),
        this.l.G("realtimePerformanceEnded", this.M),
        !1
      );
  }
  return !0;
}
function T(a, b) {
  if (!this.ga)
    return (
      this.C.ea({ readIndex: 0, numFrames: 8192 }),
      (this.u += 8192),
      (this.ga = !0),
      this.o && (this.o(), delete this.o),
      !0
    );
  if (!this.W) return (((b && b[0]) || []).forEach((e) => e.fill(0)), !0);
  a = a && a[0];
  const c = (b = b && b[0]) ? b[0].length : 0;
  if (this.Y) {
    b.forEach((f) => f.fill(0));
    const e = Math.min(this.j, c);
    this.g &&
      e > 0 &&
      ((a = (this.B + e) % 16384),
      b.forEach((f, k) => {
        R(this.v[k], f, this.B, e);
      }),
      (this.B = a),
      (this.j -= e),
      N(this.g, b, e));
    (this.g && e !== 0 && L(this.g) !== 0) || (this.g = void 0);
    return !0;
  }
  const d = b && b.length > 0 ? (this.B + b[0].length) % 16384 : 0,
    g = a && a.length > 0 ? (this.X + a[0].length) % 16384 : 0;
  if (c && this.j >= c) {
    b.forEach((e, f) => {
      e.set(this.v[f].subarray(this.B, d < this.B ? 16384 : d));
    });
    if (
      a &&
      a.length > 0 &&
      (a.forEach((e, f) => {
        this.P[f].set(e, this.X);
      }),
      g % 2048 === 0)
    ) {
      const e = [],
        f = (g === 0 ? 16384 : g) - 2048,
        k = g === 0 ? 16384 : g;
      this.P.forEach((l) => {
        e.push(l.subarray(f, k));
      });
      this.D.na(e);
    }
    this.B = d;
    this.X = g;
    this.j -= c;
    this.i = 0;
  } else if (
    (this.i > 1 && this.i < 12 && (this.l.N("Buffer underrun"), (this.i += 1)), this.i === 100)
  )
    return (
      this.l.N("FATAL: 100 buffers failed in a row"),
      this.l.G("realtimePerformanceEnded", this.M),
      !1
    );
  a = 2048 - this.j;
  a > 0 &&
    ((b = {}),
    (b.readIndex = (this.j + d + this.u) % 16384),
    (b.numFrames = a),
    this.C.ea(b),
    (this.u += a));
  return !0;
}
function U(a, { l: b, D: c, C: d, o: g }) {
  O()();
  b && (a.l = b);
  c && (a.D = c);
  d && (a.C = d);
  a.R = !0;
  a.o = g;
}
class V extends AudioWorkletProcessor {
  constructor({ processorOptions: a }) {
    super();
    var b = a.contextUid,
      c = a.inputsCount;
    const d = a.outputsCount,
      g = a.performanceGeneration,
      e = a.maybeSharedArrayBuffer,
      f = a.maybeSharedArrayBufferAudioIn;
    a = a.maybeSharedArrayBufferAudioOut;
    this.l = void 0;
    this.M = g;
    this.D = this.C = this.o = void 0;
    Q.set(`${b}Node`, this);
    this.R = !1;
    this.pause = this.pause.bind(this);
    this.resume = this.resume.bind(this);
    this.terminate = this.terminate.bind(this);
    this.beginFadeOut = this.beginFadeOut.bind(this);
    this.da = this.L = !1;
    this.ja = d;
    this.Z = this.i = this.m = this.T = 0;
    this.g = void 0;
    this.Y = !1;
    if (e) {
      this.h = e;
      this.audioStreamIn = f;
      this.audioStreamOut = a;
      this.O = [];
      this.U = [];
      for (b = 0; b < c; ++b) this.U.push(new Float64Array(this.audioStreamIn, 16384 * b, 16384));
      for (c = 0; c < d; ++c) this.O.push(new Float64Array(this.audioStreamOut, 16384 * c, 16384));
      this.ba = S.bind(this);
    } else
      ((this.v = []),
        (this.P = []),
        (this.u = this.j = this.X = this.B = 0),
        (this.W = this.ga = !1),
        (this.P = P(c)),
        (this.v = P(d)),
        (this.ba = T.bind(this)),
        (this.V = this.V.bind(this)));
    x(
      {
        initialize: W,
        pause: this.pause,
        resume: this.resume,
        terminate: this.terminate,
        beginFadeOut: this.beginFadeOut,
      },
      this.port,
    );
    O()();
  }
  V({ ia: a, ka: b, la: c }) {
    this.u -= b;
    if (a) {
      for (let d = 0; d < this.ja; ++d) {
        let g = !1,
          e;
        (c + b) % 16384 < c && ((g = !0), (e = 16384 - c));
        g
          ? (this.v[d].set(a[d].subarray(0, e), c), this.v[d].set(a[d].subarray(e), 0))
          : this.v[d].set(a[d], c);
      }
      this.j += b;
      this.W || (this.W = !0);
    }
  }
  pause() {
    this.L = !0;
    this.l.G("realtimePerformancePaused", this.M);
  }
  resume() {
    this.L = !1;
    this.l.G("realtimePerformanceResumed", this.M);
  }
  beginFadeOut() {
    this.Y = !0;
    if (this.g) return L(this.g);
    const a = this.h ? Atomics.load(this.h, 15) : this.j;
    if (a <= 0) return 0;
    this.g = { H: Math.max(1, Math.floor(Number(a) || 0)), J: 0 };
    return a;
  }
  terminate() {
    this.da = !0;
    this.R = this.L = !1;
    this.audioStreamOut = this.audioStreamIn = this.h = this.l = this.D = this.C = this.o = void 0;
    this.U = [];
    this.O = [];
    this.P = [];
    this.v = [];
  }
  process(a, b) {
    return this.da
      ? (((b && b[0]) || []).forEach((c) => c.fill(0)), !1)
      : (this.L && !this.g) || !this.R
        ? !0
        : this.ba(a, b);
  }
}
function X(a) {
  const b = a.port;
  O()();
  a = new J();
  a.N = (c) => {
    const d = {};
    d.log = c;
    b.postMessage(d);
  };
  a.G = (c, d) => {
    const g = {};
    g.playStateChange = c;
    d !== void 0 && (g.performanceGeneration = d);
    b.postMessage(g);
  };
  a.ready = !0;
  return a;
}
function Y({ ma: a, ha: b }) {
  O()();
  a.addEventListener("message", (c) => {
    b.V({ ia: c.data.audioPacket, ka: c.data.numFrames, la: c.data.readIndex });
  });
  a.start();
  return { ea: (c) => a.postMessage(c), ready: !0 };
}
function Z(a) {
  O()();
  return { ready: !1, na: (b) => a.postMessage(b) };
}
const W = async (a) => {
  var b = a.inputPort,
    c = a.messagePort,
    d = a.requestPort;
  a = `${a.contextUid}Node`;
  const g = Q.get(a);
  c = X({ port: c });
  b = Z(b);
  d = Y({ ma: d, ha: g });
  let e;
  const f = new Promise((k) => {
    e = k;
  });
  U(g, { l: c, D: b, C: d, o: e });
  Q.delete(a);
  await f;
};
registerProcessor("csound-worklet-processor", V);
//# sourceMappingURL=__compiled.worklet.worker.js.map
