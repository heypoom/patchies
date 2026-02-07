The `trigger` object (or `t` for short) is essential for controlling message flow in your patch. It takes any incoming message and outputs it through multiple outlets in **right-to-left order**.

## Why Right-to-Left?

We need to set up values _before_ triggering an action, for objects with hot-cold
inlets like `expr` and `map`

