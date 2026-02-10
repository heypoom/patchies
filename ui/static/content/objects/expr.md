Evaluate expressions and formulas using the
[expr-eval](https://github.com/silentmatt/expr-eval) library.

![Patchies expression plot](/content/images/patchies-expr-plot.png)

> Try this patch out [in the app](/?id=c6adsknw8iix3m2&readonly=true)!

## Dynamic Inlets

Use `$1` to `$9` variables to create inlets dynamically. For example,
`$1 + $2` creates two inlets for addition.

## Expression Syntax

See the full
[expression syntax](https://github.com/silentmatt/expr-eval?tab=readme-ov-file#expression-syntax)
for available functions and operators.

## Working with Objects and Arrays

Expressions work with non-numbers too:

```js
// gets the 'note' field of an object and add 20 to it
$1.note + 20

// checks if the 'type' field is noteOn
$1.type == "noteOn"

// perform conditional operations on an object
$1.value > 20 ? "ok" : "no"

// get the 5th index of an array
$1[5]
```

## Multi-line Expressions

Create variables using `;` to separate statements:

```js
a = $1 * 2;
b = $2 + 3;
a + b
```

You can also
[define functions](https://github.com/silentmatt/expr-eval?tab=readme-ov-file#function-definitions),
e.g. `add(a, b) = a + b`.

## Hot and Cold Inlets

Inlet 0 (`$1`) triggers evaluation; other inlets store values silently.
See [Hot and Cold Inlets](/docs/hot-cold-inlets) for details.

## See Also

- [filter](/docs/objects/filter) - conditional message passing
- [map](/docs/objects/map) - transform messages with JavaScript
- [expr~](/docs/objects/expr~) - audio-rate expression evaluator
