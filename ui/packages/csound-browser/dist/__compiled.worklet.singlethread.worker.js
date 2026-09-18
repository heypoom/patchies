let self = AudioWorkletGlobalScope;
/*

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/
var n,
  v = this || self;
function w(a, b) {
  a = a.split(".");
  var c = v;
  a[0] in c || typeof c.execScript == "undefined" || c.execScript("var " + a[0]);
  for (var d; a.length && (d = a.shift()); )
    a.length || b === void 0
      ? c[d] && c[d] !== Object.prototype[d]
        ? (c = c[d])
        : (c = c[d] = {})
      : (c[d] = b);
}
function z(a, b) {
  A.prototype[a] = b;
}
const aa = Symbol("Comlink.proxy"),
  ba = Symbol("Comlink.endpoint"),
  da = Symbol("Comlink.releaseProxy"),
  fa = Symbol("Comlink.thrown"),
  ha = (a) => ("object" == typeof a && null !== a) || "function" == typeof a,
  ka = new Map([
    [
      "proxy",
      {
        oa: (a) => ha(a) && a[aa],
        va(a) {
          const { port1: b, port2: c } = new MessageChannel();
          return (ia(a, b), [c, [c]]);
        },
        pa: (a) => (a.start(), ja(a)),
      },
    ],
    [
      "throw",
      {
        oa: (a) => ha(a) && fa in a,
        va({ value: a }) {
          let b;
          return (
            (b =
              a instanceof Error
                ? { ra: !0, value: { message: a.message, name: a.name, stack: a.stack } }
                : { ra: !1, value: a }),
            [b, []]
          );
        },
        pa(a) {
          if (a.ra) throw Object.assign(Error(a.value.message), a.value);
          throw a.value;
        },
      },
    ],
  ]);
function ia(a, b = self) {
  b.addEventListener("message", function e(d) {
    if (d && d.data) {
      var h = d.data.argumentList,
        { id: f, type: k, path: g } = Object.assign({ path: [] }, d.data);
      h = (h || []).map(G);
      try {
        const m = g.slice(0, -1).reduce((q, x) => q[x], a),
          r = g.reduce((q, x) => q[x], a);
        switch (k) {
          case "GET":
            var l = r;
            break;
          case "SET":
            m[g.slice(-1)[0]] = G(d.data.value);
            l = !0;
            break;
          case "APPLY":
            l = r.apply(m, h);
            break;
          case "CONSTRUCT":
            l = la(new r(...h));
            break;
          case "ENDPOINT":
            const { port1: q, port2: x } = new MessageChannel();
            ia(a, x);
            l = ma(q, [q]);
            break;
          case "RELEASE":
            l = void 0;
            break;
          default:
            return;
        }
      } catch (m) {
        l = { value: m, [fa]: 0 };
      }
      Promise.resolve(l)
        .catch((m) => ({ value: m, [fa]: 0 }))
        .then((m) => {
          const [r, q] = na(m);
          b.postMessage({ ...r, id: f }, q);
          "RELEASE" === k && (b.removeEventListener("message", e), oa(b));
        });
    }
  });
  b.start && b.start();
}
function oa(a) {
  "MessagePort" === a.constructor.name && a.close();
}
function ja(a) {
  return (function h(c, d = [], e = function () {}) {
    let f = !1;
    const k = new Proxy(e, {
      get(g, l) {
        if ((qa(f), l === da))
          return () =>
            ra(c, { type: "RELEASE", path: d.map((m) => m.toString()) }).then(() => {
              oa(c);
              f = !0;
            });
        if ("then" === l) {
          if (0 === d.length) return { then: () => k };
          g = ra(c, { type: "GET", path: d.map((m) => m.toString()) }).then(G);
          return g.then.bind(g);
        }
        return h(c, [...d, l]);
      },
      set(g, l, m) {
        qa(f);
        const [r, q] = na(m);
        return ra(c, { type: "SET", path: [...d, l].map((x) => x.toString()), value: r }, q).then(
          G,
        );
      },
      apply(g, l, m) {
        qa(f);
        g = d[d.length - 1];
        if (g === ba) return ra(c, { type: "ENDPOINT" }).then(G);
        if ("bind" === g) return h(c, d.slice(0, -1));
        const [r, q] = ta(m);
        m = { type: "APPLY" };
        m.path = d.map((x) => x.toString());
        m.argumentList = r;
        return ra(c, m, q).then(G);
      },
      construct(g, l) {
        qa(f);
        const [m, r] = ta(l);
        g = { type: "CONSTRUCT" };
        g.path = d.map((q) => q.toString());
        g.argumentList = m;
        return ra(c, g, r).then(G);
      },
    });
    return k;
  })(a, [], void 0);
}
function qa(a) {
  if (a) throw Error("Proxy has been released and is not useable");
}
function ta(a) {
  var b;
  a = a.map(na);
  const c = ((b = a.map((d) => d[1])), Array.prototype.concat.apply([], b));
  return [a.map((d) => d[0]), c];
}
const ua = new WeakMap();
function ma(a, b) {
  return (ua.set(a, b), a);
}
function la(a) {
  return Object.assign(a, { [aa]: !0 });
}
function na(a) {
  for (const [b, c] of ka)
    if (c.oa(a)) {
      const [d, e] = c.va(a);
      return [{ type: "HANDLER", name: b, value: d }, e];
    }
  return [{ type: "RAW", value: a }, ua.get(a) || []];
}
function G(a) {
  switch (a.type) {
    case "HANDLER":
      return ka.get(a.name).pa(a.value);
    case "RAW":
      return a.value;
  }
}
function ra(a, b, c) {
  return new Promise((d) => {
    const e = Array(4)
      .fill(0)
      .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
      .join("-");
    a.addEventListener("message", function k(f) {
      f.data && f.data.id && f.data.id === e && (a.removeEventListener("message", k), d(f.data));
    });
    a.start && a.start();
    b.id = e;
    a.postMessage(b, c);
  });
}
function va() {}
n = va.prototype;
n.ready = !1;
n.port = void 0;
n.ia = () => {};
n.v = () => {};
n.L = void 0;
const wa = (a) => () => a.exports.csoundCreateWasi();
wa.toString = () => "create = async () => undefined;";
const xa = (a) => (b) => a.exports.csoundDestroy(b);
xa.toString = () => "destroy = async () => undefined;";
const Ba = (a) => () => a.exports.csoundGetAPIVersion();
Ba.toString = () => "getAPIVersion = async () => Number;";
const Ca = (a) => () => a.exports.csoundGetVersion();
Ca.toString = () => "getVersion = async () => Number;";
const Da = (a) => (b, c) => a.exports.csoundInitialize(c);
Da.toString = () => "initialize = async () => Number;";
function Ea() {
  return this;
}
Ea.prototype.encode = function (a) {
  if (typeof a !== "string")
    throw new TypeError("passed argument must be of type string " + a + " " + typeof a);
  a = unescape(encodeURIComponent(a));
  const b = new Uint8Array(a.length);
  [...a].forEach(function (c, d) {
    b[d] = c.codePointAt(0);
  });
  return b;
};
const H = new (function () {
    this.g = (a) => {
      const b = a.indexOf("\x00");
      return b !== -1 ? a.slice(0, Math.max(0, b)) : a;
    };
    this.decode = function (a, b) {
      if (a === void 0) return "";
      if (typeof (b !== void 0 && "stream" in b ? b.stream : !1) !== "boolean")
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
  Fa = new Ea();
const K = (a, b) => {
    a.exports.freeStringMem(b);
  },
  L = (a, b) => {
    a = a.h.memory.buffer;
    const c = new Uint8Array(a, b);
    let d = 0;
    for (; c[d] !== 0; ) d++;
    if (d === 0) return "";
    b = new Uint8Array(a, b, d);
    return H.decode(b);
  },
  N = (a, b) => {
    if (typeof b !== "string") console.error("Expected string but got", typeof b);
    else {
      b = Fa.encode(b);
      var c = a.exports.allocStringMem(b.length);
      new Uint8Array(a.h.memory.buffer, c, b.length + 1).set(b);
      return c;
    }
  };
const Ga = (a) => (b, c) => {
  c = N(a, c);
  b = a.exports.csoundParseOrc(b, c);
  K(a, c);
  return b;
};
Ga.toString = () => "parseOrc = async (orchestra) => Object;";
const Ha = (a) => (b, c) => a.exports.csoundCompileTree(b, c);
Ha.toString = () => "compileTree = async (tree) => Number;";
const Ia = (a) => (b, c) => {
  c = N(a, c);
  b = a.exports.csoundCompileOrc(b, c);
  K(a, c);
  return b;
};
Ia.toString = () => "compileOrc = async (orchestra) => Number;";
const Ja = (a) => (b, c) => {
  c = N(a, c);
  b = a.exports.csoundEvalCode(b, c);
  K(a, c);
  return b;
};
Ja.toString = () => "csoundEvalCode = async (orchestra) => Number;";
const Ka = (a) => (b) => a.exports.csoundStartWasi(b);
Ka.toString = () => "start = async () => Number;";
const La =
  (a) =>
  (b, c, d = 1) => {
    c = N(a, c);
    b = a.exports.csoundCompileCSD(b, c, d, 0);
    K(a, c);
    return b;
  };
La.toString = () => "compileCSD = async (csoundDocument) => Number;";
const Ma = (a) => (b) => a.exports.csoundPerformKsmps(b);
Ma.toString = () => "performKsmps = async (csound) => Number;";
const Na = (a) => (b) => a.exports.csoundSetDebugCallbackWasi(b);
Na.toString = () => "setDebugCallbackWasi = async (csound) => Number;";
const Oa = () => {},
  Pa = () => Oa;
Pa.toString = () => "stop = async () => undefined;";
const Qa = (a) => (b) => a.exports.csoundResetWasi(b);
Qa.toString = () => "reset = async () => Number;";
const Ta = [
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
  ],
  Ua = [
    ["device_name", "char", 64],
    ["interface_name", "char", 64],
    ["device_id", "char", 64],
    ["midi_module", "char", 64],
    ["isOutput", "int"],
  ],
  Va = [
    ["type", "int"],
    ["lexme", "ptr"],
    ["value", "int"],
    ["fvalue", "double"],
    ["optype", "ptr"],
    ["next", "ptr"],
  ],
  Wa = [
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
const Xa = { Ob: 4, Zb: 8, wb: 8, char: 1, Lb: 8, Xb: 4, $b: 8 },
  Ya = (a) =>
    a ? a.reduce((b, [, c]) => (Xa[c] ? Xa[c] + b : Ya({ yb: Wa, xb: Va }[c]) + b), 0) : 0;
Ya(Wa);
Ya(Va);
Ya(Ta);
const Za = Ya(Ua);
const $a = (a) => {
  const b = a.indexOf("\x00");
  return b !== -1 ? a.substr(0, b) : a;
};
const ab = (a, b) => {
  [a] = a.reduce(
    ([c, d], [e, h, ...f]) => {
      f = h === "char" ? Xa[h] * f[0] : Xa[h];
      h = h === "char" ? $a(H.decode(b.subarray(d, f))) || "" : b[d];
      c[e] = h;
      return [c, d + f];
    },
    [{}, 0],
  );
  return a;
};
const bb = (a) => (b) => a.exports.csoundGetSr(b);
bb.toString = () => "getSr = async () => Number;";
const db = (a) => (b, c) => a.exports.csoundSystemSr(b, c);
db.toString = () => "systemSr = async (val) => Number;";
const eb = (a) => (b) => a.exports.csoundGetKr(b);
eb.toString = () => "getKr = async () => Number;";
const fb = (a) => (b) => a.exports.csoundGetKsmps(b);
fb.toString = () => "getKsmps = async () => Number;";
fb.toString = () => "getChannels = async (isInput) => Number;";
const gb = (a) => (b) => a.exports.csoundGetChannels(b, 0);
gb.toString = () => "getNchnls = async () => Number;";
const hb = (a) => (b) => a.exports.csoundGetChannels(b, 1);
hb.toString = () => "getNchnlsInput = async () => Number;";
const ib = (a) => (b) => a.exports.csoundGet0dBFS(b);
ib.toString = () => "get0dBFS = async () => Number;";
const jb = (a) => (b) => a.exports.csoundGetA4(b);
jb.toString = () => "getA4 = async () => Number;";
const kb = (a) => (b) => a.exports.csoundGetCurrentTimeSamples(b);
kb.toString = () => "getCurrentTimeSamples = async () => Number;";
const lb = (a) => (b) => a.exports.csoundGetSizeOfMYFLT(b);
lb.toString = () => "getSizeOfMYFLT = async () => Number;";
const mb = (a) => (b, c) => {
  c = N(a, c);
  b = a.exports.csoundSetOption(b, c);
  K(a, c);
  return b;
};
mb.toString = () => "setOption = async (option) => Number;";
const nb = (a) => (b, c) => {
  a.exports.csoundSetParams(b, c);
};
nb.toString = () => "setParams = async (csoundParams) => undefined;";
const ob = (a) => (b) => {
  var c = a.h.memory.buffer;
  const d = Ya(Ta),
    e = a.exports.allocCsoundParamsStruct();
  c = new Uint8Array(c, e, d);
  a.exports.csoundGetParams(b, e);
  b = ab(Ta, c);
  a.exports.freeCsoundParams(e);
  return b;
};
ob.toString = () => "getParams = async () => CSOUND_PARAMS;";
const pb = (a) => (b) => a.exports.csoundGetDebug(b);
pb.toString = () => "getDebug = async () => Number;";
const qb = (a) => (b, c) => {
  a.exports.csoundSetDebug(b, c);
};
qb.toString = () => "setDebug = async (number) => undefined;";
const rb = (a) => (b) => a.exports.csoundGetSpin(b);
rb.toString = () => "getSpin = async (csound) => Number;";
const sb = (a) => (b) => a.exports.csoundGetSpout(b);
sb.toString = () => "getSpout = async () => Number;";
const tb = (a) => (b) => a.exports.isRequestingRtAudioInput(b);
const ub = (a) => {
  const b = [];
  for (let c = 0; c < a; c++) b.push(c);
  return b;
};
const vb = (a) => (b, c) => {
  const d = a.h.memory.buffer,
    e = a.exports.csoundGetMIDIDevList(b, void 0, c ? 1 : 0);
  if (e === 0) return [];
  const h = a.exports.allocCsMidiDeviceStruct(e);
  a.exports.csoundGetMIDIDevList(b, h, c ? 1 : 0);
  const f = new Uint8Array(d, h, Za * e);
  b = ub(e).map((k) => ab(Ua, f.subarray(k * Za, Za)));
  a.exports.freeCsMidiDeviceStruct(h);
  return b;
};
vb.toString = () => "getMIDIDevList = async (isOutput) => Object;";
const wb = (a) => (b) => {
  var c = a.h.memory.buffer;
  b = a.exports.getRtMidiName(b);
  c = new Uint8Array(c, b, 128);
  return $a(H.decode(c)) || "";
};
wb.toString = () => "getRtMidiName = async () => String;";
const xb = (a) => (b) => a.exports.isRequestingRtMidiInput(b),
  yb = (a) => (b, c, d, e) => {
    a.exports.pushMidiMessage(b, c, d, e);
  };
yb.toString = () => "midiMessage = async (status, data1, data2) => undefined;";
const zb = (a) => (b) => a.exports.isRequestingPlugins(b);
zb.toString = () => "isRequestingPlugins = async () => Number;";
const Ab = (a) => (b) => ((b = a.exports.getRequestedPlugins(b)) ? L(a, b) : "");
Ab.toString = () => "getRequestedPlugins = async () => String;";
const Bb = (a) => (b, c) => {
  c = N(a, c);
  b = a.exports.csoundEventString(b, c, 0);
  K(a, c);
  return b;
};
Bb.toString = () => "inputMessage = async (scoreEvent) => Number;";
const Cb = (a) => (b, c) => {
  c = N(a, c);
  b = a.exports.csoundEventString(b, c, 1);
  K(a, c);
  return b;
};
Cb.toString = () => "inputMessageAsync = async (scoreEvent) => Number;";
const Db = (a) => (b, c) => {
  c = N(a, c);
  b = a.exports.csoundReadlinePushText(b, c);
  K(a, c);
  return b;
};
Db.toString = () => "readlinePushText = async (text) => Number;";
const Eb = (a) => (b, c) => {
  c = N(a, c);
  b = a.exports.csoundGetControlChannelWasi(b, c);
  K(a, c);
  return b;
};
Eb.toString = () => "getControlChannel = async (channelName) => Number;";
const Fb = (a) => (b, c, d) => {
  c = N(a, c);
  a.exports.csoundSetControlChannel(b, c, d);
  K(a, c);
};
Fb.toString = () => "setControlChannel = async (channelName, value) => void;";
const Gb = (a) => (b, c) => {
  c = N(a, c);
  b = a.exports.csoundGetStringChannelWasi(b, c);
  const d = L(a, b);
  K(a, c);
  K(a, b);
  return d;
};
Gb.toString = () => "getStringChannel = async (channelName) => String;";
const Hb = (a) => (b, c, d) => {
  c = N(a, c);
  d = N(a, d);
  a.exports.csoundSetStringChannel(b, c, d);
  K(a, c);
  K(a, d);
};
Hb.toString = () => "setStringChannel = async (channelName, value) => void;";
const Ib = (a) => (b) => {
  var c = a.h.memory.buffer;
  b = a.exports.csoundGetOutputName(b);
  c = new Uint8Array(c, b, 64);
  return $a(H.decode(c)) || "";
};
Ib.toString = () => "getOutputName = async () => String;";
const Jb = (a) => (b) => {
  var c = a.h.memory.buffer;
  b = a.exports.csoundGetInputName(b);
  c = new Uint8Array(c, b, 64);
  return $a(H.decode(c)) || "";
};
Jb.toString = () => "getInputName = async (csound) => String;";
const Kb = (a) => (b, c, d) => {
  c = N(a, c);
  d = N(a, d);
  b = a.exports.csoundAppendEnv(b, c, d);
  K(a, c);
  K(a, d);
  return b;
};
Kb.toString = () => "appendEnv = async (csound, variable, value) => Number;";
const Lb = (a) => (b) => a.exports.csoundIsScorePending(b);
Lb.toString = () => "isScorePending = async () => Number;";
const Mb = (a) => (b, c) => a.exports.csoundSetScorePending(b, c);
Mb.toString = () => "setScorePending = async (pending) => Number;";
const Nb = (a) => (b, c) => {
  c = N(a, c);
  b = a.exports.csoundEventString(b, c, 0);
  K(a, c);
  return b;
};
Nb.toString = () => "readScore = async (score) => Number;";
const Ob = (a) => (b) => a.exports.csoundGetScoreTime(b);
Ob.toString = () => "getScoreTime = async () => Number;";
const Pb = (a) => (b) => a.exports.csoundGetScoreOffsetSeconds(b);
Pb.toString = () => "getScoreOffsetSeconds = async () => Number;";
const Qb = (a) => (b, c) => a.exports.csoundSetScoreOffsetSeconds(b, c);
Qb.toString = () => "setScoreOffsetSeconds = async () => Number;";
const Rb = (a) => (b) => a.exports.csoundRewindScore(b);
Rb.toString = () => "rewindScore = async () => undefined;";
const Sb = (a) => (b, c) => a.exports.csoundTableLength(b, c);
Sb.toString = () => "tableLength = async (tableNum) => Number;";
const Tb = (a) => (b, c, d) => {
  const e = a.exports.allocFloatArray(d.length);
  new Float64Array(a.h.memory.buffer, e, d.length).set(d);
  a.exports.csoundTableCopyIn(b, c, e);
  a.exports.freeFloatArrayMem(e);
};
Tb.toString = () => "tableCopyIn = async (tableNum, float64Array) => undefined;";
const Ub = (a) => (b, c) => {
  var d = a.exports.csoundTableLength(b, c);
  if (d > 0) {
    const e = a.exports.allocFloatArray(d);
    a.exports.csoundTableCopyOut(b, c, e);
    b = new Float64Array(a.h.memory.buffer, e, d);
    c = new Float64Array(b.length);
    for (d = 0; d < b.length; d++) c[d] = b[d];
    a.exports.freeFloatArrayMem(e);
    return c;
  }
};
Ub.toString = () => "tableCopyOut = async (tableNum) => ?Float64Array;";
Ub.toString = Ub.toString;
const Vb = (a) => (b, c) => {
  const d = a.exports.allocFloatArray(1024);
  a.exports.csoundGetTableArgs(b, d, c);
  b = new Float64Array(a.h.memory.buffer, d, 1024);
  a.exports.freeFloatArrayMem(d);
  return b;
};
Vb.toString = () => "getTableArgs = async (tableNum) => ?Float64Array;";
function Wb(a) {
  return (b, c, d) => {
    b = typeof d === "string" ? Fa.encode(d) : d;
    a.h.writeFile(c, b);
  };
}
w("writeFile$$module$src$filesystem$worker_fs", Wb);
Wb.toString = () => "async (path, data) => void";
function Xb(a) {
  return (b, c, d) => {
    b = typeof d === "string" ? Fa.encode(d) : d;
    a.h.appendFile(c, b);
  };
}
w("appendFile$$module$src$filesystem$worker_fs", Xb);
Xb.toString = () => "async (path, data) => void";
function Yb(a) {
  return (b, c) => a.h.readFile(c);
}
w("readFile$$module$src$filesystem$worker_fs", Yb);
Yb.toString = () => "async (path) => ?Uint8Array";
function Zb(a) {
  return (b, c) => a.h.unlink(c);
}
w("unlink$$module$src$filesystem$worker_fs", Zb);
Zb.toString = () => "async (path) => void";
function $b(a) {
  return (b, c) => a.h.readdir(c);
}
w("readdir$$module$src$filesystem$worker_fs", $b);
$b.toString = () => "async (path) => string[]";
function ac(a) {
  return (b, c) => a.h.mkdir(c);
}
w("mkdir$$module$src$filesystem$worker_fs", ac);
ac.toString = () => "async (path) => void";
function bc(a) {
  return (b, c) => a.h.stat(c);
}
w("stat$$module$src$filesystem$worker_fs", bc);
bc.toString = () => "async (path) => ?object";
function cc(a) {
  return (b, c) => {
    b = a.h;
    c = O(b.cwd, c);
    return !!dc(b, c);
  };
}
w("pathExists$$module$src$filesystem$worker_fs", cc);
cc.toString = () => "async (path) => boolean";
function ec(a) {
  return (b, c) => fc(a.h, c);
}
w("chdir$$module$src$filesystem$worker_fs", ec);
ec.toString = () => "async (path) => number";
function hc(a) {
  return () => a.h.cwd;
}
w("getcwd$$module$src$filesystem$worker_fs", hc);
hc.toString = () => "async () => string";
const T = {};
T.writeFile = Wb;
T.appendFile = Xb;
T.readFile = Yb;
T.unlink = Zb;
T.readdir = $b;
T.mkdir = ac;
T.stat = bc;
T.pathExists = cc;
T.chdir = ec;
T.getcwd = hc;
const ic = {
  csoundCreate: wa,
  csoundDestroy: xa,
  csoundGetAPIVersion: Ba,
  csoundGetVersion: Ca,
  csoundInitialize: Da,
  csoundParseOrc: Ga,
  csoundCompileTree: Ha,
  csoundCompileOrc: Ia,
  csoundEvalCode: Ja,
  csoundStart: Ka,
  csoundCompileCSD: La,
  csoundPerformKsmps: Ma,
  Fb: Na,
  csoundStop: Pa,
  csoundReset: Qa,
  csoundGetSr: bb,
  Gb: db,
  csoundGetKr: eb,
  csoundGetKsmps: fb,
  csoundGetNchnls: gb,
  csoundGetNchnlsInput: hb,
  Eb: (a) => (b, c) => a.exports.csoundGetChannels(b, c),
  csoundGet0dBFS: ib,
  csoundGetA4: jb,
  csoundGetCurrentTimeSamples: kb,
  csoundGetSizeOfMYFLT: lb,
  csoundSetOption: mb,
  csoundSetParams: nb,
  csoundGetParams: ob,
  csoundGetDebug: pb,
  csoundSetDebug: qb,
  csoundGetSpin: rb,
  csoundGetSpout: sb,
  isRequestingRtAudioInput: tb,
  _isRequestingRtAudioInput: tb,
  csoundGetMIDIDevList: vb,
  csoundSetMidiCallbacks: (a) => (b) => {
    a.exports.csoundSetMidiCallbacks(b);
  },
  csoundGetRtMidiName: wb,
  csoundGetMidiOutFileName: (a) => (b) => {
    var c = a.h.memory.buffer;
    b = a.exports.getMidiOutFileName(b);
    c = new Uint8Array(c, b, 128);
    b && b.length > 0 && K(a, b);
    return $a(H.decode(c)) || "";
  },
  csoundPushMidiMessage: yb,
  isRequestingRtMidiInput: xb,
  _isRequestingRtMidiInput: xb,
  isRequestingPlugins: zb,
  getRequestedPlugins: Ab,
  csoundInputMessage: Bb,
  csoundInputMessageAsync: Cb,
  csoundReadlinePushText: Db,
  csoundGetControlChannel: Eb,
  csoundSetControlChannel: Fb,
  csoundGetStringChannel: Gb,
  csoundSetStringChannel: Hb,
  csoundGetInputName: Jb,
  csoundGetOutputName: Ib,
  csoundAppendEnv: Kb,
  csoundShouldDaemonize: (a) => (b) => a.exports.csoundShouldDaemonize(b),
  csoundIsScorePending: Lb,
  csoundSetScorePending: Mb,
  csoundReadScore: Nb,
  csoundGetScoreTime: Ob,
  csoundGetScoreOffsetSeconds: Pb,
  csoundSetScoreOffsetSeconds: Qb,
  csoundRewindScore: Rb,
  csoundTableLength: Sb,
  csoundTableCopyIn: Tb,
  csoundTableCopyOut: Ub,
  csoundGetTable: Ub,
  csoundGetTableArgs: Vb,
  UGEN_ARG_TYPE: { I: 0, K: 1, A: 2, S: 3, F: 4, UNKNOWN: 5 },
  csoundUgenFactoryNew: (a) => (b) => a.exports.csoundUgenFactoryNew(b),
  csoundUgenFactoryDelete: (a) => (b) => a.exports.csoundUgenFactoryDelete(b),
  csoundUgenContextNew: (a) => (b) => a.exports.csoundUgenContextNew(b),
  csoundUgenContextDelete: (a) => (b) => a.exports.csoundUgenContextDelete(b),
  csoundUgenSetContext: (a) => (b, c) => a.exports.csoundUgenSetContext(b, c),
  csoundUgenNew: (a) => (b, c, d, e) => {
    c = N(a, c);
    d = N(a, d);
    e = N(a, e);
    b = a.exports.csoundUgenNew(b, c, d, e);
    K(a, c);
    K(a, d);
    K(a, e);
    return b;
  },
  csoundUgenDelete: (a) => (b) => a.exports.csoundUgenDelete(b),
  csoundUgenGetOutVar: (a) => (b, c) => a.exports.csoundUgenGetOutVar(b, c),
  csoundUgenGetInVar: (a) => (b, c) => a.exports.csoundUgenGetInVar(b, c),
  csoundUgenSetInputVar: (a) => (b, c, d) => a.exports.csoundUgenSetInputVar(b, c, d),
  csoundUgenVarNew: (a) => (b, c) => a.exports.csoundUgenVarNew(b, c),
  csoundUgenVarDelete: (a) => (b) => a.exports.csoundUgenVarDelete(b),
  csoundUgenVarGetType: (a) => (b) => a.exports.csoundUgenVarGetType(b),
  csoundUgenVarGetSize: (a) => (b) => a.exports.csoundUgenVarGetSize(b),
  csoundUgenVarSetValue: (a) => (b, c) => a.exports.csoundUgenVarSetValue(b, c),
  csoundUgenVarGetValue: (a) => (b) => a.exports.csoundUgenVarGetValue(b),
  csoundUgenVarGetData: (a) => (b) => a.exports.csoundUgenVarGetData(b),
  csoundUgenVarGetDataAsFloat64Array: (a) => (b) => a.exports.csoundUgenVarGetDataAsFloat64Array(b),
  csoundUgenVarGetKsmps: (a) => (b) => a.exports.csoundUgenVarGetKsmps(b),
  csoundUgenVarSetString: (a) => (b, c) => {
    c = N(a, c);
    b = a.exports.csoundUgenVarSetString(b, c);
    K(a, c);
    return b;
  },
  csoundUgenVarGetString: (a) => (b) => {
    b = a.exports.csoundUgenVarGetString(b);
    return b === 0 ? null : L(a, b);
  },
  csoundUgenSetValue: (a) => (b, c, d) => a.exports.csoundUgenSetValue(b, c, d),
  csoundUgenGetValue: (a) => (b, c) => a.exports.csoundUgenGetValue(b, c),
  csoundUgenSetString: (a) => (b, c, d) => {
    d = N(a, d);
    b = a.exports.csoundUgenSetString(b, c, d);
    K(a, d);
    return b;
  },
  csoundUgenGetString: (a) => (b, c) => {
    b = a.exports.csoundUgenGetString(b, c);
    return b === 0 ? null : L(a, b);
  },
  csoundUgenGetInCount: (a) => (b) => a.exports.csoundUgenGetInCount(b),
  csoundUgenGetOutCount: (a) => (b) => a.exports.csoundUgenGetOutCount(b),
  csoundUgenGetInType: (a) => (b, c) => a.exports.csoundUgenGetInType(b, c),
  csoundUgenGetOutType: (a) => (b, c) => a.exports.csoundUgenGetOutType(b, c),
  csoundUgenInit: (a) => (b) => a.exports.csoundUgenInit(b),
  csoundUgenPerform: (a) => (b) => a.exports.csoundUgenPerform(b),
  csoundUgenListOpcodes: (a) => (b) => {
    const c = a.exports.allocStringMem(4),
      d = a.exports.allocStringMem(4);
    if (a.exports.csoundUgenListOpcodes(b, c, d) !== 0)
      return (a.exports.freeStringMem(c), a.exports.freeStringMem(d), []);
    const e = new DataView(a.exports.memory.buffer),
      h = e.getInt32(c, !0),
      f = e.getInt32(d, !0),
      k = [];
    for (let l = 0; l < f; l++) {
      var g = h + l * 20;
      const m = e.getInt32(g, !0),
        r = e.getInt32(g + 4, !0);
      g = e.getInt32(g + 8, !0);
      k.push({ opname: m ? L(a, m) : "", outypes: r ? L(a, r) : "", intypes: g ? L(a, g) : "" });
    }
    a.exports.csoundUgenFreeOpcodeList(b, h);
    a.exports.freeStringMem(c);
    a.exports.freeStringMem(d);
    return k;
  },
  csoundUgenFindOpcode: (a) => (b, c, d, e) => {
    c = N(a, c);
    d = N(a, d);
    e = N(a, e);
    b = a.exports.csoundUgenFindOpcode(b, c, d, e);
    K(a, c);
    K(a, d);
    K(a, e);
    return b;
  },
  csoundUgenGraphNew: (a) => (b) => a.exports.csoundUgenGraphNew(b),
  csoundUgenGraphAdd: (a) => (b, c) => a.exports.csoundUgenGraphAdd(b, c),
  csoundUgenGraphInit: (a) => (b) => a.exports.csoundUgenGraphInit(b),
  csoundUgenGraphPerform: (a) => (b) => a.exports.csoundUgenGraphPerform(b),
  csoundUgenGraphDelete: (a) => (b) => a.exports.csoundUgenGraphDelete(b),
  csoundUgenGraphDeleteAll: (a) => (b) => a.exports.csoundUgenGraphDeleteAll(b),
  csoundUgenVarGetFloat64Array: (a) => (b) => {
    const c = a.exports.csoundUgenVarGetDataAsFloat64Array(b);
    b = a.exports.csoundUgenVarGetKsmps(b);
    return c === 0 || b === 0
      ? new Float64Array(0)
      : new Float64Array(a.exports.memory.buffer, c, b);
  },
  fs: T,
};
function jc(a) {
  const { fs: b, UGEN_ARG_TYPE: c, ...d } = ic;
  return {
    ...Object.keys(d).reduce((e, h) => {
      e[h] = d[h](a);
      return e;
    }, {}),
    ...Object.keys(b).reduce((e, h) => {
      e[h] = b[h](a);
      return e;
    }, {}),
    UGEN_ARG_TYPE: c,
  };
}
const kc = new WeakMap(),
  U = (a, b) => {
    let c = kc.get(a);
    c || ((c = new WeakMap()), kc.set(a, c));
    let d = c.get(b);
    if (d === void 0 || a.get(d) !== b) ((d = a.length), a.grow(1), a.set(d, b), c.set(b, d));
    return d;
  },
  lc = (a, b, c, d, e = c, h) => {
    var f = a && a.exports ? a.exports : {};
    if (b.exports.csoundModuleInit)
      if (typeof f.csoundWasiLoadPlugin !== "function")
        (typeof b.exports.csoundModuleCreate === "function" && b.exports.csoundModuleCreate(d),
          b.exports.csoundModuleInit(d));
      else {
        var k = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0),
          g = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0),
          l = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0),
          m = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0);
        typeof b.exports.csoundModuleCreate === "function" &&
          (k.value = U(c, b.exports.csoundModuleCreate));
        typeof b.exports.csoundModuleInit === "function" &&
          (g.value = U(c, b.exports.csoundModuleInit));
        typeof b.exports.csoundModuleDestroy === "function" &&
          (l.value = U(c, b.exports.csoundModuleDestroy));
        typeof b.exports.csoundModuleErrorCodeToString === "function" &&
          (m.value = U(c, b.exports.csoundModuleErrorCodeToString));
        f.csoundWasiLoadPlugin(d, k, g, l, m);
      }
    else if (b.exports.csound_opcode_init || b.exports.csound_fgen_init)
      if (typeof f.csoundWasiLoadOpcodeLibrary !== "function") {
        a = f.csoundAppendOpcodes;
        var r = f.allocStringMem;
        const u = f.freeStringMem;
        h = h || f.memory;
        f = [];
        typeof a !== "function" && f.push("csoundAppendOpcodes");
        typeof r !== "function" && f.push("allocStringMem");
        typeof u !== "function" && f.push("freeStringMem");
        h || f.push("memory");
        if (typeof b.exports.csound_opcode_init === "function" && f.length === 0) {
          f = r(4);
          try {
            var q = b.exports.csound_opcode_init(d, f),
              x = Number(q);
            k = new DataView(h.buffer).getUint32(f, !0);
            g = Math.floor(x / 40);
            if (g > 0 && k !== 0) {
              l = r(g * 40);
              m = new DataView(h.buffer);
              q = (C) => {
                if (!C) return 0;
                const B = e.get(C);
                return B
                  ? U(c, B)
                  : (console.error(`Missing plugin function at table index ${C}`), 0);
              };
              try {
                for (x = 0; x < g; x += 1) {
                  r = k + x * 40;
                  h = l + x * 40;
                  const C = m.getUint32(r, !0),
                    B = m.getUint32(r + 4, !0),
                    ca = m.getInt32(r + 8, !0),
                    P = m.getUint32(r + 12, !0),
                    X = m.getUint32(r + 16, !0),
                    F = m.getUint32(r + 20, !0),
                    sa = m.getUint32(r + 24, !0),
                    Ra = m.getUint32(r + 28, !0),
                    Sa = m.getUint32(r + 32, !0),
                    p = m.getInt32(r + 36, !0);
                  m.setUint32(h + 0, C, !0);
                  m.setUint32(h + 4, B, !0);
                  m.setInt32(h + 8, ca, !0);
                  m.setUint32(h + 12, P, !0);
                  m.setUint32(h + 16, X, !0);
                  m.setUint32(h + 20, q(F), !0);
                  m.setUint32(h + 24, q(sa), !0);
                  m.setUint32(h + 28, q(Ra), !0);
                  m.setUint32(h + 32, Sa, !0);
                  m.setInt32(h + 36, p, !0);
                }
                a(d, l, g);
              } finally {
                u(l);
              }
            } else console.error("Invalid opcode table returned by csound_opcode_init");
          } finally {
            u(f);
          }
        } else
          typeof b.exports.csound_opcode_init === "function" &&
            console.error(
              `Missing required host exports for opcode plugin loading: ${f.join(", ")}`,
            );
        typeof b.exports.csound_fgen_init === "function" &&
          console.warn(
            "csound_fgen_init plugins are not supported by the current WASM loader path.",
          );
      } else
        ((k = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0)),
          (g = new WebAssembly.Global({ value: "i32", mutable: !0 }, 0)),
          typeof b.exports.csound_opcode_init === "function" &&
            (k.value = U(c, b.exports.csound_opcode_init)),
          typeof b.exports.csound_fgen_init === "function" &&
            (g.value = U(c, b.exports.csound_fgen_init)),
          f.csoundWasiLoadOpcodeLibrary(d, g, k));
    else console.error("Plugin doesn't export nececcary functions to quality as csound plugin.");
  };
v !== void 0 && (v = {});
v.BigInt || (v.BigInt = BigInt === void 0 ? Number : BigInt);
const mc =
    v.BigInt(1) |
    v.BigInt(2) |
    v.BigInt(4) |
    v.BigInt(8) |
    v.BigInt(16) |
    v.BigInt(32) |
    v.BigInt(64) |
    v.BigInt(128) |
    v.BigInt(256) |
    v.BigInt(2097152) |
    v.BigInt(4194304) |
    v.BigInt(8388608) |
    v.BigInt(134217728),
  nc = v.BigInt(0);
function oc(a) {
  let b = arguments[0];
  for (let d = 1; d < arguments.length; d++) {
    const e = arguments[d];
    if (e.lastIndexOf("/", 0) == 0) b = e;
    else {
      var c;
      (c = b == "") || ((c = b.length - 1), (c = c >= 0 && b.indexOf("/", c) == c));
      c ? (b += e) : (b += "/" + e);
    }
  }
  return b;
}
function pc(a) {
  return a ? a.split("/").filter((b) => b.length > 0 && b !== ".") : [];
}
function qc(a) {
  if (!a) return "/";
  const b = [];
  pc(a).forEach((c) => {
    c === ".." ? b.length > 0 && b.pop() : b.push(c);
  });
  return b.length > 0 ? `/${b.join("/")}` : "/";
}
function O(a, b) {
  if (!b || b === ".") return qc(a || "/");
  if (/^\//.test(b)) return qc(b);
  a = pc(a || "/");
  b = b.split("/");
  const c = [...a];
  b.forEach((d) => {
    d && d !== "." && (d === ".." ? c.length > 0 && c.pop() : c.push(d));
  });
  return c.length > 0 ? `/${c.join("/")}` : "/";
}
function rc() {
  return typeof performance === "undefined" || typeof performance.now === "undefined"
    ? Date.now() - Date.now()
    : performance.now();
}
function sc(a) {
  var b = a.reduce((d, e) => d + e.length, 0);
  if (a.length !== 0) {
    b = new Uint8Array(b);
    var c = 0;
    for (const d of a) (b.set(d, c), (c += d.length));
    return b;
  }
}
function A() {
  ({ ta: a } = { ta: { "/": "/" } });
  var a;
  this.fd = Array.from({ length: 4 });
  this.fd[0] = { fd: 0, path: "/dev/stdin", seekPos: v.BigInt(0), buffers: [] };
  this.fd[1] = { fd: 1, path: "/dev/stdout", seekPos: v.BigInt(0), buffers: [] };
  this.fd[2] = { fd: 2, path: "/dev/stderr", seekPos: v.BigInt(0), buffers: [] };
  this.fd[3] = { fd: 3, path: "/", seekPos: v.BigInt(0), buffers: [], type: "dir" };
  this.getMemory = this.getMemory.bind(this);
  this.g = 0;
  this.cwd = "/";
  this.ta = a || {};
}
A.prototype.start = function (a) {
  this.g = rc();
  a = a.exports._initialize;
  if (typeof a !== "function")
    throw new TypeError("Browser WASI module does not export _initialize");
  a();
};
function tc(a, b) {
  const c = {};
  b = WebAssembly.Module.imports(b);
  for (const d of b)
    d.kind === "function" &&
      d.module.startsWith("wasi_") &&
      (typeof c[d.module] !== "object" && (c[d.module] = {}),
      (c[d.module][d.name] = a[d.name].bind(a)));
  return c;
}
A.prototype.getMemory = function () {
  (this.view && this.view.buffer && this.view.buffer.byteLength) ||
    (this.view = new DataView(this.memory.buffer));
  return this.view;
};
function uc(a, b) {
  b = qc(b);
  const c = [];
  a = Object.values(a.fd);
  for (const d of a) {
    let e;
    ((e = d) == null ? void 0 : e.path) === b && c.push(d);
  }
  return c;
}
function dc(a, b) {
  a = uc(a, b);
  return a.length > 0 ? a[a.length - 1] : null;
}
function fc(a, b) {
  b = qc(O(a.cwd, b));
  if (b === "/")
    return ((a.cwd = "/"), a.fd[3] && ((a.fd[3].path = "/"), (a.fd[3].type = "dir")), 0);
  const c = dc(a, b);
  if (!c) return 44;
  if (c.type && c.type !== "dir") return 54;
  a.cwd = b;
  a.fd[3] && ((a.fd[3].path = b), (a.fd[3].type = "dir"));
  return 0;
}
function vc(a) {
  const b = Math.trunc(a);
  return v.BigInt(b) * v.BigInt(1e6) + v.BigInt(Math.round((a - b) * 1e6));
}
function wc(a, b) {
  switch (b) {
    case 1:
      return Math.floor(rc());
    case 0:
      return vc(Date.now());
    case 2:
    case 3:
      return Math.floor(rc() - a.g);
    default:
      return 0;
  }
}
A.prototype.xa = function () {
  return 0;
};
z("args_get", A.prototype.xa);
A.prototype.ya = function () {
  return 0;
};
z("args_sizes_get", A.prototype.ya);
A.prototype.za = function () {
  return 0;
};
z("clock_res_get", A.prototype.za);
A.prototype.Aa = function (a, b, c) {
  this.getMemory().setBigUint64(c, v.BigInt(wc(this, a)), !0);
  return 0;
};
z("clock_time_get", A.prototype.Aa);
A.prototype.Ba = function () {
  return 0;
};
z("environ_get", A.prototype.Ba);
A.prototype.Ca = function () {
  return 0;
};
z("environ_sizes_get", A.prototype.Ca);
A.prototype.Da = function () {
  return 52;
};
z("fd_advise", A.prototype.Da);
A.prototype.Ea = function () {
  return 52;
};
z("fd_allocate", A.prototype.Ea);
A.prototype.Fa = function () {
  return 0;
};
z("fd_close", A.prototype.Fa);
A.prototype.Ga = function () {
  return 0;
};
z("fd_datasync", A.prototype.Ga);
A.prototype.Ha = function (a, b) {
  a = this.getMemory();
  a.setUint8(b + 4, 4);
  a.setUint16(b + 2, 0, !0);
  a.setUint16(b + 4, 0, !0);
  a.setBigUint64(b + 8, v.BigInt(mc), !0);
  a.setBigUint64(b + 8 + 8, v.BigInt(nc), !0);
  return 0;
};
z("fd_fdstat_get", A.prototype.Ha);
A.prototype.Ia = function () {
  return 52;
};
z("fd_fdstat_set_flags", A.prototype.Ia);
A.prototype.Ja = function () {
  return 0;
};
z("fd_fdstat_set_rights", A.prototype.Ja);
A.prototype.Ka = function (a, b) {
  let c = 0;
  this.fd[a] &&
    (c = this.fd[a].buffers.reduce(function (e, h) {
      return e + (h == null ? void 0 : h.byteLength) ? (h == null ? void 0 : h.byteLength) : 0;
    }, 0));
  const d = this.getMemory();
  d.setBigUint64(b, v.BigInt(a), !0);
  b += 8;
  d.setBigUint64(b, v.BigInt(a), !0);
  b += 8;
  d.setUint8(b, 4);
  b += 8;
  d.setBigUint64(b, v.BigInt(1), !0);
  b += 8;
  d.setBigUint64(b, v.BigInt(c), !0);
  b += 8;
  d.setBigUint64(b, vc(this.g), !0);
  b += 8;
  d.setBigUint64(b, vc(this.g), !0);
  d.setBigUint64(b + 8, vc(this.g), !0);
  return 0;
};
z("fd_filestat_get", A.prototype.Ka);
A.prototype.La = function () {
  return 0;
};
z("fd_filestat_set_size", A.prototype.La);
A.prototype.Ma = function () {
  return 0;
};
z("fd_filestat_set_times", A.prototype.Ma);
A.prototype.Na = function () {
  return 0;
};
z("fd_pread", A.prototype.Na);
A.prototype.Oa = function (a, b) {
  if (!this.fd[a] && !this.fd[a - 1]) return 8;
  var { path: c } = this.fd[a];
  a = this.getMemory();
  c = Fa.encode(c);
  new Uint8Array(a.buffer).set(c, b);
  return 0;
};
z("fd_prestat_dir_name", A.prototype.Oa);
A.prototype.Pa = function (a, b) {
  if (!this.fd[a]) return 8;
  var { path: c } = this.fd[a];
  a = this.getMemory();
  c = Fa.encode(c);
  a.setUint8(b, 0);
  a.setUint32(b + 4, c.byteLength, !0);
  return 0;
};
z("fd_prestat_get", A.prototype.Pa);
A.prototype.Qa = function (a, b, c, d, e) {
  console.log("fd_pwrite", a, b, c, d, e, arguments);
  return 0;
};
z("fd_pwrite", A.prototype.Qa);
A.prototype.Ra = function (a, b, c, d) {
  const e = this.getMemory();
  a = this.fd[a];
  if (!a || !Array.isArray(a.buffers)) return (e.setUint32(d, 0, !0), 8);
  const h = a.buffers;
  if (h.length === 0) return (e.setUint32(d, 0, !0), (a.seekPos = v.BigInt(0)), 0);
  var f = h.reduce((r, q) => r + q.length, 0);
  let k = Number(a.seekPos),
    g = 0,
    l = !1;
  if (k >= f) return ((b = e.getUint32(b, !0)), e.setUint8(b, 0), e.setUint32(d, 0, !0), 0);
  for (f = 0; f < c; f++) {
    var m = b + f * 8;
    const r = e.getUint32(m, !0);
    m = e.getUint32(m + 4, !0);
    l ||
      ((g += m),
      Array.from({ length: m }, (q, x) => x).reduce(
        (q, x) => {
          if (l) return q;
          const [u, C] = q;
          let B = (q = 0),
            ca = !1,
            P = 0,
            X;
          if (x === 0)
            for (; !ca; )
              ((X = h[q] ? h[q].byteLength : 0),
                P <= k && X + P > k ? ((ca = !0), (B = k - P)) : ((P += X), (q += 1)));
          else ((q = u), (B = C));
          h[q]
            ? (e.setUint8(r + x, h[q][B]),
              B + 1 >= h[q].byteLength ? ((q = u + 1), (B = 0)) : (B += 1))
            : (e.setUint8(r + x, 0), (k += x), (l = !0));
          return [q, B];
        },
        [0, 0],
      ),
      l || (k += m));
  }
  a.seekPos = v.BigInt(k);
  e.setUint32(d, g, !0);
  return 0;
};
z("fd_read", A.prototype.Ra);
A.prototype.Sa = function () {
  return 0;
};
z("fd_readdir", A.prototype.Sa);
A.prototype.Ta = function () {
  return 0;
};
z("fd_renumber", A.prototype.Ta);
A.prototype.Ua = function (a, b, c, d) {
  const e = this.getMemory();
  switch (c) {
    case 1:
      let h;
      this.fd[a].seekPos = ((h = this.fd[a].seekPos) != null ? h : v.BigInt(0)) + v.BigInt(b);
      break;
    case 2:
      c = (this.fd[a].buffers || []).reduce((f, k) => f + k.length, 0);
      this.fd[a].seekPos = BigInt(c) + BigInt(b);
      break;
    case 0:
      this.fd[a].seekPos = BigInt(b);
  }
  e.setBigUint64(d, this.fd[a].seekPos, !0);
  return 0;
};
z("fd_seek", A.prototype.Ua);
A.prototype.Va = function () {
  return 0;
};
z("fd_sync", A.prototype.Va);
A.prototype.Wa = function (a, b) {
  const c = this.getMemory();
  this.fd[a].seekPos || (this.fd[a].seekPos = v.BigInt(0));
  c.setBigUint64(b, this.fd[a].seekPos, !0);
  return 0;
};
z("fd_tell", A.prototype.Wa);
A.prototype.Xa = function (a, b, c, d) {
  let e = !1;
  const h = this.getMemory();
  this.fd[a].buffers = this.fd[a].buffers || [];
  this.fd[a].seekPos === v.BigInt(0) && this.fd[a].buffers.length > 0 && (e = !0);
  let f = 0;
  for (let l = 0; l < c; l++) {
    var k = b + l * 8,
      g = h.getUint32(k, !0);
    k = h.getUint32(k + 4, !0);
    f += k;
    g = new Uint8Array(h.buffer, g, k);
    e ? this.fd[a].buffers.unshift(g.slice(0, k)) : this.fd[a].buffers.push(g.slice(0, k));
  }
  this.fd[a].seekPos += v.BigInt(f);
  h.setUint32(d, f, !0);
  [1, 2].includes(a) && console.log(H.decode(sc(this.fd[a].buffers)));
  return 0;
};
z("fd_write", A.prototype.Xa);
A.prototype.Ya = function () {
  return 0;
};
z("path_create_directory", A.prototype.Ya);
A.prototype.Za = function () {
  return 0;
};
z("path_filestat_get", A.prototype.Za);
A.prototype.$a = function () {
  return 0;
};
z("path_filestat_set_times", A.prototype.$a);
A.prototype.ab = function () {
  return 0;
};
z("path_link", A.prototype.ab);
A.prototype.bb = function (a, b, c, d, e, h, f, k, g) {
  b = this.getMemory();
  h = (this.fd[a] || { path: this.cwd }).path;
  c = new Uint8Array(b.buffer, c, d);
  c = H.decode(c);
  let l;
  a === 3 ? (l = O(this.cwd, c)) : (l = qc(oc(h, c)));
  if (l.startsWith("/..") || l === "/._" || l === "/.AppleDouble") return 8;
  a = (e & 2) !== 0;
  d = (e & 1) !== 0;
  if ((c = dc(this, l)) && c.type === "dir" && !a) return 31;
  if (!c && a) return 44;
  if (!c && !d && !a) return (b.setUint32(g, 4294967295, !0), 44);
  d = c ? c.fd : this.fd.length;
  c || this.fd[d] !== void 0 || (this.fd[d] = { fd: d });
  c = c || this.fd[d] || { fd: d };
  this.fd[d] = {
    ...c,
    fd: d,
    path: l,
    type: a ? "dir" : c.type || "file",
    seekPos: v.BigInt(0),
    buffers: Array.isArray(c.buffers) ? c.buffers : [],
  };
  (e & 8) === 0 || a || (this.fd[d].buffers.length = 0);
  b.setUint32(g, d, !0);
  return 0;
};
z("path_open", A.prototype.bb);
A.prototype.cb = function () {
  return 0;
};
z("path_readlink", A.prototype.cb);
A.prototype.eb = function () {
  return 0;
};
z("path_remove_directory", A.prototype.eb);
A.prototype.fb = function () {
  return 0;
};
z("path_rename", A.prototype.fb);
A.prototype.gb = function () {
  return 0;
};
z("path_symlink", A.prototype.gb);
A.prototype.hb = function () {
  return 0;
};
z("path_unlink_file", A.prototype.hb);
A.prototype.jb = function () {
  return 0;
};
z("poll_oneoff", A.prototype.jb);
A.prototype.kb = function () {
  return 0;
};
z("proc_exit", A.prototype.kb);
A.prototype.lb = function () {
  return 0;
};
z("proc_raise", A.prototype.lb);
A.prototype.mb = function () {
  return 0;
};
z("random_get", A.prototype.mb);
A.prototype.nb = function () {
  return 0;
};
z("sched_yield", A.prototype.nb);
A.prototype.qb = function () {
  return 52;
};
z("sock_recv", A.prototype.qb);
A.prototype.pb = function () {
  return 52;
};
z("sock_accept", A.prototype.pb);
A.prototype.rb = function () {
  return 52;
};
z("sock_send", A.prototype.rb);
A.prototype.sb = function () {
  return 52;
};
z("sock_shutdown", A.prototype.sb);
function xc(a, b) {
  let c;
  return (c = dc(a, b)) == null ? void 0 : c.buffers;
}
n = A.prototype;
n.readdir = function (a) {
  a = O(this.cwd, a);
  const b = a === "/" ? "/" : `${a}/`,
    c = [];
  Object.values(this.fd).forEach((d) => {
    if (d != null && d.path && ((d = d.path), d.startsWith(b))) {
      var e = d.slice(b.length);
      e.length !== 0 && (/\//g.test(e) || c.push(d));
    }
  });
  a = c.map((d) => d.replace(b, "").replace(/^\//, "")).filter((d) => !!d);
  return [...new Set(a)];
};
n.writeFile = function (a, b) {
  a = O(this.cwd, a);
  var c = uc(this, a);
  c.length > 0
    ? c.find((d) => d.type === "dir")
      ? console.error(`Can't write file ${a}, path is a directory`)
      : ((a = c[c.length - 1]),
        (a.seekPos = v.BigInt(0)),
        (a.buffers = [b]),
        (a.type = "file"),
        c.slice(0, -1).forEach((d) => {
          delete this.fd[d.fd];
        }))
    : ((c = this.fd.length),
      (this.fd[c] = { fd: c, path: a, seekPos: v.BigInt(0), buffers: [b], type: "file" }));
};
n.appendFile = function (a, b) {
  var c = O(this.cwd, a);
  (c = xc(this, c)) ? c.push(b) : console.error(`Can't append to non-existing file ${a}`);
};
n.readFile = function (a) {
  a = O(this.cwd, a);
  if ((a = xc(this, a))) return sc(a);
};
n.unlink = function (a) {
  a = O(this.cwd, a);
  const b = uc(this, a);
  b.length > 0
    ? b.forEach((c) => {
        delete this.fd[c.fd];
      })
    : console.error(`While trying to unlink ${a}, path not found`);
};
n.mkdir = function (a) {
  const b = O(this.cwd, a),
    c = [];
  Object.values(this.fd).forEach((d) => {
    if (d != null && d.path) return d.path.startsWith(b) && c.push(d.path);
  });
  c.length > 0
    ? console.warn(`mkdir: path ${a} already exists`)
    : ((a = this.fd.length), (this.fd[a] = { fd: a, path: b, type: "dir" }));
};
n.stat = function (a) {
  a = O(this.cwd, a);
  if ((a = dc(this, a))) {
    var b,
      c = ((b = a == null ? void 0 : a.buffers) != null ? b : []).reduce(
        (d, e) => d + ((e == null ? void 0 : e.byteLength) || 0),
        0,
      );
    b = a.type === "dir";
    return {
      Kb: 0,
      Nb: a.fd,
      mode: b ? 16877 : 33188,
      Wb: 1,
      uid: 0,
      Mb: 0,
      Yb: 0,
      size: c,
      Db: 4096,
      $: Math.ceil(c / 512),
      Ab: this.g,
      Vb: this.g,
      Ib: this.g,
      Cb: this.g,
      zb: new Date(this.g),
      Ub: new Date(this.g),
      Hb: new Date(this.g),
      Bb: new Date(this.g),
      isFile: !b,
      isDirectory: b,
      Pb: !1,
      Qb: !1,
      Tb: !1,
      Rb: !1,
      Sb: !1,
    };
  }
};
function yc(a) {
  for (; a.length > 0; ) a.pop();
}
const zc = () => ({ fa: !1, ua: 0, V: 0, U: 0, ka: 0, ja: 0, sa: 0, ba: [] }),
  Ac = (a, b = new TextDecoder("utf8")) => {
    const c = a instanceof Uint8Array ? a : new Uint8Array(a);
    if (!(c.length >= 8 && c[0] === 0 && c[1] === 97 && c[2] === 115 && c[3] === 109)) return zc();
    let d = 8;
    const e = (g) => {
        let l = 0,
          m = 1;
        for (let r = 0; r < 5; r += 1) {
          if (d >= g) throw Error("Unexpected end of WebAssembly data while reading ULEB");
          const q = c[d];
          d += 1;
          l += (q & 127) * m;
          if (l > 4294967295) throw Error("WebAssembly ULEB value exceeds uint32");
          if ((q & 128) === 0) return l;
          m *= 128;
        }
        throw Error("WebAssembly ULEB value is too long");
      },
      h = (g) => {
        const l = e(g);
        if (d + l > g) throw Error("Unexpected end of WebAssembly data while reading a name");
        g = b.decode(c.subarray(d, d + l));
        d += l;
        return g;
      };
    a = (g, l) => {
      const m = e(l),
        r = e(l),
        q = e(l),
        x = e(l),
        u = e(l),
        C = [];
      for (let B = 0; B < u; B += 1) C.push(h(l));
      if (d !== l) throw Error("Unexpected data at the end of the dylink section");
      return { fa: !0, ua: g, V: m, U: r, ka: q, ja: x, sa: u, ba: C };
    };
    const f = (g, l) => {
      const m = zc();
      m.fa = !0;
      m.ua = g;
      for (g = !1; d < l; ) {
        var r = c[d];
        d += 1;
        var q = e(l);
        q = d + q;
        if (q > l) throw Error("dylink.0 subsection extends past its section");
        if (r === 1) {
          if (g) throw Error("dylink.0 contains more than one memory info subsection");
          g = !0;
          m.V = e(q);
          m.U = e(q);
          m.ka = e(q);
          m.ja = e(q);
          if (d !== q) throw Error("Unexpected data in the dylink.0 memory info subsection");
        } else if (r === 2) {
          r = e(q);
          for (let x = 0; x < r; x += 1) m.ba.push(h(q));
          if (d !== q) throw Error("Unexpected data in the dylink.0 needed libraries subsection");
        }
        d = q;
      }
      if (!g) throw Error("dylink.0 is missing its memory info subsection");
      m.sa = m.ba.length;
      return m;
    };
    for (; d < c.length; ) {
      var k = c[d];
      d += 1;
      const g = e(c.length),
        l = d + g;
      if (l > c.length) throw Error("WebAssembly section extends past the end of the binary");
      if (k === 0) {
        k = h(l);
        if (k === "dylink") return a(g, l);
        if (k === "dylink.0") return f(g, l);
      }
      d = l;
    }
    return zc();
  }; /*
 zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */
function Bc(a) {
  const b = a.length;
  let c = 0,
    d = Number.POSITIVE_INFINITY,
    e,
    h,
    f,
    k;
  let g, l;
  for (g = 0; g < b; ++g) (a[g] > c && (c = a[g]), a[g] < d && (d = a[g]));
  const m = 1 << c,
    r = new Uint32Array(m);
  e = 1;
  h = 0;
  for (f = 2; e <= c; ) {
    for (g = 0; g < b; ++g)
      if (a[g] === e) {
        k = 0;
        var q = h;
        for (l = 0; l < e; ++l) ((k = (k << 1) | (q & 1)), (q >>= 1));
        q = (e << 16) | g;
        for (l = k; l < m; l += f) r[l] = q;
        ++h;
      }
    ++e;
    h <<= 1;
    f <<= 1;
  }
  return [r, c, d];
}
function Cc(a, b) {
  this.$ = [];
  this.bufferSize = 32768;
  this.m = this.u = this.i = this.C = 0;
  this.input = new Uint8Array(a);
  this.D = !1;
  this.B = Dc;
  this.resize = !1;
  if (b || !(b = {}))
    (b.index && (this.i = b.index),
      b.bufferSize && (this.bufferSize = b.bufferSize),
      b.B && (this.B = b.B),
      b.resize && (this.resize = b.resize));
  switch (this.B) {
    case Ec:
      this.g = 32768;
      this.output = new Uint8Array(32768 + this.bufferSize + 258);
      break;
    case Dc:
      this.g = 0;
      this.output = new Uint8Array(this.bufferSize);
      break;
    default:
      throw Error("invalid inflate mode");
  }
}
var Ec = 0,
  Dc = 1,
  Fc = new Uint16Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]),
  Gc = new Uint16Array([
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
    163, 195, 227, 258, 258, 258,
  ]),
  Hc = new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0,
  ]),
  Ic = new Uint16Array([
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
    3073, 4097, 6145, 8193, 12289, 16385, 24577,
  ]),
  Jc = new Uint8Array([
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
    13,
  ]),
  Mc;
const Nc = new Uint8Array(288);
let V, Oc;
V = 0;
for (Oc = Nc.length; V < Oc; ++V) Nc[V] = V <= 143 ? 8 : V <= 255 ? 9 : V <= 279 ? 7 : 8;
Mc = Bc(Nc);
var Pc;
const Qc = new Uint8Array(30);
let Rc, Sc;
Rc = 0;
for (Sc = Qc.length; Rc < Sc; ++Rc) Qc[Rc] = 5;
Pc = Bc(Qc);
function W(a, b) {
  let c = a.u,
    d = a.m;
  const e = a.input;
  let h = a.i;
  if (h + ((b - d + 7) >> 3) >= e.length) throw Error("input buffer is broken");
  for (; d < b; ) ((c |= e[h++] << d), (d += 8));
  a.u = c >>> b;
  a.m = d - b;
  a.i = h;
  return c & ((1 << b) - 1);
}
function Tc(a, b) {
  let c = a.u,
    d = a.m;
  var e = a.input;
  let h = a.i;
  var f = e.length;
  const k = b[0];
  for (b = b[1]; d < b && !(h >= f); ) ((c |= e[h++] << d), (d += 8));
  e = k[c & ((1 << b) - 1)];
  f = e >>> 16;
  if (f > d) throw Error("invalid code length: " + f);
  a.u = c >> f;
  a.m = d - f;
  a.i = h;
  return e & 65535;
}
function Uc(a, b, c) {
  let d = a.output,
    e = a.g;
  a.G = b;
  const h = d.length - 258;
  var f;
  let k, g;
  for (; (f = Tc(a, b)) !== 256; )
    if (f < 256) (e >= h && ((a.g = e), (d = Vc(a)), (e = a.g)), (d[e++] = f));
    else
      for (
        f -= 257,
          g = Gc[f],
          Hc[f] > 0 && (g += W(a, Hc[f])),
          f = Tc(a, c),
          k = Ic[f],
          Jc[f] > 0 && (k += W(a, Jc[f])),
          e >= h && ((a.g = e), (d = Vc(a)), (e = a.g));
        g--;
      )
        d[e] = d[e++ - k];
  for (; a.m >= 8; ) ((a.m -= 8), a.i--);
  a.g = e;
}
function Wc(a, b, c) {
  let d = a.output,
    e = a.g;
  a.G = b;
  let h = d.length;
  var f;
  let k, g;
  for (; (f = Tc(a, b)) !== 256; )
    if (f < 256) (e >= h && ((d = Xc(a)), (h = d.length)), (d[e++] = f));
    else
      for (
        f -= 257,
          g = Gc[f],
          Hc[f] > 0 && (g += W(a, Hc[f])),
          f = Tc(a, c),
          k = Ic[f],
          Jc[f] > 0 && (k += W(a, Jc[f])),
          e + g > h && ((d = Xc(a)), (h = d.length));
        g--;
      )
        d[e] = d[e++ - k];
  for (; a.m >= 8; ) ((a.m -= 8), a.i--);
  a.g = e;
}
function Vc(a) {
  const b = new Uint8Array(a.g - 32768),
    c = a.g - 32768,
    d = a.output;
  b.set(d.subarray(32768, b.length));
  a.$.push(b);
  a.C += b.length;
  d.set(d.subarray(c, c + 32768));
  a.g = 32768;
  return d;
}
function Xc(a, b) {
  let c = Math.trunc(a.input.length / a.i + 1);
  const d = a.input,
    e = a.output;
  b && (typeof b.qa === "number" && (c = b.qa), typeof b.wa === "number" && (c += b.wa));
  c < 2
    ? ((b = (d.length - a.i) / a.G[2]),
      (b = Math.trunc((b / 2) * 258)),
      (b = b < e.length ? e.length + b : e.length << 1))
    : (b = e.length * c);
  b = new Uint8Array(b);
  b.set(e);
  a.output = b;
  return a.output;
}
function Yc(a) {
  var b;
  this.input = a;
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
  if (((c << 8) + d) % 31 !== 0) throw Error("invalid fcheck flag:" + (((c << 8) + d) % 31));
  if (d & 32) throw Error("fdict flag is not supported");
  this.i = new Cc(a, { index: this.g, bufferSize: b.bufferSize, B: b.B, resize: b.resize });
}
function Zc(a) {
  var b = a.input,
    c;
  a: {
    for (c = a.i; !c.D; ) {
      var d = void 0,
        e = void 0,
        h = void 0,
        f = void 0,
        k = c,
        g = W(k, 3);
      g & 1 && (k.D = !0);
      g >>>= 1;
      switch (g) {
        case 0:
          g = k.input;
          e = k.i;
          var l = k.output,
            m = k.g;
          h = g.length;
          d = l.length;
          k.u = 0;
          k.m = 0;
          if (e + 1 >= h) throw Error("invalid uncompressed block header: LEN");
          f = g[e++] | (g[e++] << 8);
          if (e + 1 >= h) throw Error("invalid uncompressed block header: NLEN");
          h = g[e++] | (g[e++] << 8);
          if (f === ~h) throw Error("invalid uncompressed block header: length verify");
          if (e + f > g.length) throw Error("input buffer is broken");
          switch (k.B) {
            case Ec:
              for (; m + f > l.length; )
                ((h = d - m),
                  (f -= h),
                  l.set(g.subarray(e, e + h), m),
                  (m += h),
                  (e += h),
                  (k.g = m),
                  (l = Vc(k)),
                  (m = k.g));
              break;
            case Dc:
              for (; m + f > l.length; ) l = Xc(k, { qa: 2 });
              break;
            default:
              throw Error("invalid inflate mode");
          }
          l.set(g.subarray(e, e + f), m);
          k.i = e + f;
          k.g = m + f;
          k.output = l;
          break;
        case 1:
          switch (k.B) {
            case Dc:
              Wc(k, Mc, Pc);
              break;
            case Ec:
              Uc(k, Mc, Pc);
              break;
            default:
              throw Error("invalid inflate mode");
          }
          break;
        case 2:
          g = W(k, 5) + 257;
          d = W(k, 5) + 1;
          l = W(k, 4) + 4;
          m = new Uint8Array(Fc.length);
          for (e = 0; e < l; ++e) m[Fc[e]] = W(k, 3);
          m = Bc(m);
          l = new Uint8Array(g + d);
          e = 0;
          for (d = g + d; e < d; )
            switch (((h = Tc(k, m)), h)) {
              case 16:
                for (h = 3 + W(k, 2); h--; ) l[e++] = f;
                break;
              case 17:
                for (h = 3 + W(k, 3); h--; ) l[e++] = 0;
                f = 0;
                break;
              case 18:
                for (h = 11 + W(k, 7); h--; ) l[e++] = 0;
                f = 0;
                break;
              default:
                f = l[e++] = h;
            }
          f = Bc(l.subarray(0, g));
          g = Bc(l.subarray(g));
          switch (k.B) {
            case Dc:
              Wc(k, f, g);
              break;
            case Ec:
              Uc(k, f, g);
              break;
            default:
              throw Error("invalid inflate mode");
          }
          break;
        default:
          throw Error("unknown BTYPE: " + g);
      }
    }
    switch (c.B) {
      case Ec:
        {
          k = 0;
          f = c.output;
          g = c.$;
          l = new Uint8Array(c.C + (c.g - 32768));
          let r;
          if (g.length === 0) c = c.output.subarray(32768, c.g);
          else {
            m = 0;
            for (d = g.length; m < d; ++m)
              for (e = g[m], h = 0, r = e.length; h < r; ++h) l[k++] = e[h];
            m = 32768;
            for (d = c.g; m < d; ++m) l[k++] = f[m];
            c.$ = [];
            c.buffer = l;
            c = c.buffer;
          }
        }
        break a;
      case Dc:
        f = c.g;
        c.resize
          ? ((k = new Uint8Array(f)), k.set(c.output.subarray(0, f)))
          : (k = c.output.subarray(0, f));
        c.buffer = k;
        c = c.buffer;
        break a;
      default:
        throw Error("invalid inflate mode");
    }
  }
  a.g = a.i.i;
  if (a.verify) {
    a = ((b[a.g++] << 24) | (b[a.g++] << 16) | (b[a.g++] << 8) | b[a.g++]) >>> 0;
    b = c;
    if (typeof b === "string") {
      b = [...b];
      k = 0;
      for (f = b.length; k < f; k++) b[k] = (b[k].charPointAt(0) & 255) >>> 0;
      b = new Uint8Array([b]);
    }
    k = 1;
    f = 0;
    g = b.length;
    for (l = 0; g > 0; ) {
      e = Math.min(g, 1024);
      g -= e;
      do ((k += b[l++]), (f += k));
      while (--e);
      k %= 65521;
      f %= 65521;
    }
    if (a !== ((f << 16) | k) >>> 0) throw Error("invalid adler-32 checksum");
  }
  return c;
}
const $c = (a) => {
    if (!Number.isInteger(a) || a < 0 || a > 30)
      throw Error(`Invalid WebAssembly alignment exponent: ${a}`);
    return 2 ** a;
  },
  ad = (a, b) => {
    throw Error(`csound exit with code: ${b}`);
  },
  bd = ({ memory: a, messagePort: b, tb: c }) =>
    function (d, e, h, f) {
      if (a) {
        d = new Uint8Array(a.buffer, f, h);
        d = H.decode(d);
        var k = /\n$/g.test(d);
        e = /^\n/g.test(d);
        var g = d.split("\n").filter((m) => m.length > 0),
          l = [];
        if ((g.length === 0 && k) || e) (l.push(c.join("")), yc(c));
        g.forEach((m, r) => {
          r + 1 === g.length
            ? k
              ? r === 0
                ? (l.push(c.join("") + m), yc(c))
                : l.push(m)
              : c.push(m)
            : r === 0
              ? (l.push(c.join("") + m), yc(c))
              : l.push(m);
        });
        l.forEach((m) => {
          m.replaceAll(/(\r\n|\n|\r)/gm, "") && b.ia({ log: m });
        });
      }
    };
function cd(a) {
  return a && a.length >= 8 && a[0] === 0 && a[1] === 97 && a[2] === 115 && a[3] === 109;
}
function dd(a, b) {
  if (a === b) return !0;
  if (!a || !b || a.length !== b.length) return !1;
  for (const [c, d] of a.entries()) if (d !== b[c]) return !1;
  return !0;
}
const ed = (a) => {
  const b = new Set(a.map(({ name: c }) => c));
  if (b.has("__wasm_call_ctors")) {
    if (b.has("csoundModuleCreate") || b.has("csound_opcode_init") || b.has("csound_fgen_init"))
      return !0;
    console.error(
      a,
      "A csound plugin turns out to be neither a plugin, opcode or module.\nPerhaps csdl.h or module.h wasn't imported correctly?",
    );
    return !1;
  }
  console.error(
    "A csound plugin didn't export __wasm_call_ctors.\nPlease re-run wasm-ld with either --export-all or include --export=__wasm_call_ctors",
  );
  return !1;
};
async function fd({ ub: a, withPlugins: b = [], messagePort: c }) {
  const d = new A(),
    e = new Map();
  let h = 0;
  a = new Uint8Array(a);
  a = Zc(new Yc(a));
  var f = Ac(a, H),
    k = f.V;
  f = f.U;
  b = await b.reduce(async (p, t) => {
    p = await p;
    let y, E;
    try {
      y = new Uint8Array(t);
      if (!cd(y))
        return (
          console.warn(
            "Skipping plugin payload because it is not a wasm binary. Check plugin URL/path and server mapping.",
          ),
          p
        );
      E = Ac(y, H);
    } catch (D) {
      console.error("Error in plugin", D);
    }
    E && p.push({ R: E, H: y });
    return p;
  }, []);
  k = Math.ceil((k + $c(f)) / 65536);
  f = Math.ceil(b.reduce((p, { R: t }) => p + t.V + $c(t.U), 0) / 65536);
  const g = new WebAssembly.Memory({ initial: k + f + 2048, maximum: 16384 });
  d.memory = g;
  k = new WebAssembly.Global({ value: "i32", mutable: !1 }, 2048);
  f = new WebAssembly.Global({ value: "i32", mutable: !1 }, 1);
  a = await WebAssembly.compile(a);
  const l = tc(d, a),
    m = [],
    r = [],
    q = new Map(),
    x = new Map(),
    u = { aa: void 0, table: void 0 };
  let C = 0;
  var B = void 0;
  const ca = (p) => {
      let t = x.get(p);
      t || ((t = { ha: new Set(), plugins: new Set() }), x.set(p, t));
      return t;
    },
    P = (p, t, y) => {
      if (!y.plugins.has(p)) {
        var E = p.instance || p,
          D = p.table || u.table;
        try {
          lc(B, E, u.table, t, D, g);
        } finally {
          C = Math.max(C, u.table.length);
        }
        y.plugins.add(p);
      }
    },
    X = (p) => {
      if (!p) return "";
      p = new Uint8Array(g.buffer, p);
      let t = 0;
      for (; t < p.length && p[t] !== 0; ) t += 1;
      return H.decode(p.subarray(0, t));
    };
  l.env = l.env || {};
  l.env.memory = g;
  l.env.__memory_base = k;
  l.env.__table_base = f;
  l.env.csoundLoadModules = (p) => {
    const t = { ha: new Set(), plugins: new Set() };
    x.set(p, t);
    m.forEach((y) => {
      P(y, p, t);
    });
    return 0;
  };
  l.env.csoundLoadExternals = (p, t) => {
    if (typeof u.aa !== "function") return -1;
    t = X(t);
    t = [...new Set(t.split(",").filter((D) => D.length > 0))];
    t.sort();
    const y = ca(p);
    let E = 0;
    t.forEach((D) => {
      if (!y.ha.has(D))
        try {
          const J = d.readFile(D);
          if (cd(J)) {
            var I = q.get(D);
            (I && dd(I.H, J)) ||
              ((I = r.find((cb) => dd(cb.H, J))),
              I || ((I = u.aa({ R: Ac(J, H), H: J })) && r.push(I)),
              I && q.set(D, I));
            I ? (P(I, p, y), y.ha.add(D)) : (E = -1);
          } else
            (console.error(
              `Unable to load requested Csound plugin '${D}' from the WASI filesystem.`,
            ),
              (E = -1));
        } catch (J) {
          (console.error(`Error while loading requested Csound plugin '${D}'`, J), (E = -1));
        }
    });
    return E;
  };
  l.env.saveSetjmp = (p, t) => {
    e.set(p, t);
    return 0;
  };
  l.env.testSetjmp = (p) => (e.has(p) ? 1 : 0);
  l.env.longjmp = (p, t) => {
    if (!e.get(p)) throw Error(`Invalid longjmp target ${p}`);
    throw Error(`csound exit with code: ${t}`);
  };
  l.env.__wasm_longjmp = ad;
  l.env.getTempRet0 = () => h;
  l.env.setTempRet0 = (p) => {
    h = p;
  };
  l.env.csoundWasiJsMessageCallback = bd({ memory: g, messagePort: c, tb: [] });
  l.env.csoundWasiJsDebugCallback = () => {
    c.ia({ Jb: !0 });
  };
  l.env.printDebugCallback = (p, t) => {
    p = new Uint8Array(g.buffer, p, t);
    p = H.decode(p);
    if (p.startsWith("CSOUND_WASI_LONGJMP:"))
      throw (
        (p = Number.parseInt(p.slice(20), 10)),
        Error(`csound longjmp with code: ${Number.isNaN(p) ? -1 : p}`)
      );
    console.log(p);
  };
  a = await WebAssembly.instantiate(a, l);
  a = Object.assign({}, a.exports);
  const F = {};
  a.memory = g;
  const sa = a.csoundDestroy;
  typeof sa === "function" &&
    (a.csoundDestroy = (p) => {
      try {
        return sa(p);
      } finally {
        x.delete(p);
      }
    });
  F.exports = a;
  B = F;
  u.table = F.exports.__indirect_function_table;
  C = u.table.length;
  d.start(F);
  const Ra =
      typeof F.exports.csoundWasiLoadPlugin === "function" ||
      typeof F.exports.csoundWasiLoadOpcodeLibrary === "function",
    Sa = (p, t) => {
      if (p === 0) return { ea: 0, ga: 0 };
      var y = F.exports.allocStringMem;
      const E = F.exports.freeStringMem;
      if (typeof y !== "function")
        throw new TypeError("The WebAssembly host does not export allocStringMem");
      if (typeof E !== "function")
        throw new TypeError("The WebAssembly host does not export freeStringMem");
      t = $c(t);
      const D = p + t - 1;
      if (!Number.isSafeInteger(D) || D > 2147483647)
        throw new TypeError("The WebAssembly plugin memory request is too large");
      y = y(D);
      if (y === 0) throw Error(`Could not reserve ${D} bytes for a WebAssembly plugin`);
      t *= Math.ceil(y / t);
      try {
        new Uint8Array(g.buffer, t, p).fill(0);
      } catch (I) {
        throw (E(y), I);
      }
      return { ea: y, ga: t };
    };
  u.aa = ({ R: p, ib: t, H: y }) => {
    const E = p.fa,
      D = p.V,
      I = p.U,
      J = p.ka,
      cb = p.ja;
    p = p.ba;
    if (p.length > 0)
      throw Error(`WebAssembly plugin dependencies are not supported: ${p.join(", ")}`);
    t = t || new WebAssembly.Module(y);
    p = tc(d, t);
    const jd = WebAssembly.Module.imports(t);
    var Q = WebAssembly.Module.exports(t);
    if (ed(Q)) {
      var ea = Q.some(({ name: R }) => R === "csound_opcode_init" || R === "csound_fgen_init");
      Q = Q.some(({ name: R }) => R === "csoundModuleInit");
      var kd = !E && (!Ra || (ea && !Q)),
        Kc = (ea = 0);
      Q = 0;
      var ya = !1;
      try {
        let R = u.table,
          za = u.table.length;
        if (kd) {
          R = new WebAssembly.Table({
            initial: Math.max(u.table.length + Math.max(J, 0) + 16, 16),
            element: "anyfunc",
          });
          for (var S = 0; S < u.table.length; S += 1) {
            var Z = u.table.get(S);
            Z && R.set(S, Z);
          }
        } else {
          if (!Number.isSafeInteger(J) || J < 0 || J > 1e6)
            throw new TypeError("Invalid WebAssembly plugin table size");
          const M = $c(cb);
          za = Math.ceil(C / M) * M;
          Z = za + J;
          if (!Number.isSafeInteger(Z) || Z > 2147483647)
            throw new TypeError("The WebAssembly plugin table request is too large");
          S = Z - u.table.length;
          if (S > 1e6) throw new TypeError("The WebAssembly plugin table request is too large");
          S > 0 && u.table.grow(S);
          Kc = za;
          Q = Z;
          ya = !0;
        }
        p.env = Object.assign({}, p.env);
        p.env.memory = g;
        p.env.__indirect_function_table = R;
        const Lc = E ? Sa(D, I) : { ea: 0, ga: 0 };
        ea = Lc.ea;
        p.env.__memory_base = new WebAssembly.Global({ value: "i32", mutable: !1 }, Lc.ga);
        p.env.__table_base = new WebAssembly.Global({ value: "i32", mutable: !1 }, za);
        for (const M of jd)
          if (M.module === "env")
            if (M.kind === "function" && !p.env[M.name]) {
              const pa = F.exports[M.name];
              if (typeof pa !== "function")
                throw new TypeError(`Missing WebAssembly host function: env.${M.name}`);
              p.env[M.name] = pa;
            } else if (M.kind === "global" && M.name === "__stack_pointer") {
              const pa = F.exports.__stack_pointer;
              if (!pa) throw Error("The WebAssembly host does not export __stack_pointer");
              p.env.__stack_pointer = pa;
            }
        const Aa = new WebAssembly.Instance(t, p);
        typeof Aa.exports.__wasm_apply_data_relocs === "function" &&
          Aa.exports.__wasm_apply_data_relocs();
        Aa.exports.__wasm_call_ctors();
        ea = 0;
        ya && ((C = Q), (ya = !1));
        return { instance: Aa, table: R, H: y };
      } finally {
        if (ya) for (y = Kc; y < Q; y += 1) u.table.set(y, null);
        ea !== 0 && F.exports.freeStringMem(ea);
      }
    }
  };
  (
    await Promise.all(
      b.map(async ({ R: p, H: t }) => {
        try {
          const y = await WebAssembly.compile(t);
          return { R: p, ib: y, H: t };
        } catch (y) {
          console.error("Error while compiling csound-plugin", y);
        }
      }),
    )
  ).forEach((p) => {
    if (p)
      try {
        const t = u.aa(p);
        t && (r.push(t), m.push(t));
      } catch (t) {
        console.error("Error while instantiating csound-plugin", t);
      }
  });
  F.exports.__wasi_js_csoundSetMessageStringCallback();
  return [F, d];
}
const gd = (a) => {
    const b = a.T <= 1 || a.W >= a.T ? 0 : (a.T - a.W - 1) / (a.T - 1);
    a.W += 1;
    return b;
  },
  hd = (a) => (a ? Math.max(0, a.T - a.W) : 0);
let id;
const ld = (a, b, c, d = ((id = b[0]) == null ? void 0 : id.length) || 0) => {
  if (a && b && b.length !== 0 && !(d <= 0)) {
    d = Math.min(d, ...b.map((e) => e.length));
    for (let e = 0; e < d; e++) {
      const h = gd(a);
      b.forEach((f, k) => {
        f[e] = (c[k] || 0) * h;
      });
    }
  }
};
let Y;
Y = () => () => {};
const md =
  ({ j: a, l: b, ob: c }) =>
  async (d) => {
    d = d.csound;
    const e = a.csoundGetKr(d);
    let h = 0,
      f = 0;
    for (; b.L === "renderStarted" && h === 0; )
      ((h = a.csoundPerformKsmps(d)),
        (f += 1),
        h === 0 &&
          f % (e * 2) === 0 &&
          (await new Promise((k) => {
            c(k);
          })));
    b.v("renderEnded");
  };
class nd extends AudioWorkletProcessor {
  constructor(a) {
    super(a);
    this.da =
      this.j =
      this.D =
      this.rtmidiPort =
      this.X =
      this.o =
      this.la =
      this.ca =
      this.O =
      this.m =
      this.na =
      this.u =
      this.M =
      this.wasm =
      this.h =
        void 0;
    this.P = [];
    this.g = void 0;
    this.i = [];
    this.sampleRate = globalThis.sampleRate;
    this.initialize = this.initialize.bind(this);
    this.pause = this.pause.bind(this);
    this.stop = this.stop.bind(this);
    this.terminate = this.terminate.bind(this);
    this.beginFadeOut = this.beginFadeOut.bind(this);
    this.process = this.process.bind(this);
    this.resume = this.resume.bind(this);
    this.start = this.start.bind(this);
    this.isRequestingInput = this.isRequestingInput.bind(this);
    this.isRequestingRealtimeOutput = this.isRequestingRealtimeOutput.bind(this);
    this.Y = this.J = this.G = this.N = this.C = this.Z = !1;
    this.callUncloned = async (b, c) => {
      if ((b = this.da && this.da.get(b))) return b.apply({}, c || []);
      console.error("Csound worklet thread is still uninitialized!");
    };
    this.port.start();
    ia(this, this.port);
    this.l = new va();
    this.initializeMessagePort = ({ messagePort: b, rtmidiPort: c }) => {
      this.l.ia = (d) => {
        b.postMessage({ log: d });
      };
      this.l.v = (d) => {
        this.l.L !== d && (this.l.L = d);
        const e = {};
        e.playStateChange = d;
        b.postMessage(e);
      };
      this.l.ready = !0;
      Y()();
      this.rtmidiPort = c;
      this.rtmidiPort.addEventListener("message", ({ data: d }) => {
        this.P.push(d);
      });
      this.rtmidiPort.start();
    };
  }
  async initialize(a, b) {
    Y()();
    let c;
    const d = new Promise((e) => {
      c = e;
    });
    fd({ ub: a, withPlugins: b, messagePort: this.l }).then(([e, h]) => {
      this.wasm = e;
      this.h = h;
      e.h = h;
      this.j = jc(e);
      this.o = this.j.csoundCreate(0);
      this.X = 0;
      this.Y = this.J = this.C = this.G = !1;
      this.ma(!1);
      this.da = new Map(
        Object.entries({
          ...this.j,
          csoundCreate: async () => this.o,
          csoundReset: this.ma.bind(this),
          csoundStop: this.stop.bind(this),
          csoundStart: this.start.bind(this),
          wasm: e,
        }),
      );
      Y()();
      c();
    });
    Y()();
    await d;
  }
  async ma(a) {
    if (
      (a && !this.l) ||
      (a && this.l.L !== "realtimePerformanceEnded" && this.l.L !== "realtimePerformanceStarted")
    )
      return -1;
    a && this.l.L === "realtimePerformanceStarted" && this.l.v("realtimePerformanceEnded");
    this.J = this.G = !1;
    this.X = 0;
    this.g = void 0;
    this.i = [];
    const b = this.o;
    a && this.j.csoundReset(b);
    this.sampleRate &&
      ((a = this.j.csoundSetOption(b, "--sample-rate=" + this.sampleRate)),
      a !== 0 && console.error("csoundSetOption sample-rate failed:", a));
    this.O = this.m = -1;
    delete this.u;
    delete this.M;
  }
  stop() {
    this.beginFadeOut();
    this.J = this.G = !1;
    this.X = 0;
    this.C = this.Z = !1;
    delete this.u;
    delete this.M;
    this.o && this.j.csoundStop(this.o);
    this.l.v("realtimePerformanceEnded");
  }
  terminate() {
    if (!this.Y) {
      this.Y = !0;
      var a = this.D;
      this.D = void 0;
      typeof a === "function" && a();
      yc(this.P);
      this.stop();
    }
  }
  pause() {
    this.N || (this.l.v("realtimePerformancePaused"), (this.N = !0));
  }
  resume() {
    this.N && (this.l.v("realtimePerformanceResumed"), (this.N = !1));
  }
  process(a, b) {
    if (typeof this.D === "function") {
      var c = this.D;
      this.D = void 0;
      c();
    }
    if (this.Y) return ((b[0] || []).forEach((u) => u.fill(0)), !1);
    if (this.C || this.N || !this.u || !this.G)
      return (
        (a = b[0]),
        this.g
          ? (ld(this.g, a, this.i), hd(this.g) === 0 && (this.g = void 0))
          : a.forEach((u) => u.fill(0)),
        !0
      );
    this.Z && ((this.Z = !1), this.l.v("realtimePerformanceStarted"));
    this.P.length > 0 &&
      (this.P.forEach((u) => {
        this.j.csoundPushMidiMessage(this.o, u[0], u[1], u[2]);
      }),
      yc(this.P));
    a = a[0];
    b = b[0];
    c = b[0].length;
    let d = this.u,
      e = this.M;
    const h = this.la,
      f = this.na || 1;
    let k = this.ca;
    const g = this.m,
      l = this.O;
    let m = this.X;
    for (let u = 0; u < c; u++, k++) {
      k >= h &&
        m === 0 &&
        ((m = this.j.csoundPerformKsmps(this.o)),
        (k = 0),
        m !== 0 &&
          ((this.J = this.G = !1), this.beginFadeOut(), this.l.v("realtimePerformanceEnded")));
      var r = m === 0 ? 1 : gd(this.g);
      (d && d.length !== 0) ||
        (d = this.u =
          new Float64Array(this.wasm.h.memory.buffer, this.j.csoundGetSpout(this.o), h * g));
      (e && e.length !== 0) ||
        (e = this.M =
          new Float64Array(this.wasm.h.memory.buffer, this.j.csoundGetSpin(this.o), h * l));
      var q = Math.min(this.O, a.length);
      for (var x = 0; x < q; x++) e[k * l + x] = a[x][u] * f;
      if (this.m === b.length)
        for (const [C, B] of b.entries())
          ((B[u] = m === 0 ? d[k * g + C] / f : (this.i[C] || 0) * r),
            m === 0 && (this.i[C] = B[u]));
      else
        this.m === 2 && b.length === 1
          ? ((q = b[0]),
            (q[u] = m === 0 ? 0.5 * (d[k * g] / f + d[k * g + 1] / f) : (this.i[0] || 0) * r),
            m === 0 && (this.i[0] = q[u]))
          : this.m === 1 &&
            b.length === 2 &&
            ((q = b[0]),
            (x = b[1]),
            m === 0
              ? ((r = d[k * g] / f), (q[u] = r), (x[u] = r))
              : ((q[u] = (this.i[0] || 0) * r), (x[u] = (this.i[1] || 0) * r)),
            m === 0 && ((this.i[0] = q[u]), (this.i[1] = x[u])));
    }
    this.ca = k;
    this.X = m;
    this.g && hd(this.g) === 0 && (this.g = void 0);
    return !0;
  }
  isRequestingInput() {
    return this.j.isRequestingRtAudioInput(this.o);
  }
  isRequestingRealtimeOutput() {
    return (this.j.csoundGetOutputName(this.o) || "").includes("dac");
  }
  beginFadeOut() {
    if (this.g) return hd(this.g);
    const a = Math.max(1, Math.round((this.sampleRate || 1) / 50));
    this.g = { T: Math.max(1, Math.floor(Number(a) || 0)), W: 0 };
    return a;
  }
  async start() {
    let a = -1;
    if (this.J) Y()();
    else {
      Y()();
      const b = this.o,
        c = this.j.csoundGetKsmps(b);
      this.ca = this.la = c;
      this.m = this.j.csoundGetNchnls(b);
      this.O = this.j.csoundGetNchnlsInput(b);
      this.na = this.j.csoundGet0dBFS(b);
      a = this.j.csoundStart(b);
      if (a !== 0) return a;
      if (this.isRequestingRealtimeOutput())
        ((this.u = new Float64Array(
          this.wasm.h.memory.buffer,
          this.j.csoundGetSpout(b),
          c * this.m,
        )),
          (this.M = new Float64Array(
            this.wasm.h.memory.buffer,
            this.j.csoundGetSpin(b),
            c * this.O,
          )),
          Y()(),
          (this.Z = this.J = !0));
      else
        return (
          this.l.v("renderStarted"),
          (this.C = !0),
          md({
            j: this.j,
            l: this.l,
            ob: (d) => {
              this.D = d;
            },
          })({ o: b })
            .then(() => {
              this.l.v("renderEnded");
              this.C = !1;
            })
            .catch((d) => {
              console.error(d);
              this.l.v("renderEnded");
              this.C = !1;
            }),
          0
        );
    }
    this.G = !0;
    return a;
  }
}
registerProcessor("csound-singlethread-worklet-processor", nd);
//# sourceURL=/dist/__compiled.worklet.singlethread.worker.js
//# sourceMappingURL=/dist/__compiled.worklet.singlethread.worker.js.map
