The `trigger` object (or `t` for short) is essential for controlling message flow in your patch. It takes any incoming message and outputs it through multiple outlets in **right-to-left order**.

## Why Right-to-Left?

We need to set up values _before_ triggering an action. Objects with hot-cold inlets like `expr` and `map` require values in cold inlets before the hot inlet triggers.

## Usage

```text
trigger <type1> <type2> ...
t <type1> <type2> ...
```

## Example

`t b n` creates two outlets. When it receives the number `42`:

1. Outlet 1 (right) sends `42`
2. Outlet 0 (left) sends `{type: 'bang'}`

## Hot/Cold Inlet Pattern

The right-to-left order is crucial for setting up cold inlets before triggering hot inlets:

```text
[slider] ──┬──► [t b a] ──► outlet 0 (bang) ──► expr inlet 0 (hot)
           │           └──► outlet 1 (value) ──► expr inlet 1 (cold)
```

The trigger ensures the value reaches the cold inlet (`$2`) before the bang triggers the hot inlet (`$1`).

## See Also

- [Message Passing](/docs/message-passing) - how messages flow between objects
