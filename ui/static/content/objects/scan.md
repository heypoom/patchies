Accumulate values over time using a JavaScript expression.

- `$1` is the accumulator (previous result)
- `$2` is the new input value

The result becomes the new accumulator and is sent to the outlet.

This is similar to [RxJS' scan operator](https://rxjs.dev/api/operators/scan), or
[JavaScript's reduce method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce).

## Examples

```js
// Running sum
$1 + $2

// Running maximum
Math.max($1, $2)

// Collect values into array
[...$1, $2]

// Count messages
$1 + 1

// Running average (with count in accumulator)
{ sum: $1.sum + $2, count: $1.count + 1 }
```

## Inlets

- **Inlet 0**: Input value (`$2`) - triggers evaluation
- **Inlet 1**: Reset/set accumulator - send `bang` to reset to initial value,
  or send a value to set the accumulator directly

The first input initializes the accumulator (unless `initialValue` is set in
data).

## See Also

- [expr](/docs/objects/expr) - expression evaluator
- [uniq](/docs/objects/uniq) - filter consecutive duplicates
