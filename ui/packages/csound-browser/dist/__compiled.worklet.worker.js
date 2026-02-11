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
        L: (a) => w(a) && a[r],
        U(a) {
          const { port1: b, port2: c } = new MessageChannel();
          return (x(a, b), [c, [c]]);
        },
        M: (a) => (a.start(), y(a)),
      },
    ],
    [
      "throw",
      {
        L: (a) => w(a) && v in a,
        U({ value: a }) {
          let b;
          return (
            (b =
              a instanceof Error
                ? { P: !0, value: { message: a.message, name: a.name, stack: a.stack } }
                : { P: !1, value: a }),
            [b, []]
          );
        },
        M(a) {
          if (a.P) throw Object.assign(Error(a.value.message), a.value);
          throw a.value;
        },
      },
    ],
  ]);
function x(a, b = self) {
  b.addEventListener("message", function e(d) {
    if (d && d.data) {
      var f = d.data.argumentList,
        { id: g, type: n, path: k } = Object.assign({ path: [] }, d.data);
      f = (f || []).map(A);
      try {
        const h = k.slice(0, -1).reduce((m, q) => m[q], a),
          p = k.reduce((m, q) => m[q], a);
        switch (n) {
          case "GET":
            var l = p;
            break;
          case "SET":
            h[k.slice(-1)[0]] = A(d.data.value);
            l = !0;
            break;
          case "APPLY":
            l = p.apply(h, f);
            break;
          case "CONSTRUCT":
            l = Object.assign(new p(...f), { [r]: !0 });
            break;
          case "ENDPOINT":
            const { port1: m, port2: q } = new MessageChannel();
            x(a, q);
            l = B(m, [m]);
            break;
          case "RELEASE":
            l = void 0;
            break;
          default:
            return;
        }
      } catch (h) {
        l = { value: h, [v]: 0 };
      }
      Promise.resolve(l)
        .catch((h) => ({ value: h, [v]: 0 }))
        .then((h) => {
          const [p, m] = C(h);
          h = { ...p };
          h.id = g;
          b.postMessage(h, m);
          "RELEASE" === n && (b.removeEventListener("message", e), D(b));
        });
    }
  });
  b.start && b.start();
}
function D(a) {
  "MessagePort" === a.constructor.name && a.close();
}
function y(a) {
  return (function f(c, d = [], e = function () {}) {
    let g = !1;
    const n = new Proxy(e, {
      get(k, l) {
        if ((E(g), l === u))
          return () =>
            F(c, { type: "RELEASE", path: d.map((h) => h.toString()) }).then(() => {
              D(c);
              g = !0;
            });
        if ("then" === l) {
          if (0 === d.length) return { then: () => n };
          k = F(c, { type: "GET", path: d.map((h) => h.toString()) }).then(A);
          return k.then.bind(k);
        }
        return f(c, [...d, l]);
      },
      set(k, l, h) {
        E(g);
        const [p, m] = C(h);
        return F(c, { type: "SET", path: [...d, l].map((q) => q.toString()), value: p }, m).then(A);
      },
      apply(k, l, h) {
        E(g);
        k = d[d.length - 1];
        if (k === t) return F(c, { type: "ENDPOINT" }).then(A);
        if ("bind" === k) return f(c, d.slice(0, -1));
        const [p, m] = G(h);
        h = { type: "APPLY" };
        h.path = d.map((q) => q.toString());
        h.argumentList = p;
        return F(c, h, m).then(A);
      },
      construct(k, l) {
        E(g);
        const [h, p] = G(l);
        k = { type: "CONSTRUCT" };
        k.path = d.map((m) => m.toString());
        k.argumentList = h;
        return F(c, k, p).then(A);
      },
    });
    return n;
  })(a, [], void 0);
}
function E(a) {
  if (a) throw Error("Proxy has been released and is not useable");
}
function G(a) {
  a = a.map(C);
  const b = ((c = a.map((d) => d[1])), Array.prototype.concat.apply([], c));
  return [a.map((d) => d[0]), b];
  var c;
}
const H = new WeakMap();
function B(a, b) {
  return (H.set(a, b), a);
}
function C(a) {
  for (const [b, c] of z)
    if (c.L(a)) {
      const [d, e] = c.U(a);
      return [{ type: "HANDLER", name: b, value: d }, e];
    }
  return [{ type: "RAW", value: a }, H.get(a) || []];
}
function A(a) {
  switch (a.type) {
    case "HANDLER":
      return z.get(a.name).M(a.value);
    case "RAW":
      return a.value;
  }
}
function F(a, b, c) {
  return new Promise((d) => {
    const e = Array(4)
      .fill(0)
      .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
      .join("-");
    a.addEventListener("message", function n(g) {
      g.data && g.data.id && g.data.id === e && (a.removeEventListener("message", n), d(g.data));
    });
    a.start && a.start();
    b.id = e;
    a.postMessage(b, c);
  });
}
function I() {}
I.prototype.ready = !1;
I.prototype.port = void 0;
I.prototype.B = () => {};
I.prototype.u = () => {};
let J;
J = () => () => {};
const K = (a) => {
  const b = [];
  for (let c = 0; c < a; c++) b.push(new Float64Array(16384));
  return b;
};
const L = new Map();
function M(a, b) {
  var c = 1 === Atomics.load(this.i, 2),
    d = 1 === Atomics.load(this.i, 4);
  const e = 1 === Atomics.load(this.i, 5);
  this.j && (this.j(), delete this.j);
  if (!this.i || d || !c || e) return ((b[0] || []).forEach((g) => g.fill(0)), !0);
  a = a && a[0];
  b = b && b[0];
  c = b[0].length;
  this.K !== c && ((this.K = c), Atomics.store(this.i, 11, c));
  d = a && 0 < a.length ? (this.F + c) % 16384 : 0;
  const f = b && 0 < b.length ? (this.o + c) % 16384 : 0;
  if (Atomics.load(this.i, 15) >= c)
    (this.g && (this.g = 0),
      b.forEach((g, n) => {
        g.set(this.T[n].subarray(this.o, f < this.o ? 16384 : f));
      }),
      a &&
        a[0] &&
        0 < a[0].length &&
        (a.forEach((g, n) => {
          this.S[n].set(g, this.F);
        }),
        (this.F = d),
        Atomics.add(this.i, 14, a[0].length)),
      (this.o = f),
      Atomics.sub(this.i, 15, c),
      Atomics.store(this.i, 12, this.o));
  else {
    if (4098 < this.o) console.log("buffer underrun");
    else return !0;
    this.g += 1;
    if (100 === this.g)
      return (
        this.h.B("FATAL: 100 buffers failed in a row"),
        this.h.u("realtimePerformanceEnded"),
        !1
      );
  }
  return !0;
}
function N(a, b) {
  if (!this.V)
    return (
      this.s.R({ readIndex: 0, numFrames: 8192 }),
      (this.l += 8192),
      (this.V = !0),
      this.j && (this.j(), delete this.j),
      !0
    );
  if (!this.H) return (((b && b[0]) || []).forEach((f) => f.fill(0)), !0);
  a = a && a[0];
  const c = (b = b && b[0]) ? b[0].length : 0,
    d = b && 0 < b.length ? (this.C + b[0].length) % 16384 : 0,
    e = a && 0 < a.length ? (this.J + a[0].length) % 16384 : 0;
  if (c && this.m >= c) {
    b.forEach((f, g) => {
      f.set(this.v[g].subarray(this.C, d < this.C ? 16384 : d));
    });
    if (
      a &&
      0 < a.length &&
      (a.forEach((f, g) => {
        this.I[g].set(f, this.J);
      }),
      0 === e % 2048)
    ) {
      const f = [],
        g = (0 === e ? 16384 : e) - 2048,
        n = 0 === e ? 16384 : e;
      this.I.forEach((k) => {
        f.push(k.subarray(g, n));
      });
      this.A.ba(f);
    }
    this.C = d;
    this.J = e;
    this.m -= c;
    this.g = 0;
  } else if (
    (1 < this.g && 12 > this.g && (this.h.B("Buffer underrun"), (this.g += 1)), 100 === this.g)
  )
    return (
      this.h.B("FATAL: 100 buffers failed in a row"),
      this.h.u("realtimePerformanceEnded"),
      !1
    );
  a = 2048 - this.m;
  0 < a &&
    ((b = {}),
    (b.readIndex = (this.m + d + this.l) % 16384),
    (b.numFrames = a),
    this.s.R(b),
    (this.l += a));
  return !0;
}
function O(a, { h: b, A: c, s: d, j: e }) {
  J()();
  b && (a.h = b);
  c && (a.A = c);
  d && (a.s = d);
  a.O = !0;
  a.j = e;
}
class P extends AudioWorkletProcessor {
  constructor({ processorOptions: a }) {
    super();
    var b = a.contextUid,
      c = a.inputsCount;
    const d = a.outputsCount,
      e = a.maybeSharedArrayBuffer,
      f = a.maybeSharedArrayBufferAudioIn;
    a = a.maybeSharedArrayBufferAudioOut;
    this.A = this.s = this.j = this.h = void 0;
    L.set(`${b}Node`, this);
    this.O = !1;
    this.pause = this.pause.bind(this);
    this.resume = this.resume.bind(this);
    this.D = !1;
    this.Y = d;
    this.K = this.g = this.o = this.F = 0;
    if (e) {
      this.i = e;
      this.audioStreamIn = f;
      this.audioStreamOut = a;
      this.T = [];
      this.S = [];
      for (b = 0; b < c; ++b) this.S.push(new Float64Array(this.audioStreamIn, 16384 * b, 16384));
      for (c = 0; c < d; ++c) this.T.push(new Float64Array(this.audioStreamOut, 16384 * c, 16384));
      this.N = M.bind(this);
    } else
      ((this.v = []),
        (this.I = []),
        (this.l = this.m = this.J = this.C = 0),
        (this.H = this.V = !1),
        (this.I = K(c)),
        (this.v = K(d)),
        (this.N = N.bind(this)),
        (this.G = this.G.bind(this)));
    x({ initialize: Q, pause: this.pause, resume: this.resume }, this.port);
    J()();
  }
  G({ X: a, Z: b, $: c }) {
    this.l -= b;
    if (a) {
      for (let d = 0; d < this.Y; ++d) {
        let e = !1,
          f;
        (c + b) % 16384 < c && ((e = !0), (f = 16384 - c));
        e
          ? (this.v[d].set(a[d].subarray(0, f), c), this.v[d].set(a[d].subarray(f), 0))
          : this.v[d].set(a[d], c);
      }
      this.m += b;
      this.H || (this.H = !0);
    }
  }
  pause() {
    this.D = !0;
    this.h.u("realtimePerformancePaused");
  }
  resume() {
    this.D = !1;
    this.h.u("realtimePerformanceResumed");
  }
  process(a, b) {
    return this.D || !this.O ? !0 : this.N(a, b);
  }
}
function R(a) {
  const b = a.port;
  J()();
  a = new I();
  a.B = (c) => {
    const d = {};
    d.log = c;
    b.postMessage(d);
  };
  a.u = (c) => {
    const d = {};
    d.playStateChange = c;
    b.postMessage(d);
  };
  a.ready = !0;
  return a;
}
function S({ aa: a, W: b }) {
  J()();
  a.addEventListener("message", (c) => {
    b.G({ X: c.data.audioPacket, Z: c.data.numFrames, $: c.data.readIndex });
  });
  a.start();
  return { R: (c) => a.postMessage(c), ready: !0 };
}
function T(a) {
  J()();
  return { ready: !1, ba: (b) => a.postMessage(b) };
}
const Q = async (a) => {
  var b = a.inputPort,
    c = a.messagePort,
    d = a.requestPort;
  a = L.get(`${a.contextUid}Node`);
  c = R({ port: c });
  b = T(b);
  d = S({ aa: d, W: a });
  let e;
  const f = new Promise((g) => {
    e = g;
  });
  O(a, { h: c, A: b, s: d, j: e });
  await f;
};
registerProcessor("csound-worklet-processor", P);
//# sourceMappingURL=__compiled.worklet.worker.js.map
