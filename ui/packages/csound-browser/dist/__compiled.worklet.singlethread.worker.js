let self = AudioWorkletGlobalScope;
/*

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/
var m,
  q = this || self;
function t(a, b) {
  a = a.split(".");
  var c = q;
  a[0] in c || "undefined" == typeof c.execScript || c.execScript("var " + a[0]);
  for (var d; a.length && (d = a.shift()); )
    a.length || void 0 === b
      ? c[d] && c[d] !== Object.prototype[d]
        ? (c = c[d])
        : (c = c[d] = {})
      : (c[d] = b);
}
function y(a, b) {
  z.prototype[a] = b;
}
const ba = Symbol("Comlink.proxy"),
  ca = Symbol("Comlink.endpoint"),
  da = Symbol("Comlink.releaseProxy"),
  ea = Symbol("Comlink.thrown"),
  fa = (a) => ("object" == typeof a && null !== a) || "function" == typeof a,
  ja = new Map([
    [
      "proxy",
      {
        U: (a) => fa(a) && a[ba],
        ba(a) {
          const { port1: b, port2: c } = new MessageChannel();
          return (ha(a, b), [c, [c]]);
        },
        V: (a) => (a.start(), ia(a)),
      },
    ],
    [
      "throw",
      {
        U: (a) => fa(a) && ea in a,
        ba({ value: a }) {
          let b;
          return (
            (b =
              a instanceof Error
                ? { Y: !0, value: { message: a.message, name: a.name, stack: a.stack } }
                : { Y: !1, value: a }),
            [b, []]
          );
        },
        V(a) {
          if (a.Y) throw Object.assign(Error(a.value.message), a.value);
          throw a.value;
        },
      },
    ],
  ]);
function ha(a, b = self) {
  b.addEventListener("message", function e(d) {
    if (d && d.data) {
      var h = d.data.argumentList,
        { id: g, type: f, path: k } = Object.assign({ path: [] }, d.data);
      h = (h || []).map(A);
      try {
        const n = k.slice(0, -1).reduce((r, p) => r[p], a),
          u = k.reduce((r, p) => r[p], a);
        switch (f) {
          case "GET":
            var l = u;
            break;
          case "SET":
            n[k.slice(-1)[0]] = A(d.data.value);
            l = !0;
            break;
          case "APPLY":
            l = u.apply(n, h);
            break;
          case "CONSTRUCT":
            l = Object.assign(new u(...h), { [ba]: !0 });
            break;
          case "ENDPOINT":
            const { port1: r, port2: p } = new MessageChannel();
            ha(a, p);
            l = ka(r, [r]);
            break;
          case "RELEASE":
            l = void 0;
            break;
          default:
            return;
        }
      } catch (n) {
        l = { value: n, [ea]: 0 };
      }
      Promise.resolve(l)
        .catch((n) => ({ value: n, [ea]: 0 }))
        .then((n) => {
          const [u, r] = la(n);
          n = { ...u };
          n.id = g;
          b.postMessage(n, r);
          "RELEASE" === f && (b.removeEventListener("message", e), ma(b));
        });
    }
  });
  b.start && b.start();
}
function ma(a) {
  "MessagePort" === a.constructor.name && a.close();
}
function ia(a) {
  return (function h(c, d = [], e = function () {}) {
    let g = !1;
    const f = new Proxy(e, {
      get(k, l) {
        if ((na(g), l === da))
          return () =>
            D(c, { type: "RELEASE", path: d.map((n) => n.toString()) }).then(() => {
              ma(c);
              g = !0;
            });
        if ("then" === l) {
          if (0 === d.length) return { then: () => f };
          k = D(c, { type: "GET", path: d.map((n) => n.toString()) }).then(A);
          return k.then.bind(k);
        }
        return h(c, [...d, l]);
      },
      set(k, l, n) {
        na(g);
        const [u, r] = la(n);
        return D(c, { type: "SET", path: [...d, l].map((p) => p.toString()), value: u }, r).then(A);
      },
      apply(k, l, n) {
        na(g);
        k = d[d.length - 1];
        if (k === ca) return D(c, { type: "ENDPOINT" }).then(A);
        if ("bind" === k) return h(c, d.slice(0, -1));
        const [u, r] = oa(n);
        n = { type: "APPLY" };
        n.path = d.map((p) => p.toString());
        n.argumentList = u;
        return D(c, n, r).then(A);
      },
      construct(k, l) {
        na(g);
        const [n, u] = oa(l);
        k = { type: "CONSTRUCT" };
        k.path = d.map((r) => r.toString());
        k.argumentList = n;
        return D(c, k, u).then(A);
      },
    });
    return f;
  })(a, [], void 0);
}
function na(a) {
  if (a) throw Error("Proxy has been released and is not useable");
}
function oa(a) {
  a = a.map(la);
  const b = ((c = a.map((d) => d[1])), Array.prototype.concat.apply([], c));
  return [a.map((d) => d[0]), b];
  var c;
}
const pa = new WeakMap();
function ka(a, b) {
  return (pa.set(a, b), a);
}
function la(a) {
  for (const [b, c] of ja)
    if (c.U(a)) {
      const [d, e] = c.ba(a);
      return [{ type: "HANDLER", name: b, value: d }, e];
    }
  return [{ type: "RAW", value: a }, pa.get(a) || []];
}
function A(a) {
  switch (a.type) {
    case "HANDLER":
      return ja.get(a.name).V(a.value);
    case "RAW":
      return a.value;
  }
}
function D(a, b, c) {
  return new Promise((d) => {
    const e = Array(4)
      .fill(0)
      .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
      .join("-");
    a.addEventListener("message", function f(g) {
      g.data && g.data.id && g.data.id === e && (a.removeEventListener("message", f), d(g.data));
    });
    a.start && a.start();
    b.id = e;
    a.postMessage(b, c);
  });
}
function qa() {}
m = qa.prototype;
m.ea = !1;
m.port = void 0;
m.$ = () => {};
m.o = () => {};
m.F = void 0;
const ra = (a) => () => a.exports.csoundCreateWasi();
ra.toString = () => "create = async () => undefined;";
const sa = (a) => (b) => a.exports.csoundDestroy(b);
sa.toString = () => "destroy = async () => undefined;";
const ta = (a) => () => a.exports.csoundGetAPIVersion();
ta.toString = () => "getAPIVersion = async () => Number;";
const ua = (a) => () => a.exports.csoundGetVersion();
ua.toString = () => "getVersion = async () => Number;";
const va = (a) => (b, c) => a.exports.csoundInitialize(c);
va.toString = () => "initialize = async () => Number;";
function wa() {
  return this;
}
wa.prototype.encode = function (a) {
  if ("string" !== typeof a)
    throw new TypeError("passed argument must be of type string " + a + " " + typeof a);
  a = unescape(encodeURIComponent(a));
  const b = new Uint8Array(a.length);
  [...a].forEach(function (c, d) {
    b[d] = c.codePointAt(0);
  });
  return b;
};
const E = new (function () {
    this.g = (a) => {
      const b = a.indexOf("\x00");
      return -1 < b ? a.slice(0, Math.max(0, b)) : a;
    };
    this.decode = function (a, b) {
      if (void 0 === a) return "";
      if ("boolean" !== typeof (void 0 !== b && "stream" in b ? b.stream : !1))
        throw new TypeError("stream option must be boolean");
      if (ArrayBuffer.isView(a)) {
        a = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
        const c = Array.from({ length: a.length });
        a.forEach(function (d, e) {
          c[e] = String.fromCodePoint(d);
        });
        return this.g(c.join(""));
      }
      throw new TypeError("passed argument must be an array buffer view");
    };
  })(),
  G = new wa();
const H = (a) => {
  const b = a.indexOf("\x00");
  return -1 < b ? a.substr(0, b) : a;
};
const I = (a, b) => {
    a.exports.freeStringMem(b);
  },
  M = (a, b) => {
    if ("string" !== typeof b) console.error("Expected string but got", typeof b);
    else {
      b = G.encode(b);
      var c = a.exports.allocStringMem(b.length);
      new Uint8Array(a.i.memory.buffer, c, b.length + 1).set(b);
      return c;
    }
  };
const xa = (a) => (b, c) => {
  c = M(a, c);
  b = a.exports.csoundParseOrc(b, c);
  I(a, c);
  return b;
};
xa.toString = () => "parseOrc = async (orchestra) => Object;";
const ya = (a) => (b, c) => a.exports.csoundCompileTree(b, c);
ya.toString = () => "compileTree = async (tree) => Number;";
const za = (a) => (b, c) => {
  c = M(a, c);
  b = a.exports.csoundCompileOrc(b, c);
  I(a, c);
  return b;
};
za.toString = () => "compileOrc = async (orchestra) => Number;";
const Aa = (a) => (b, c) => {
  c = M(a, c);
  b = a.exports.csoundEvalCode(b, c);
  I(a, c);
  return b;
};
Aa.toString = () => "csoundEvalCode = async (orchestra) => Number;";
const Ba = (a) => (b) => a.exports.csoundStartWasi(b);
Ba.toString = () => "start = async () => Number;";
const Ca =
  (a) =>
  (b, c, d = 1) => {
    c = M(a, c);
    b = a.exports.csoundCompileCSD(b, c, d, 0);
    I(a, c);
    return b;
  };
Ca.toString = () => "compileCSD = async (csoundDocument) => Number;";
const Da = (a) => (b) => a.exports.csoundPerformKsmpsWasi(b);
Da.toString = () => "performKsmps = async (csound) => Number;";
const Ea = () => () => {};
Ea.toString = () => "stop = async () => undefined;";
const Fa = (a) => (b) => a.exports.csoundResetWasi(b);
Fa.toString = () => "reset = async () => Number;";
const Ha = [
    ["device_name", "char", 64],
    ["interface_name", "char", 64],
    ["device_id", "char", 64],
    ["midi_module", "char", 64],
    ["isOutput", "int"],
  ],
  Ia = [
    ["type", "int"],
    ["lexme", "ptr"],
    ["value", "int"],
    ["fvalue", "double"],
    ["optype", "ptr"],
    ["next", "ptr"],
  ],
  Ja = [
    ["type", "int"],
    ["value", "ptr"],
    ["rate", "int"],
    ["len", "int"],
    ["line", "int"],
    ["locn", "uint64"],
    ["left", "ptr"],
    ["right", "ptr"],
    ["next", "ptr"],
    ["markup", "ptr"],
  ];
const Ka = { ub: 4, Ib: 8, bb: 8, char: 1, rb: 8, Eb: 4, Jb: 8 },
  N = (a) =>
    a ? a.reduce((b, [, c]) => (Ka[c] ? Ka[c] + b : N({ eb: Ja, cb: Ia }[c]) + b), 0) : 0;
N(Ja);
N(Ia);
N([
  ["debug_mode", "int"],
  ["buffer_frames", "int"],
  ["hardware_buffer_frames", "int"],
  ["displays", "int"],
  ["ascii_graphs", "int"],
  ["postscript_graphs", "int"],
  ["message_level", "int"],
  ["tempo", "int"],
  ["ring_bell", "int"],
  ["use_cscore", "int"],
  ["terminate_on_midi", "int"],
  ["heartbeat", "int"],
  ["defer_gen01_load", "int"],
  ["midi_key", "int"],
  ["midi_key_cps", "int"],
  ["midi_key_oct", "int"],
  ["midi_key_pch", "int"],
  ["midi_velocity", "int"],
  ["midi_velocity_amp", "int"],
  ["no_default_paths", "int"],
  ["number_of_threads", "int"],
  ["syntax_check_only", "int"],
  ["csd_line_counts", "int"],
  ["compute_weights", "int"],
  ["realtime_mode", "int"],
  ["sample_accurate", "int"],
  ["sample_rate_override", "MYFLT"],
  ["control_rate_override", "MYFLT"],
  ["nchnls_override", "int"],
  ["nchnls_i_override", "int"],
  ["e0dbfs_override", "MYFLT"],
  ["daemon", "int"],
  ["ksmps_override", "int"],
  ["FFT_library", "int"],
]);
const La = N(Ha);
const Ma = (a) => {
  const [b] = Ha.reduce(
    ([c, d], [e, h, ...g]) => {
      g = "char" === h ? Ka[h] * g[0] : Ka[h];
      h = "char" === h ? H(E.decode(a.subarray(d, g))) || "" : a[d];
      c[e] = h;
      return [c, d + g];
    },
    [{}, 0],
  );
  return b;
};
const Na = (a) => (b) => a.exports.csoundGetSr(b);
Na.toString = () => "getSr = async () => Number;";
const Oa = (a) => (b, c) => a.exports.csoundSystemSr(b, c);
Oa.toString = () => "systemSr = async (val) => Number;";
const Pa = (a) => (b) => a.exports.csoundGetKr(b);
Pa.toString = () => "getKr = async () => Number;";
const Qa = (a) => (b) => a.exports.csoundGetKsmps(b);
Qa.toString = () => "getKsmps = async () => Number;";
Qa.toString = () => "getChannels = async (isInput) => Number;";
const Ra = (a) => (b) => a.exports.csoundGetChannels(b, 0);
Ra.toString = () => "getNchnls = async () => Number;";
const Sa = (a) => (b) => a.exports.csoundGetChannels(b, 1);
Sa.toString = () => "getNchnlsInput = async () => Number;";
const Ta = (a) => (b) => a.exports.csoundGet0dBFS(b);
Ta.toString = () => "get0dBFS = async () => Number;";
const Ua = (a) => (b) => a.exports.csoundGetA4(b);
Ua.toString = () => "getA4 = async () => Number;";
const Va = (a) => (b) => a.exports.csoundGetCurrentTimeSamples(b);
Va.toString = () => "getCurrentTimeSamples = async () => Number;";
const Wa = (a) => (b) => a.exports.csoundGetSizeOfMYFLT(b);
Wa.toString = () => "getSizeOfMYFLT = async () => Number;";
const Xa = (a) => (b, c) => {
  c = M(a, c);
  b = a.exports.csoundSetOption(b, c);
  I(a, c);
  return b;
};
Xa.toString = () => "setOption = async (option) => Number;";
const Ya = (a) => (b) => a.exports.csoundGetDebug(b);
Ya.toString = () => "getDebug = async () => Number;";
const Za = (a) => (b, c) => {
  a.exports.csoundSetDebug(b, c);
};
Za.toString = () => "setDebug = async (number) => undefined;";
const $a = (a) => (b) => a.exports.csoundGetSpin(b);
$a.toString = () => "getSpin = async (csound) => Number;";
const ab = (a) => (b) => a.exports.csoundGetSpout(b);
ab.toString = () => "getSpout = async () => Number;";
const bb = (a) => {
  const b = [];
  for (let c = 0; c < a; c++) b.push(c);
  return b;
};
const cb = (a) => (b, c) => {
  const d = a.i.memory.buffer,
    e = a.exports.csoundGetMIDIDevList(b, void 0, c ? 1 : 0);
  if (0 === e) return [];
  const h = a.exports.allocCsMidiDeviceStruct(e);
  a.exports.csoundGetMIDIDevList(b, h, c ? 1 : 0);
  const g = new Uint8Array(d, h, La * e);
  b = bb(e).map((f) => Ma(g.subarray(f * La, La)));
  a.exports.freeCsMidiDeviceStruct(h);
  return b;
};
cb.toString = () => "getMIDIDevList = async (isOutput) => Object;";
const db = (a) => (b) => {
  var c = a.i.memory.buffer;
  b = a.exports.getRtMidiName(b);
  c = new Uint8Array(c, b, 128);
  return H(E.decode(c)) || "";
};
db.toString = () => "getRtMidiName = async () => String;";
const eb = (a) => (b, c, d, e) => {
  a.exports.pushMidiMessage(b, c, d, e);
};
eb.toString = () => "midiMessage = async (status, data1, data2) => undefined;";
const fb = (a) => (b, c) => {
  c = M(a, c);
  b = a.exports.csoundEventString(b, c, 0);
  I(a, c);
  return b;
};
fb.toString = () => "inputMessage = async (scoreEvent) => Number;";
const gb = (a) => (b, c) => {
  c = M(a, c);
  b = a.exports.csoundEventString(b, c, 1);
  I(a, c);
  return b;
};
gb.toString = () => "inputMessageAsync = async (scoreEvent) => Number;";
const hb = (a) => (b, c) => {
  c = M(a, c);
  b = a.exports.csoundGetControlChannelWasi(b, c);
  I(a, c);
  return b;
};
hb.toString = () => "getControlChannel = async (channelName) => Number;";
const ib = (a) => (b, c, d) => {
  c = M(a, c);
  a.exports.csoundSetControlChannel(b, c, d);
  I(a, c);
};
ib.toString = () => "setControlChannel = async (channelName, value) => void;";
const jb = (a) => (b, c) => {
  c = M(a, c);
  b = a.exports.csoundGetStringChannelWasi(b, c);
  var d = new Uint8Array(a.i.memory.buffer, b);
  d = E.decode(d);
  d = H(d);
  I(a, c);
  I(a, b);
  return d;
};
jb.toString = () => "getStringChannel = async (channelName) => String;";
const kb = (a) => (b, c, d) => {
  c = M(a, c);
  d = M(a, d);
  a.exports.csoundSetStringChannel(b, c, d);
  I(a, c);
  I(a, d);
};
kb.toString = () => "setStringChannel = async (channelName, value) => void;";
const lb = (a) => (b) => {
  var c = a.i.memory.buffer;
  b = a.exports.csoundGetOutputName(b);
  c = new Uint8Array(c, b, 64);
  return H(E.decode(c)) || "";
};
lb.toString = () => "getOutputName = async () => String;";
const mb = (a) => (b) => {
  var c = a.i.memory.buffer;
  b = a.exports.csoundGetInputName(b);
  c = new Uint8Array(c, b, 64);
  return H(E.decode(c)) || "";
};
mb.toString = () => "getInputName = async (csound) => String;";
const nb = (a) => (b, c, d) => {
  c = M(a, c);
  d = M(a, d);
  b = a.exports.csoundAppendEnv(b, c, d);
  I(a, c);
  I(a, d);
  return b;
};
nb.toString = () => "appendEnv = async (csound, variable, value) => Number;";
const ob = (a) => (b) => a.exports.csoundIsScorePending(b);
ob.toString = () => "isScorePending = async () => Number;";
const pb = (a) => (b, c) => a.exports.csoundSetScorePending(b, c);
pb.toString = () => "setScorePending = async (pending) => Number;";
const qb = (a) => (b, c) => {
  c = M(a, c);
  b = a.exports.csoundEventString(b, c, 0);
  I(a, c);
  return b;
};
qb.toString = () => "readScore = async (score) => Number;";
const rb = (a) => (b) => a.exports.csoundGetScoreTime(b);
rb.toString = () => "getScoreTime = async () => Number;";
const sb = (a) => (b) => a.exports.csoundGetScoreOffsetSeconds(b);
sb.toString = () => "getScoreOffsetSeconds = async () => Number;";
const tb = (a) => (b, c) => a.exports.csoundSetScoreOffsetSeconds(b, c);
tb.toString = () => "setScoreOffsetSeconds = async () => Number;";
const ub = (a) => (b) => a.exports.csoundRewindScore(b);
ub.toString = () => "rewindScore = async () => undefined;";
const vb = (a) => (b, c) => a.exports.csoundTableLength(b, c);
vb.toString = () => "tableLength = async (tableNum) => Number;";
const wb = (a) => (b, c, d) => {
  const e = a.exports.allocFloatArray(d.length);
  new Float64Array(a.i.memory.buffer, e, d.length).set(d);
  a.exports.csoundTableCopyIn(b, c, e);
  a.exports.freeFloatArrayMem(e);
};
wb.toString = () => "tableCopyIn = async (tableNum, float64Array) => undefined;";
const O = (a) => (b, c) => {
  var d = a.exports.csoundTableLength(b, c);
  if (0 < d) {
    const e = a.exports.allocFloatArray(d);
    a.exports.csoundTableCopyOut(b, c, e);
    b = new Float64Array(a.i.memory.buffer, e, d);
    c = new Float64Array(b.length);
    for (d = 0; d < b.length; d++) c[d] = b[d];
    a.exports.freeFloatArrayMem(e);
    return c;
  }
};
O.toString = () => "tableCopyOut = async (tableNum) => ?Float64Array;";
O.toString = O.toString;
const xb = (a) => (b, c) => {
  const d = a.exports.allocFloatArray(1024);
  a.exports.csoundGetTableArgs(b, d, c);
  b = new Float64Array(a.i.memory.buffer, d, 1024);
  a.exports.freeFloatArrayMem(d);
  return b;
};
xb.toString = () => "getTableArgs = async (tableNum) => ?Float64Array;";
function yb(a) {
  return (b, c, d) => {
    b = "string" === typeof d ? G.encode(d) : d;
    a.i.writeFile(c, b);
  };
}
t("writeFile$$module$src$filesystem$worker_fs", yb);
yb.toString = () => "async (path, data) => void";
function zb(a) {
  return (b, c, d) => {
    b = "string" === typeof d ? G.encode(d) : d;
    a.i.appendFile(c, b);
  };
}
t("appendFile$$module$src$filesystem$worker_fs", zb);
zb.toString = () => "async (path, data) => void";
function Ab(a) {
  return (b, c) => a.i.readFile(c);
}
t("readFile$$module$src$filesystem$worker_fs", Ab);
Ab.toString = () => "async (path) => ?Uint8Array";
function Bb(a) {
  return (b, c) => a.i.unlink(c);
}
t("unlink$$module$src$filesystem$worker_fs", Bb);
Bb.toString = () => "async (path) => void";
function Cb(a) {
  return (b, c) => a.i.readdir(c);
}
t("readdir$$module$src$filesystem$worker_fs", Cb);
Cb.toString = () => "async (path) => string[]";
function Db(a) {
  return (b, c) => a.i.mkdir(c);
}
t("mkdir$$module$src$filesystem$worker_fs", Db);
Db.toString = () => "async (path) => void";
function Eb(a) {
  return (b, c) => a.i.stat(c);
}
t("stat$$module$src$filesystem$worker_fs", Eb);
Eb.toString = () => "async (path) => ?object";
function Fb(a) {
  return (b, c) => Gb(a.i, c);
}
t("pathExists$$module$src$filesystem$worker_fs", Fb);
Fb.toString = () => "async (path) => boolean";
function Hb(a) {
  return (b, c) => Ib(a.i, c);
}
t("chdir$$module$src$filesystem$worker_fs", Hb);
Hb.toString = () => "async (path) => number";
function Jb(a) {
  return () => a.i.cwd;
}
t("getcwd$$module$src$filesystem$worker_fs", Jb);
Jb.toString = () => "async () => string";
const P = {};
P.writeFile = yb;
P.appendFile = zb;
P.readFile = Ab;
P.unlink = Bb;
P.readdir = Cb;
P.mkdir = Db;
P.stat = Eb;
P.pathExists = Fb;
P.chdir = Hb;
P.getcwd = Jb;
const Kb = {
  csoundCreate: ra,
  csoundDestroy: sa,
  csoundGetAPIVersion: ta,
  csoundGetVersion: ua,
  csoundInitialize: va,
  csoundParseOrc: xa,
  csoundCompileTree: ya,
  csoundCompileOrc: za,
  csoundEvalCode: Aa,
  csoundStart: Ba,
  csoundCompileCSD: Ca,
  csoundPerformKsmps: Da,
  csoundStop: Ea,
  csoundReset: Fa,
  csoundGetSr: Na,
  mb: Oa,
  csoundGetKr: Pa,
  csoundGetKsmps: Qa,
  csoundGetNchnls: Ra,
  csoundGetNchnlsInput: Sa,
  kb: (a) => (b, c) => a.exports.csoundGetChannels(b, c),
  csoundGet0dBFS: Ta,
  csoundGetA4: Ua,
  csoundGetCurrentTimeSamples: Va,
  csoundGetSizeOfMYFLT: Wa,
  csoundSetOption: Xa,
  csoundGetDebug: Ya,
  csoundSetDebug: Za,
  csoundGetSpin: $a,
  csoundGetSpout: ab,
  csoundGetMIDIDevList: cb,
  csoundSetMidiCallbacks: (a) => (b) => {
    a.exports.csoundSetMidiCallbacks(b);
  },
  csoundGetRtMidiName: db,
  csoundGetMidiOutFileName: (a) => (b) => {
    var c = a.i.memory.buffer;
    b = a.exports.getMidiOutFileName(b);
    c = new Uint8Array(c, b, 128);
    b && 0 < b.length && I(a, b);
    return H(E.decode(c)) || "";
  },
  csoundPushMidiMessage: eb,
  _isRequestingRtMidiInput: (a) => (b) => a.exports.isRequestingRtMidiInput(b),
  csoundInputMessage: fb,
  csoundInputMessageAsync: gb,
  csoundGetControlChannel: hb,
  csoundSetControlChannel: ib,
  csoundGetStringChannel: jb,
  csoundSetStringChannel: kb,
  csoundGetInputName: mb,
  csoundGetOutputName: lb,
  csoundAppendEnv: nb,
  csoundShouldDaemonize: (a) => (b) => a.exports.csoundShouldDaemonize(b),
  csoundIsScorePending: ob,
  csoundSetScorePending: pb,
  csoundReadScore: qb,
  csoundGetScoreTime: rb,
  csoundGetScoreOffsetSeconds: sb,
  csoundSetScoreOffsetSeconds: tb,
  csoundRewindScore: ub,
  csoundTableLength: vb,
  csoundTableCopyIn: wb,
  csoundTableCopyOut: O,
  csoundGetTable: O,
  csoundGetTableArgs: xb,
  fs: P,
};
function Lb(a) {
  const { fs: b, ...c } = Kb;
  return {
    ...Object.keys(c).reduce((d, e) => {
      d[e] = c[e](a);
      return d;
    }, {}),
    ...Object.keys(b).reduce((d, e) => {
      d[e] = b[e](a);
      return d;
    }, {}),
  };
}
void 0 !== q && (q = {});
q.BigInt || (q.BigInt = void 0 === BigInt ? Number : BigInt);
const Mb =
    q.BigInt(1) |
    q.BigInt(2) |
    q.BigInt(4) |
    q.BigInt(8) |
    q.BigInt(16) |
    q.BigInt(32) |
    q.BigInt(64) |
    q.BigInt(128) |
    q.BigInt(256) |
    q.BigInt(2097152) |
    q.BigInt(4194304) |
    q.BigInt(8388608) |
    q.BigInt(134217728),
  Nb = q.BigInt(0);
function Ob(a) {
  let b = arguments[0];
  for (let d = 1; d < arguments.length; d++) {
    const e = arguments[d];
    if (0 == e.lastIndexOf("/", 0)) b = e;
    else {
      var c;
      (c = "" == b) || ((c = b.length - 1), (c = 0 <= c && b.indexOf("/", c) == c));
      c ? (b += e) : (b += "/" + e);
    }
  }
  return b;
}
function Pb(a) {
  return a ? a.split("/").filter((b) => 0 < b.length && "." !== b) : [];
}
function Q(a) {
  if (!a) return "/";
  const b = [];
  Pb(a).forEach((c) => {
    ".." === c ? 0 < b.length && b.pop() : b.push(c);
  });
  return 0 < b.length ? `/${b.join("/")}` : "/";
}
function S(a, b) {
  if (!b || "." === b) return Q(a || "/");
  if (/^\//.test(b)) return Q(b);
  a = Pb(a || "/");
  b = b.split("/");
  const c = [...a];
  b.forEach((d) => {
    d && "." !== d && (".." === d ? 0 < c.length && c.pop() : c.push(d));
  });
  return 0 < c.length ? `/${c.join("/")}` : "/";
}
function Qb() {
  return "undefined" === typeof performance || "undefined" === typeof performance.now
    ? Date.now() - Date.now()
    : performance.now();
}
function Rb(a) {
  var b = a.reduce((d, e) => d + e.length, 0);
  if (0 !== a.length) {
    b = new Uint8Array(b);
    var c = 0;
    for (const d of a) (b.set(d, c), (c += d.length));
    return b;
  }
}
function z() {
  var { aa: a } = { aa: { "/": "/" } };
  this.fd = Array.from({ length: 4 });
  this.fd[0] = { fd: 0, path: "/dev/stdin", seekPos: q.BigInt(0), buffers: [] };
  this.fd[1] = { fd: 1, path: "/dev/stdout", seekPos: q.BigInt(0), buffers: [] };
  this.fd[2] = { fd: 2, path: "/dev/stderr", seekPos: q.BigInt(0), buffers: [] };
  this.fd[3] = { fd: 3, path: "/", seekPos: q.BigInt(0), buffers: [], type: "dir" };
  this.h = this.h.bind(this);
  this.g = 0;
  this.cwd = "/";
  this.aa = a || {};
}
z.prototype.start = function (a) {
  this.g = Qb();
  a.exports._start();
};
function Sb(a, b) {
  const c = {};
  b = WebAssembly.Module.imports(b);
  for (const d of b)
    "function" === d.kind &&
      d.module.startsWith("wasi_") &&
      ("object" !== typeof c[d.module] && (c[d.module] = {}),
      (c[d.module][d.name] = a[d.name].bind(a)));
  return c;
}
z.prototype.h = function () {
  (this.view && this.view.buffer && this.view.buffer.byteLength) ||
    (this.view = new DataView(this.memory.buffer));
  return this.view;
};
function Tb(a, b) {
  b = Q(b);
  a = Object.values(a.fd);
  for (const c of a) if (c && c.path === b) return c;
  return null;
}
function Ib(a, b) {
  b = Q(S(a.cwd, b));
  if ("/" === b)
    return ((a.cwd = "/"), a.fd[3] && ((a.fd[3].path = "/"), (a.fd[3].type = "dir")), 0);
  const c = Tb(a, b);
  if (!c) return 44;
  if (c.type && "dir" !== c.type) return 54;
  a.cwd = b;
  a.fd[3] && ((a.fd[3].path = b), (a.fd[3].type = "dir"));
  return 0;
}
function Ub(a) {
  const b = Math.trunc(a);
  return q.BigInt(b) * q.BigInt(1e6) + q.BigInt(Math.round(1e6 * (a - b)));
}
function Vb(a, b) {
  switch (b) {
    case 1:
      return Math.floor(Qb());
    case 0:
      return Ub(Date.now());
    case 2:
    case 3:
      return Math.floor(Qb() - a.g);
    default:
      return 0;
  }
}
z.prototype.ga = function () {
  return 0;
};
y("args_get", z.prototype.ga);
z.prototype.ha = function () {
  return 0;
};
y("args_sizes_get", z.prototype.ha);
z.prototype.ia = function () {
  return 0;
};
y("clock_res_get", z.prototype.ia);
z.prototype.ja = function (a, b, c) {
  this.h().setBigUint64(c, q.BigInt(Vb(this, a)), !0);
  return 0;
};
y("clock_time_get", z.prototype.ja);
z.prototype.ka = function () {
  return 0;
};
y("environ_get", z.prototype.ka);
z.prototype.la = function () {
  return 0;
};
y("environ_sizes_get", z.prototype.la);
z.prototype.ma = function () {
  return 52;
};
y("fd_advise", z.prototype.ma);
z.prototype.na = function () {
  return 52;
};
y("fd_allocate", z.prototype.na);
z.prototype.oa = function () {
  return 0;
};
y("fd_close", z.prototype.oa);
z.prototype.pa = function () {
  return 0;
};
y("fd_datasync", z.prototype.pa);
z.prototype.qa = function (a, b) {
  a = this.h();
  a.setUint8(b + 4, 4);
  a.setUint16(b + 2, 0, !0);
  a.setUint16(b + 4, 0, !0);
  a.setBigUint64(b + 8, q.BigInt(Mb), !0);
  a.setBigUint64(b + 8 + 8, q.BigInt(Nb), !0);
  return 0;
};
y("fd_fdstat_get", z.prototype.qa);
z.prototype.ra = function () {
  return 52;
};
y("fd_fdstat_set_flags", z.prototype.ra);
z.prototype.sa = function () {
  return 0;
};
y("fd_fdstat_set_rights", z.prototype.sa);
z.prototype.ta = function (a, b) {
  let c = 0;
  this.fd[a] &&
    (c = this.fd[a].buffers.reduce(function (e, h) {
      return e + (null == h ? void 0 : h.byteLength) ? (null == h ? void 0 : h.byteLength) : 0;
    }, 0));
  const d = this.h();
  d.setBigUint64(b, q.BigInt(a), !0);
  b += 8;
  d.setBigUint64(b, q.BigInt(a), !0);
  b += 8;
  d.setUint8(b, 4);
  b += 8;
  d.setBigUint64(b, q.BigInt(1), !0);
  b += 8;
  d.setBigUint64(b, q.BigInt(c), !0);
  b += 8;
  d.setBigUint64(b, Ub(this.g), !0);
  b += 8;
  d.setBigUint64(b, Ub(this.g), !0);
  d.setBigUint64(b + 8, Ub(this.g), !0);
  return 0;
};
y("fd_filestat_get", z.prototype.ta);
z.prototype.ua = function () {
  return 0;
};
y("fd_filestat_set_size", z.prototype.ua);
z.prototype.va = function () {
  return 0;
};
y("fd_filestat_set_times", z.prototype.va);
z.prototype.wa = function () {
  return 0;
};
y("fd_pread", z.prototype.wa);
z.prototype.xa = function (a, b) {
  if (!this.fd[a] && !this.fd[a - 1]) return 8;
  var { path: c } = this.fd[a];
  a = this.h();
  c = G.encode(c);
  new Uint8Array(a.buffer).set(c, b);
  return 0;
};
y("fd_prestat_dir_name", z.prototype.xa);
z.prototype.ya = function (a, b) {
  if (!this.fd[a]) return 8;
  var { path: c } = this.fd[a];
  a = this.h();
  c = G.encode(c);
  a.setUint8(b, 0);
  a.setUint32(b + 4, c.byteLength, !0);
  return 0;
};
y("fd_prestat_get", z.prototype.ya);
z.prototype.za = function (a, b, c, d, e) {
  console.log("fd_pwrite", a, b, c, d, e, arguments);
  return 0;
};
y("fd_pwrite", z.prototype.za);
z.prototype.Aa = function (a, b, c, d) {
  const e = this.h();
  a = this.fd[a];
  if (!a || !Array.isArray(a.buffers)) return (e.setUint32(d, 0, !0), 8);
  const h = a.buffers;
  if (0 === h.length) return (e.setUint32(d, 0, !0), (a.seekPos = q.BigInt(0)), 0);
  var g = h.reduce((u, r) => u + r.length, 0);
  let f = Number(a.seekPos),
    k = 0,
    l = !1;
  if (f >= g) return ((b = e.getUint32(b, !0)), e.setUint8(b, 0), e.setUint32(d, 0, !0), 0);
  for (g = 0; g < c; g++) {
    var n = b + 8 * g;
    const u = e.getUint32(n, !0);
    n = e.getUint32(n + 4, !0);
    l ||
      ((k += n),
      Array.from({ length: n }, (r, p) => p).reduce(
        (r, p) => {
          if (l) return r;
          const [J, R] = r;
          let F = (r = 0),
            w = !1,
            v = 0,
            C;
          if (0 === p)
            for (; !w; )
              ((C = h[r] ? h[r].byteLength : 0),
                v <= f && C + v > f ? ((w = !0), (F = f - v)) : ((v += C), (r += 1)));
          else ((r = J), (F = R));
          h[r]
            ? (e.setUint8(u + p, h[r][F]),
              F + 1 >= h[r].byteLength ? ((r = J + 1), (F = 0)) : (F += 1))
            : (e.setUint8(u + p, 0), (f += p), (l = !0));
          return [r, F];
        },
        [0, 0],
      ),
      l || (f += n));
  }
  a.seekPos = q.BigInt(f);
  e.setUint32(d, k, !0);
  return 0;
};
y("fd_read", z.prototype.Aa);
z.prototype.Ba = function () {
  return 0;
};
y("fd_readdir", z.prototype.Ba);
z.prototype.Ca = function () {
  return 0;
};
y("fd_renumber", z.prototype.Ca);
z.prototype.Da = function (a, b, c, d) {
  const e = this.h();
  switch (c) {
    case 1:
      let h;
      this.fd[a].seekPos = (null != (h = this.fd[a].seekPos) ? h : q.BigInt(0)) + q.BigInt(b);
      break;
    case 2:
      c = (this.fd[a].buffers || []).reduce((g, f) => g + f.length, 0);
      this.fd[a].seekPos = BigInt(c) + BigInt(b);
      break;
    case 0:
      this.fd[a].seekPos = BigInt(b);
  }
  e.setBigUint64(d, this.fd[a].seekPos, !0);
  return 0;
};
y("fd_seek", z.prototype.Da);
z.prototype.Ea = function () {
  return 0;
};
y("fd_sync", z.prototype.Ea);
z.prototype.Fa = function (a, b) {
  const c = this.h();
  this.fd[a].seekPos || (this.fd[a].seekPos = q.BigInt(0));
  c.setBigUint64(b, this.fd[a].seekPos, !0);
  return 0;
};
y("fd_tell", z.prototype.Fa);
z.prototype.Ga = function (a, b, c, d) {
  let e = !1;
  const h = this.h();
  this.fd[a].buffers = this.fd[a].buffers || [];
  this.fd[a].seekPos === q.BigInt(0) && 0 < this.fd[a].buffers.length && (e = !0);
  let g = 0;
  for (let l = 0; l < c; l++) {
    var f = b + 8 * l,
      k = h.getUint32(f, !0);
    f = h.getUint32(f + 4, !0);
    g += f;
    k = new Uint8Array(h.buffer, k, f);
    e ? this.fd[a].buffers.unshift(k.slice(0, f)) : this.fd[a].buffers.push(k.slice(0, f));
  }
  this.fd[a].seekPos += q.BigInt(g);
  h.setUint32(d, g, !0);
  [1, 2].includes(a) && console.log(E.decode(Rb(this.fd[a].buffers)));
  return 0;
};
y("fd_write", z.prototype.Ga);
z.prototype.Ha = function () {
  return 0;
};
y("path_create_directory", z.prototype.Ha);
z.prototype.Ia = function () {
  return 0;
};
y("path_filestat_get", z.prototype.Ia);
z.prototype.Ja = function () {
  return 0;
};
y("path_filestat_set_times", z.prototype.Ja);
z.prototype.Ka = function () {
  return 0;
};
y("path_link", z.prototype.Ka);
z.prototype.La = function (a, b, c, d, e, h, g, f, k) {
  b = this.h();
  h = (this.fd[a] || { path: this.cwd }).path;
  c = new Uint8Array(b.buffer, c, d);
  c = E.decode(c);
  let l;
  3 === a ? (l = S(this.cwd, c)) : (l = Q(Ob(h, c)));
  if (l.startsWith("/..") || "/._" === l || "/.AppleDouble" === l) return 8;
  a = 0 !== (e & 2);
  d = 0 !== (e & 1);
  if ((c = Tb(this, l)) && "dir" === c.type && !a) return 31;
  if (!c && a) return 44;
  if (!c && !d && !a) return (b.setUint32(k, 4294967295, !0), 44);
  d = c ? c.fd : this.fd.length;
  c || void 0 !== this.fd[d] || (this.fd[d] = { fd: d });
  c = c || this.fd[d] || { fd: d };
  this.fd[d] = {
    ...c,
    fd: d,
    path: l,
    type: a ? "dir" : c.type || "file",
    seekPos: q.BigInt(0),
    buffers: Array.isArray(c.buffers) ? c.buffers : [],
  };
  0 === (e & 8) || a || (this.fd[d].buffers.length = 0);
  b.setUint32(k, d, !0);
  return 0;
};
y("path_open", z.prototype.La);
z.prototype.Ma = function () {
  return 0;
};
y("path_readlink", z.prototype.Ma);
z.prototype.Na = function () {
  return 0;
};
y("path_remove_directory", z.prototype.Na);
z.prototype.Oa = function () {
  return 0;
};
y("path_rename", z.prototype.Oa);
z.prototype.Pa = function () {
  return 0;
};
y("path_symlink", z.prototype.Pa);
z.prototype.Qa = function () {
  return 0;
};
y("path_unlink_file", z.prototype.Qa);
z.prototype.Ra = function () {
  return 0;
};
y("poll_oneoff", z.prototype.Ra);
z.prototype.Sa = function () {
  return 0;
};
y("proc_exit", z.prototype.Sa);
z.prototype.Ta = function () {
  return 0;
};
y("proc_raise", z.prototype.Ta);
z.prototype.Ua = function () {
  return 0;
};
y("random_get", z.prototype.Ua);
z.prototype.Va = function () {
  return 0;
};
y("sched_yield", z.prototype.Va);
z.prototype.Wa = function () {
  return 52;
};
y("sock_recv", z.prototype.Wa);
z.prototype.Xa = function () {
  return 52;
};
y("sock_send", z.prototype.Xa);
z.prototype.Ya = function () {
  return 52;
};
y("sock_shutdown", z.prototype.Ya);
function Wb(a, b) {
  return (a = Object.values(a.fd).find(({ path: c }) => c === b)) && a.buffers;
}
m = z.prototype;
m.readdir = function (a) {
  a = S(this.cwd, a);
  const b = "/" === a ? "/" : `${a}/`,
    c = [];
  Object.values(this.fd).forEach((d) => {
    if (d && d.path && ((d = d.path), d.startsWith(b))) {
      var e = d.slice(b.length);
      0 !== e.length && (/\//g.test(e) || c.push(d));
    }
  });
  return c.map((d) => d.replace(b, "").replace(/^\//g, "")).filter((d) => !!d);
};
m.writeFile = function (a, b) {
  const c = S(this.cwd, a);
  a = Object.keys(this.fd).length;
  const d = Object.values(this.fd).find(({ path: e }) => e === c);
  this.fd[a] = { fd: a, path: c, seekPos: q.BigInt(0), buffers: [b], type: "file" };
  d && delete this.fd[d];
};
m.appendFile = function (a, b) {
  var c = S(this.cwd, a);
  (c = Wb(this, c)) ? c.push(b) : console.error(`Can't append to non-existing file ${a}`);
};
m.readFile = function (a) {
  a = S(this.cwd, a);
  if ((a = Wb(this, a))) return Rb(a);
};
m.unlink = function (a) {
  const b = S(this.cwd, a);
  (a = Object.values(this.fd).find(({ path: c }) => c === b))
    ? delete this.fd[a.fd]
    : console.error(`While trying to unlink ${b}, path not found`);
};
m.mkdir = function (a) {
  const b = S(this.cwd, a),
    c = [];
  Object.values(this.fd).forEach(({ path: d }) => d.startsWith(b) && c.push(d));
  0 < c.length
    ? console.warn(`mkdir: path ${a} already exists`)
    : ((a = Object.keys(this.fd).length), (this.fd[a] = { fd: a, path: b, type: "dir" }));
};
m.stat = function (a) {
  const b = S(this.cwd, a);
  if ((a = Object.values(this.fd).find(({ path: e }) => e === b))) {
    var c = (a.buffers || []).reduce((e, h) => e + ((null == h ? void 0 : h.byteLength) || 0), 0),
      d = "dir" === a.type;
    return {
      qb: 0,
      tb: a.fd,
      mode: d ? 16877 : 33188,
      Db: 1,
      uid: 0,
      sb: 0,
      Fb: 0,
      size: c,
      jb: 4096,
      I: Math.ceil(c / 512),
      gb: this.g,
      Bb: this.g,
      pb: this.g,
      ib: this.g,
      fb: new Date(this.g),
      Ab: new Date(this.g),
      ob: new Date(this.g),
      hb: new Date(this.g),
      isFile: !d,
      isDirectory: d,
      vb: !1,
      wb: !1,
      zb: !1,
      xb: !1,
      yb: !1,
    };
  }
};
function Gb(a, b) {
  const c = S(a.cwd, b);
  return !!Object.values(a.fd).find(({ path: d }) => d === c);
}
function Xb(a) {
  for (; 0 < a.length; ) a.pop();
}
let T, Yb;
T = () => () => {};
Yb = () => {}; /*
 zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */
function U(a) {
  const b = a.length;
  let c = 0,
    d = Number.POSITIVE_INFINITY,
    e,
    h,
    g,
    f;
  let k, l;
  for (k = 0; k < b; ++k) (a[k] > c && (c = a[k]), a[k] < d && (d = a[k]));
  const n = 1 << c,
    u = new Uint32Array(n);
  e = 1;
  h = 0;
  for (g = 2; e <= c; ) {
    for (k = 0; k < b; ++k)
      if (a[k] === e) {
        f = 0;
        var r = h;
        for (l = 0; l < e; ++l) ((f = (f << 1) | (r & 1)), (r >>= 1));
        r = (e << 16) | k;
        for (l = f; l < n; l += g) u[l] = r;
        ++h;
      }
    ++e;
    h <<= 1;
    g <<= 1;
  }
  return [u, c, d];
}
function Zb(a, b) {
  this.I = [];
  this.bufferSize = 32768;
  this.l = this.u = this.j = this.A = 0;
  this.s = new Uint8Array(a);
  this.B = !1;
  this.v = V;
  this.resize = !1;
  if (b || !(b = {}))
    (b.index && (this.j = b.index),
      b.bufferSize && (this.bufferSize = b.bufferSize),
      b.v && (this.v = b.v),
      b.resize && (this.resize = b.resize));
  switch (this.v) {
    case W:
      this.g = 32768;
      this.h = new Uint8Array(this.bufferSize + 33026);
      break;
    case V:
      this.g = 0;
      this.h = new Uint8Array(this.bufferSize);
      break;
    default:
      throw Error("invalid inflate mode");
  }
}
var W = 0,
  V = 1,
  $b = new Uint16Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]),
  ac = new Uint16Array([
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
    163, 195, 227, 258, 258, 258,
  ]),
  bc = new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0,
  ]),
  cc = new Uint16Array([
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
    3073, 4097, 6145, 8193, 12289, 16385, 24577,
  ]),
  dc = new Uint8Array([
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
    13,
  ]),
  ec;
const fc = new Uint8Array(288);
let X, gc;
X = 0;
for (gc = fc.length; X < gc; ++X) fc[X] = 143 >= X ? 8 : 255 >= X ? 9 : 279 >= X ? 7 : 8;
ec = U(fc);
var hc;
const ic = new Uint8Array(30);
let jc, kc;
jc = 0;
for (kc = ic.length; jc < kc; ++jc) ic[jc] = 5;
hc = U(ic);
function Y(a, b) {
  let c = a.u,
    d = a.l;
  const e = a.s;
  let h = a.j;
  if (h + ((b - d + 7) >> 3) >= e.length) throw Error("input buffer is broken");
  for (; d < b; ) ((c |= e[h++] << d), (d += 8));
  a.u = c >>> b;
  a.l = d - b;
  a.j = h;
  return c & ((1 << b) - 1);
}
function Z(a, b) {
  let c = a.u,
    d = a.l;
  var e = a.s;
  let h = a.j;
  var g = e.length;
  const f = b[0];
  for (b = b[1]; d < b && !(h >= g); ) ((c |= e[h++] << d), (d += 8));
  e = f[c & ((1 << b) - 1)];
  g = e >>> 16;
  if (g > d) throw Error("invalid code length: " + g);
  a.u = c >> g;
  a.l = d - g;
  a.j = h;
  return e & 65535;
}
function lc(a, b, c) {
  let d = a.h,
    e = a.g;
  a.C = b;
  const h = d.length - 258;
  var g;
  let f, k;
  for (; 256 !== (g = Z(a, b)); )
    if (256 > g) (e >= h && ((a.g = e), (d = mc(a)), (e = a.g)), (d[e++] = g));
    else
      for (
        g -= 257,
          k = ac[g],
          0 < bc[g] && (k += Y(a, bc[g])),
          g = Z(a, c),
          f = cc[g],
          0 < dc[g] && (f += Y(a, dc[g])),
          e >= h && ((a.g = e), (d = mc(a)), (e = a.g));
        k--;
      )
        d[e] = d[e++ - f];
  for (; 8 <= a.l; ) ((a.l -= 8), a.j--);
  a.g = e;
}
function nc(a, b, c) {
  let d = a.h,
    e = a.g;
  a.C = b;
  let h = d.length;
  var g;
  let f, k;
  for (; 256 !== (g = Z(a, b)); )
    if (256 > g) (e >= h && ((d = oc(a)), (h = d.length)), (d[e++] = g));
    else
      for (
        g -= 257,
          k = ac[g],
          0 < bc[g] && (k += Y(a, bc[g])),
          g = Z(a, c),
          f = cc[g],
          0 < dc[g] && (f += Y(a, dc[g])),
          e + k > h && ((d = oc(a)), (h = d.length));
        k--;
      )
        d[e] = d[e++ - f];
  for (; 8 <= a.l; ) ((a.l -= 8), a.j--);
  a.g = e;
}
function mc(a) {
  const b = new Uint8Array(a.g - 32768),
    c = a.g - 32768,
    d = a.h;
  b.set(d.subarray(32768, b.length));
  a.I.push(b);
  a.A += b.length;
  d.set(d.subarray(c, c + 32768));
  a.g = 32768;
  return d;
}
function oc(a, b) {
  let c = Math.trunc(a.s.length / a.j + 1);
  const d = a.s,
    e = a.h;
  b && ("number" === typeof b.W && (c = b.W), "number" === typeof b.fa && (c += b.fa));
  2 > c
    ? ((b = (d.length - a.j) / a.C[2]),
      (b = Math.trunc((b / 2) * 258)),
      (b = b < e.length ? e.length + b : e.length << 1))
    : (b = e.length * c);
  b = new Uint8Array(b);
  b.set(e);
  a.h = b;
  return a.h;
}
function pc(a) {
  var b;
  this.j = a;
  this.g = 0;
  if (b || !(b = {})) (b.index && (this.g = b.index), b.verify && (this.verify = b.verify));
  const c = a[this.g++],
    d = a[this.g++];
  switch (c & 15) {
    case 8:
      this.method = 8;
      break;
    default:
      throw Error("unsupported compression method");
  }
  if (0 !== ((c << 8) + d) % 31) throw Error("invalid fcheck flag:" + (((c << 8) + d) % 31));
  if (d & 32) throw Error("fdict flag is not supported");
  this.h = new Zb(a, { index: this.g, bufferSize: b.bufferSize, v: b.v, resize: b.resize });
}
function qc(a) {
  var b = a.j,
    c;
  a: {
    for (c = a.h; !c.B; ) {
      var d = void 0,
        e = void 0,
        h = void 0,
        g = void 0,
        f = c,
        k = Y(f, 3);
      k & 1 && (f.B = !0);
      k >>>= 1;
      switch (k) {
        case 0:
          k = f.s;
          e = f.j;
          var l = f.h,
            n = f.g;
          h = k.length;
          d = l.length;
          f.u = 0;
          f.l = 0;
          if (e + 1 >= h) throw Error("invalid uncompressed block header: LEN");
          g = k[e++] | (k[e++] << 8);
          if (e + 1 >= h) throw Error("invalid uncompressed block header: NLEN");
          h = k[e++] | (k[e++] << 8);
          if (g === ~h) throw Error("invalid uncompressed block header: length verify");
          if (e + g > k.length) throw Error("input buffer is broken");
          switch (f.v) {
            case W:
              for (; n + g > l.length; )
                ((h = d - n),
                  (g -= h),
                  l.set(k.subarray(e, e + h), n),
                  (n += h),
                  (e += h),
                  (f.g = n),
                  (l = mc(f)),
                  (n = f.g));
              break;
            case V:
              for (; n + g > l.length; ) l = oc(f, { W: 2 });
              break;
            default:
              throw Error("invalid inflate mode");
          }
          l.set(k.subarray(e, e + g), n);
          f.j = e + g;
          f.g = n + g;
          f.h = l;
          break;
        case 1:
          switch (f.v) {
            case V:
              nc(f, ec, hc);
              break;
            case W:
              lc(f, ec, hc);
              break;
            default:
              throw Error("invalid inflate mode");
          }
          break;
        case 2:
          k = Y(f, 5) + 257;
          d = Y(f, 5) + 1;
          l = Y(f, 4) + 4;
          n = new Uint8Array($b.length);
          for (e = 0; e < l; ++e) n[$b[e]] = Y(f, 3);
          n = U(n);
          l = new Uint8Array(k + d);
          e = 0;
          for (d = k + d; e < d; )
            switch (((h = Z(f, n)), h)) {
              case 16:
                for (h = 3 + Y(f, 2); h--; ) l[e++] = g;
                break;
              case 17:
                for (h = 3 + Y(f, 3); h--; ) l[e++] = 0;
                g = 0;
                break;
              case 18:
                for (h = 11 + Y(f, 7); h--; ) l[e++] = 0;
                g = 0;
                break;
              default:
                g = l[e++] = h;
            }
          g = U(l.subarray(0, k));
          k = U(l.subarray(k));
          switch (f.v) {
            case V:
              nc(f, g, k);
              break;
            case W:
              lc(f, g, k);
              break;
            default:
              throw Error("invalid inflate mode");
          }
          break;
        default:
          throw Error("unknown BTYPE: " + k);
      }
    }
    switch (c.v) {
      case W:
        {
          f = 0;
          g = c.h;
          k = c.I;
          l = new Uint8Array(c.A + (c.g - 32768));
          let u;
          if (0 === k.length) c = c.h.subarray(32768, c.g);
          else {
            n = 0;
            for (d = k.length; n < d; ++n)
              for (e = k[n], h = 0, u = e.length; h < u; ++h) l[f++] = e[h];
            n = 32768;
            for (d = c.g; n < d; ++n) l[f++] = g[n];
            c.I = [];
            c.buffer = l;
            c = c.buffer;
          }
        }
        break a;
      case V:
        g = c.g;
        c.resize ? ((f = new Uint8Array(g)), f.set(c.h.subarray(0, g))) : (f = c.h.subarray(0, g));
        c.buffer = f;
        c = c.buffer;
        break a;
      default:
        throw Error("invalid inflate mode");
    }
  }
  a.g = a.h.j;
  if (a.verify) {
    a = ((b[a.g++] << 24) | (b[a.g++] << 16) | (b[a.g++] << 8) | b[a.g++]) >>> 0;
    b = c;
    if ("string" === typeof b) {
      b = [...b];
      f = 0;
      for (g = b.length; f < g; f++) b[f] = (b[f].charPointAt(0) & 255) >>> 0;
      b = new Uint8Array([b]);
    }
    f = 1;
    g = 0;
    k = b.length;
    for (l = 0; 0 < k; ) {
      e = 1024 < k ? 1024 : k;
      k -= e;
      do ((f += b[l++]), (g += f));
      while (--e);
      f %= 65521;
      g %= 65521;
    }
    if (a !== ((g << 16) | f) >>> 0) throw Error("invalid adler-32 checksum");
  }
  return c;
}
const rc = ({ memory: a, messagePort: b, ca: c }) =>
    function (d, e, h, g) {
      if (a) {
        d = new Uint8Array(a.buffer, g, h);
        d = E.decode(d);
        var f = /\n$/g.test(d);
        e = /^\n/g.test(d);
        var k = d.split("\n").filter((n) => 0 < n.length),
          l = [];
        if ((0 === k.length && f) || e) (l.push(c.join("")), Xb(c));
        k.forEach((n, u) => {
          u + 1 === k.length
            ? f
              ? 0 === u
                ? (l.push(c.join("") + n), Xb(c))
                : l.push(n)
              : c.push(n)
            : 0 === u
              ? (l.push(c.join("") + n), Xb(c))
              : l.push(n);
        });
        l.forEach((n) => {
          n.replace(/(\r\n|\n|\r)/gm, "") && b.$({ log: n });
        });
      }
    },
  sc = (a) => {
    if (a && "object" === typeof a && "object" === typeof a.exports) {
      if (a.exports.__wasm_call_ctors) {
        if (
          a.exports.csoundModuleCreate ||
          a.exports.csound_opcode_init ||
          a.exports.csound_fgen_init
        )
          return !0;
        console.error(
          a.exports,
          "A csound plugin turns out to be neither a plugin, opcode or module.\nPerhaps csdl.h or module.h wasn't imported correctly?",
        );
        return !1;
      }
      console.error(
        "A csound plugin didn't export __wasm_call_ctors.\nPlease re-run wasm-ld with either --export-all or include --export=__wasm_call_ctors",
      );
      return !1;
    }
    console.error("Error instantiating a csound plugin, instance and/or export is missing!");
    return !1;
  },
  tc = (a) => {
    function b() {
      let l = 0,
        n = 1;
      for (;;) {
        const u = a[c++];
        l += (u & 127) * n;
        n *= 128;
        if (!(u & 128)) break;
      }
      return l;
    }
    1836278016 !== new Uint32Array(new Uint8Array(a.subarray(0, 24)).buffer)[0] &&
      console.error("Wasm magic number is missing!");
    if (0 !== a[8]) return (Yb(), "static");
    let c = 9;
    const d = b();
    c++;
    c++;
    c++;
    c++;
    c++;
    c++;
    c++;
    c++;
    c += 3;
    const e = b(),
      h = b(),
      g = b(),
      f = b(),
      k = b();
    return { Gb: d, O: e, Z: h, Cb: k, da: g, Hb: f };
  },
  uc = async ({ Za: a, i: b, messagePort: c }) => {
    const d = await WebAssembly.compile(a);
    a = new WebAssembly.Memory({ initial: 16384 });
    const e = Sb(b, d);
    e.G = e.G || {};
    e.G.lb = () => 0;
    e.G.memory = a;
    e.G.nb = rc({ memory: e.G.memory, ca: [], messagePort: c });
    c = await WebAssembly.instantiate(d, e);
    b.memory = a;
    b.start(c);
    c.exports.__wasi_js_csoundSetMessageStringCallback();
    return [c, b];
  };
async function vc({ $a: a, withPlugins: b = [], messagePort: c }) {
  var d = {};
  const e = new z();
  a = new Uint8Array(a);
  a = qc(new pc(a));
  var h = tc(a);
  if ("static" === h) return await uc({ messagePort: c, Za: a, Kb: d, i: e });
  d = h.O;
  const g = h.Z;
  h = h.da;
  b = await b.reduce(async (w, v) => {
    w = await w;
    let C, B;
    try {
      ((C = new Uint8Array(v)), (B = tc(C)));
    } catch (L) {
      console.error("Error in plugin", L);
    }
    B && w.push({ X: B, ab: C });
    return w;
  }, []);
  d = Math.ceil((d + g) / 65536);
  var f = Math.ceil(b.reduce((w, { X: v }) => ("static" === v ? 0 : w + (v.O + g)), 0) / 65536);
  f = d + f + 2048;
  const k = new WebAssembly.Memory({ initial: f, maximum: 16384 }),
    l = new WebAssembly.Table({ initial: h + 1, element: "anyfunc" });
  e.memory = k;
  const n = new WebAssembly.Global({ value: "i32", mutable: !0 }, 65536 * f);
  h = new WebAssembly.Global({ value: "i32", mutable: !0 }, 65536 * f);
  f = new WebAssembly.Global({ value: "i32", mutable: !1 }, 2048);
  const u = new WebAssembly.Global({ value: "i32", mutable: !1 }, 1),
    r = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0);
  a = await WebAssembly.compile(a);
  const p = Sb(e, a);
  let J = [],
    R = d;
  p.env = p.env || {};
  p.env.memory = k;
  p.env.__indirect_function_table = l;
  p.env.__stack_pointer = n;
  p.env.__memory_base = f;
  p.env.__table_base = u;
  p.env.csoundLoadModules = (w) => {
    J.forEach((v) => {
      if (void 0 === F) console.error("csound-wasm internal: timing problem detected!");
      else {
        var C = F;
        if (v.exports.csoundModuleInit) {
          var B = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0),
            L = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0),
            K = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0);
          const aa = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0);
          let x = l.length;
          "function" === typeof v.exports.csoundModuleCreate &&
            (l.grow(1), (B.value = x), l.set(x, v.exports.csoundModuleCreate), (x += 1));
          "function" === typeof v.exports.csoundModuleInit &&
            (l.grow(1), (L.value = x), l.set(x, v.exports.csoundModuleInit), (x += 1));
          "function" === typeof v.exports.csoundModuleDestroy &&
            (l.grow(1), (K.value = x), l.set(x, v.exports.csoundModuleDestroy), (x += 1));
          "function" === typeof v.exports.csoundModuleErrorCodeToString &&
            (l.grow(1), (aa.value = x), l.set(x, v.exports.csoundModuleErrorCodeToString));
          C.exports.csoundWasiLoadPlugin(w, B, L, K, aa);
        } else
          v.exports.csound_opcode_init || v.exports.csound_fgen_init
            ? ((B = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0)),
              (L = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0)),
              (K = l.length),
              "function" === typeof v.exports.csound_opcode_init &&
                ((B.value = K), l.grow(1), l.set(K, v.exports.csound_opcode_init), (K += 1)),
              "function" === typeof v.exports.csound_fgen_init &&
                ((L.value = K), l.grow(1), l.set(K, v.exports.csound_fgen_init)),
              C.exports.csoundWasiLoadOpcodeLibrary(w, L, B))
            : console.error(
                "Plugin doesn't export nececcary functions to quality as csound plugin.",
              );
      }
    });
    return 0;
  };
  p.env.csoundLoadExternals = () => {};
  p.env._ZTH5errno = function () {};
  p.env.csoundWasiJsMessageCallback = rc({ memory: k, messagePort: c, ca: [] });
  p.env.printDebugCallback = (w, v) => {
    w = new Uint8Array(k.buffer, w, v);
    w = E.decode(w);
    console.log(w);
  };
  p["GOT.mem"] = p["GOT.mem"] || {};
  p["GOT.mem"].__heap_base = h;
  p["GOT.func"] = p["GOT.func"] || {};
  const F = await WebAssembly.instantiate(a, p);
  c = Object.assign({}, F.exports);
  a = {};
  c.memory = k;
  a.exports = c;
  J = await b.reduce(async (w, { X: v, ab: C }) => {
    w = await w;
    try {
      const B = v.O,
        L = v.Z,
        K = v.da,
        aa = await WebAssembly.compile(C),
        x = Sb(e, aa),
        wc = new WebAssembly.Global({ value: "i32", mutable: !1 }, 65536 * R);
      l.grow(K);
      x.env = Object.assign({}, x.env);
      x.env.memory = k;
      x.env.__indirect_function_table = l;
      x.env.__memory_base = wc;
      x.env.__stack_pointer = n;
      x.env.__table_base = u;
      x.env.csoundLoadModules = r;
      delete x.env.csoundWasiJsMessageCallback;
      R += Math.ceil((B + L) / 65536);
      const Ga = await WebAssembly.instantiate(aa, x);
      sc(Ga) && (Ga.exports.__wasm_call_ctors(), w.push(Ga));
    } catch (B) {
      console.error("Error while compiling csound-plugin", B);
    }
    return w;
  }, []);
  e.start(a);
  a.exports.__wasi_js_csoundSetMessageStringCallback();
  return [a, e];
}
async function xc(a, b) {
  b = b.csound;
  const c = a.g.csoundGetKr(b);
  let d = 0,
    e = 0;
  for (; "renderStarted" === a.h.F && 0 === d; )
    ((d = a.g.csoundPerformKsmps(b)),
      (e += 1),
      0 === d &&
        0 === e % (2 * c) &&
        (await new Promise((h) => {
          a.N = h;
        })));
  a.h.o("renderEnded");
}
class yc extends AudioWorkletProcessor {
  constructor(a) {
    super(a);
    this.P =
      this.g =
      this.N =
      this.rtmidiPort =
      this.J =
      this.m =
      this.R =
      this.K =
      this.A =
      this.j =
      this.T =
      this.l =
      this.L =
      this.D =
      this.i =
        void 0;
    this.H = [];
    this.sampleRate = globalThis.sampleRate;
    this.initialize = this.initialize.bind(this);
    this.pause = this.pause.bind(this);
    this.stop = this.stop.bind(this);
    this.process = this.process.bind(this);
    this.resume = this.resume.bind(this);
    this.start = this.start.bind(this);
    this.isRequestingInput = this.isRequestingInput.bind(this);
    this.isRequestingRealtimeOutput = this.isRequestingRealtimeOutput.bind(this);
    this.C = this.B = this.s = this.u = this.M = !1;
    this.callUncloned = () => console.error("Csound worklet thread is still uninitialized!");
    this.port.start();
    ha(this, this.port);
    this.h = new qa();
    this.initializeMessagePort = ({ messagePort: b, rtmidiPort: c }) => {
      this.h.$ = (d) => {
        b.postMessage({ log: d });
      };
      this.h.o = (d) => {
        this.h.F !== d && (this.h.F = d);
        const e = {};
        e.playStateChange = d;
        b.postMessage(e);
      };
      this.h.ea = !0;
      T()();
      this.rtmidiPort = c;
      this.rtmidiPort.addEventListener("message", ({ data: d }) => {
        this.H.push(d);
      });
      this.rtmidiPort.start();
    };
  }
  async initialize(a, b) {
    T()();
    let c;
    const d = new Promise((e) => {
      c = e;
    });
    vc({ $a: a, withPlugins: b, messagePort: this.h }).then(([e, h]) => {
      this.D = e;
      this.i = h;
      e.i = h;
      this.g = Lb(e);
      this.callUncloned = (g, f) => (g = this.P.get(g)) && g.apply({}, f || []);
      this.m = this.g.csoundCreate(0);
      this.J = 0;
      this.C = this.u = this.B = !1;
      this.S(!1);
      this.P = new Map(
        Object.entries({
          ...this.g,
          csoundCreate: async () => this.m,
          csoundReset: this.S.bind(this),
          csoundStop: this.stop.bind(this),
          csoundStart: this.start.bind(this),
          D: e,
        }),
      );
      T()();
      c();
    });
    T()();
    await d;
  }
  async S(a) {
    if (
      (a && !this.h) ||
      (a && "realtimePerformanceEnded" !== this.h.F && "realtimePerformanceStarted" !== this.h.F)
    )
      return -1;
    a && "realtimePerformanceStarted" === this.h.F && this.h.o("realtimePerformanceEnded");
    this.C = this.B = !1;
    this.J = 0;
    const b = this.m;
    a && this.g.csoundReset(b);
    this.sampleRate &&
      ((a = this.g.csoundSetOption(b, "--sample-rate=" + this.sampleRate)),
      0 !== a && console.error("csoundSetOption sample-rate failed:", a));
    this.A = this.j = -1;
    delete this.l;
  }
  stop() {
    this.m && this.g.csoundStop(this.m);
    this.h.o("realtimePerformanceEnded");
  }
  pause() {
    this.s || (this.h.o("realtimePerformancePaused"), (this.s = !0));
  }
  resume() {
    this.s && (this.h.o("realtimePerformanceResumed"), (this.s = !1));
  }
  process(a, b) {
    "function" === typeof this.N && this.N();
    if (!(this.u || (!this.s && this.l && this.B))) {
      a = b[0];
      b = a[0].length;
      for (var c = 0; c < b; c++) for (var d = 0; d < this.j; d++) a[d][c] = 0;
      return !0;
    }
    this.M && ((this.M = !1), this.h.o("realtimePerformanceStarted"));
    0 < this.H.length &&
      (this.H.forEach((p) => {
        this.g.csoundPushMidiMessage(this.m, p[0], p[1], p[2]);
      }),
      Xb(this.H));
    a = a[0];
    b = b[0];
    c = b[0].length;
    d = this.l;
    let e = this.L;
    const h = this.R,
      g = this.T || 1;
    let f = this.K;
    const k = this.j,
      l = this.A;
    let n = this.J;
    for (let p = 0; p < c; p++, f++) {
      f >= h &&
        0 === n &&
        ((n = this.g.csoundPerformKsmps(this.m)),
        (f = 0),
        0 !== n && ((this.C = this.B = !1), this.h.o("realtimePerformanceEnded")));
      (d && 0 !== d.length) ||
        (d = this.l =
          new Float64Array(this.D.i.memory.buffer, this.g.csoundGetSpout(this.m), h * k));
      (e && 0 !== e.length) ||
        (e = this.L =
          new Float64Array(this.D.i.memory.buffer, this.g.csoundGetSpin(this.m), h * l));
      var u = Math.min(this.A, a.length);
      for (var r = 0; r < u; r++) e[f * l + r] = a[r][p] * g;
      if (this.j === b.length)
        for (const [J, R] of b.entries()) R[p] = 0 === n ? d[f * k + J] / g : 0;
      else if (2 === this.j && 1 === b.length)
        b[0][p] = 0 === n ? 0.5 * (d[f * k] / g + d[f * k + 1] / g) : 0;
      else if (1 === this.j && 2 === b.length)
        if (((u = b[0]), (r = b[1]), 0 === n)) {
          const J = d[f * k] / g;
          u[p] = J;
          r[p] = J;
        } else ((u[p] = 0), (r[p] = 0));
    }
    this.K = f;
    this.J = n;
    return !0;
  }
  async isRequestingInput() {
    return (this.g.csoundGetInputName(this.m) || "").includes("adc");
  }
  async isRequestingRealtimeOutput() {
    return (this.g.csoundGetOutputName(this.m) || "").includes("dac");
  }
  async start() {
    let a = -1;
    if (this.C) T()();
    else {
      T()();
      const b = this.m,
        c = this.g.csoundGetKsmps(b);
      this.K = this.R = c;
      this.j = this.g.csoundGetNchnls(b);
      this.A = this.g.csoundGetNchnlsInput(b);
      this.T = this.g.csoundGet0dBFS(b);
      a = this.g.csoundStart(b);
      if (0 !== a) return a;
      if (await this.isRequestingRealtimeOutput())
        ((this.l = new Float64Array(this.D.i.memory.buffer, this.g.csoundGetSpout(b), c * this.j)),
          (this.L = new Float64Array(this.D.i.memory.buffer, this.g.csoundGetSpin(b), c * this.A)),
          T()(),
          (this.M = this.C = !0));
      else
        return (
          this.h.o("renderStarted"),
          (this.u = !0),
          xc(this, { m: b })
            .then(() => {
              this.h.o("renderEnded");
              this.u = !1;
            })
            .catch(() => {
              this.h.o("renderEnded");
              this.u = !1;
            }),
          0
        );
    }
    this.B = !0;
    return a;
  }
}
registerProcessor("csound-singlethread-worklet-processor", yc);
//# sourceURL=/dist/__compiled.worklet.singlethread.worker.js
//# sourceMappingURL=/dist/__compiled.worklet.singlethread.worker.js.map
