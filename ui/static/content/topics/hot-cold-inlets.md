# Hot and Cold Inlets

Objects with multiple inlets in Patchies follow the **Max/MSP and Pure Data convention** of hot and cold inlets.

## The Concept

- **Inlet 0 (hot)**: When a message arrives at the first inlet, the object evaluates and sends output immediately
- **Inlets 1+ (cold)**: When a message arrives at other inlets, the value is stored but **no output is triggered**

This design allows you to set up all the values you need before triggering the computation.

## Example: expr $1 + $2

```text
[number 5] ────► inlet 0 (hot, $1)  ──┐
                                      ├──► [expr $1 + $2] ──► outlet
[number 3] ────► inlet 1 (cold, $2) ──┘
```

1. Number `3` arrives at inlet 1 (cold) - stored as `$2`, no output
2. Number `5` arrives at inlet 0 (hot) - triggers evaluation: `5 + 3 = 8`

If both numbers arrive at the hot inlet, you'd get intermediate (often wrong) results.

## Controlling Execution Order

Use [trigger](/docs/objects/trigger) to ensure values reach cold inlets before triggering hot inlets:

```text
[slider] ──► [t b a] ──► outlet 0 (bang) ──► expr inlet 0 (hot)
                    └──► outlet 1 (value) ──► expr inlet 1 (cold)
```

The `trigger` object outputs **right-to-left**, so:

1. The value goes to the cold inlet first
2. Then the bang triggers the hot inlet

## Objects Using Hot/Cold Inlets

These objects follow the hot/cold inlet convention:

- [expr](/docs/objects/expr) - expression evaluator
- [map](/docs/objects/map) - JavaScript transformer
- [filter](/docs/objects/filter) - conditional message passing

## See Also

- [trigger](/docs/objects/trigger) - control message order
- [Message Passing](/docs/message-passing) - how messages flow between objects
