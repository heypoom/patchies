Output `true` when either operand is true.

## Usage

```text
|| false
or false
```

The first inlet is hot. The second inlet stores the right operand without output.
Send `bang` to the first inlet to re-emit using the previous operands.
Numbers behave like `Boolean(number)` in JavaScript: `0` is false and non-zero
numbers are true.

## See Also

- [&&](/docs/objects/and) - boolean AND
- [!](/docs/objects/not) - boolean NOT
- [toggle](/docs/objects/toggle) - boolean switch
- [spigot](/docs/objects/spigot) - message gate
