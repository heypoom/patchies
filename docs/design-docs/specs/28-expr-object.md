# 28. Expr Object

Add the `expr` node as `ExprNode.svelte` which performs math calculations.

Example: `expr $1 + 2` -> has 1 inlet and 1 outlet. Given a message of `1`, it emits `3`.

We should evaluate the `$` variables in the expression, from `$1` to `$9`, and create inlets equal to the max number used, e.g. having `$4` would result in 4 inlets.

In the first implementation, we can define a user function like so. In this case, it basically constructs a JavaScript function similar to the `js` block.

```tsx
const args = [...Array(9)].map((_, i) => `$${i + 1}`)
const fn = new Function(...args, userCode)
```

The UI should be simple, similar to `ObjectNode.svelte` where it is just a text input for the expression. Double-click to edit the expression.
