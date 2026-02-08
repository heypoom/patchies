Transform incoming messages using JavaScript expressions. The result of the
expression is sent to the outlet.

Use `$1` to `$9` variables like in `expr` to reference inlet values.

Unlike `expr` which uses expr-eval, `map` uses full JavaScript, giving you
access to all JS features and some of the
[runner context](/docs/javascript-runner) (e.g. `esm()` for NPM imports,
`llm()`, etc.).

## Examples

```js
// Add 1 to the incoming value (same as expr $1 + 1)
$1 + 1

// Override a field in the incoming message object
{...$1, note: 64}

// Use JavaScript built-in functions
Math.floor($1)

// Use string methods
$1.toUpperCase()

// Use array methods
$1.map(x => x * 2)
```

## Hot and Cold Inlets

Inlet 0 (`$1`) triggers evaluation; other inlets store values silently.
See [Hot and Cold Inlets](/docs/hot-cold-inlets) for details.

## See Also

- [expr](/docs/objects/expr) - expression evaluator (expr-eval syntax)
- [filter](/docs/objects/filter) - conditional message passing
- [tap](/docs/objects/tap) - debug without modifying
