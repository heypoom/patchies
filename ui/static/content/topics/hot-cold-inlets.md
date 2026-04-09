# Hot and Cold Inlets

When an object has multiple inlets, not all of them behave the same way. The **first inlet is hot** — a message arriving there triggers the object to evaluate and send output immediately. **All other inlets are cold** — they quietly store the incoming value but produce no output on their own.

This design comes from [Max](https://docs.cycling74.com/userguide/objects/#inlets-and-outlets) and [Pure Data](https://msp.ucsd.edu/Pd_documentation/resources/chapter2.htm#s2.4.3). It gives you precise control over *when* a computation fires.

## How It Works

| Inlet | Behavior |
| --- | --- |
| Inlet 0 (hot) | Stores the value **and** immediately triggers output |
| Inlet 1, 2, … (cold) | Stores the value, does **not** trigger output |

Think of cold inlets as staging areas: you load them up with values, then fire the hot inlet when everything is ready.

## Example: `expr $1 + $2`

```text
[number 3] ──► inlet 1 (cold, $2)  ──┐
                                      ├──► [expr $1 + $2] ──► outlet
[number 5] ──► inlet 0 (hot,  $1)  ──┘
```

Step by step:

1. `3` arrives at inlet 1 (cold) — stored as `$2`, no output yet
2. `5` arrives at inlet 0 (hot) — triggers evaluation: `5 + 3 = 8` → sent to outlet

If both values arrived at inlet 0, you'd get an intermediate result (`5 + 0 = 5`) before the second value even arrives — almost always the wrong behavior.

## Controlling Execution Order

When a single source feeds both inlets, you need to guarantee the cold inlet receives its value *before* the hot inlet fires. Use the [trigger](/docs/objects/trigger) object for this.

`trigger` (or `t`) outputs its values **right-to-left**, so the rightmost outlet fires first:

```text
[slider]
   │
   ▼
[t b a]
   │         └──► outlet 1 (value, fires first) ──► expr inlet 1 (cold)
   └──────────────► outlet 0 (bang,  fires second) ──► expr inlet 0 (hot)
```

1. The value reaches the cold inlet first
2. The bang triggers the hot inlet — by then the cold inlet is already loaded

> **Tip**: Whenever you see unexpected or stale output from a multi-inlet object, check whether the cold inlets are being set before the hot inlet fires. A `trigger` object usually fixes it.

## Objects That Use Hot/Cold Inlets

- [expr](/docs/objects/expr) — expression evaluator (`$1`, `$2`, …)
- [map](/docs/objects/map) — JavaScript transformer
- [filter](/docs/objects/filter) — conditional message passing

## See Also

- [trigger](/docs/objects/trigger) — control message order
- [Message Passing](/docs/message-passing) — how messages flow between objects
