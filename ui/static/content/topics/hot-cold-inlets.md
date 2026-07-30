# Hot and Cold Inlets

Objects with multiple inlets do not treat each inlet the same way. The first inlet is hot. A message at this inlet evaluates the object and sends output. The other inlets are cold. They store the incoming value but do not send output.

This design comes from [Max](https://docs.cycling74.com/userguide/objects/#inlets-and-outlets) and [Pure Data](https://msp.ucsd.edu/Pd_documentation/resources/chapter2.htm#s2.4.3). It lets you control when an object evaluates.

## How It Works

| Inlet | Behavior |
| ----- | -------- |
| Inlet 0 (hot) | Stores the value and immediately triggers output. |
| Inlet 1, 2, … (cold) | Stores the value but does not trigger output. |

Treat cold inlets as staging areas. Set their values before you send a message to the hot inlet.

## Example: `expr $1 + $2`

```text
[number 3] ──► inlet 1 (cold, $2)  ──┐
                                      ├──► [expr $1 + $2] ──► outlet
[number 5] ──► inlet 0 (hot,  $1)  ──┘
```

To get this result:

1. Send `3` to inlet 1. The object stores it as `$2` and does not send output.
2. Send `5` to inlet 0. The object evaluates `5 + 3 = 8` and sends the result to the outlet.

If both values arrive at inlet 0, the object sends an intermediate result. For example, it sends `5 + 0 = 5` before it receives the second value.

## Controlling Execution Order

When one source feeds both inlets, set the cold inlet before you trigger the hot inlet. Use the [trigger](/docs/objects/trigger) object to control this order.

`trigger`, or `t`, sends values from right to left. The rightmost outlet sends first:

```text
[slider]
   │
   ▼
[t b a]
   │         └──► outlet 1 (value, fires first) ──► expr inlet 1 (cold)
   └──────────────► outlet 0 (bang,  fires second) ──► expr inlet 0 (hot)
```

1. The value reaches the cold inlet first.
2. The bang triggers the hot inlet after the cold inlet stores its value.

> **Tip**: Check the message order when a multi-inlet object sends stale or unexpected output. Set cold inlets before you trigger the hot inlet. A `trigger` object can control the order.

## Objects That Use Hot/Cold Inlets

- [expr](/docs/objects/expr) — Evaluate expressions with `$1`, `$2`, and more inputs.
- [map](/docs/objects/map) — Transform messages with JavaScript.
- [filter](/docs/objects/filter) — Pass messages that meet a condition.

## See Also

- [trigger](/docs/objects/trigger) — Control message order.
- [Message Passing](/docs/message-passing) — Learn how messages flow between objects.
