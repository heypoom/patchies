Output `true` when the incoming value is not strictly equal to the stored operand.

## Usage

```text
!= 0
neq 0
```

The first inlet is hot. The second inlet stores the comparison value without output.
Send `bang` to the first inlet to re-emit using the previous values.
Strict equality means `1` and `"1"` are different.

## See Also

- [==](/docs/objects/eq) - strict equality
- [select](/docs/objects/select) - bang on matching values
- [expr](/docs/objects/expr) - expression evaluator
