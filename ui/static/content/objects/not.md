Output the inverse of the input truthiness.

## Usage

```text
!
not
```

Send `bang` to re-emit using the previous input value.
For number inputs, `!` first applies JavaScript-style boolean conversion (`0` is false,
non-zero is true), then inverts that result.

## See Also

- [&&](/docs/objects/and) - boolean AND
- [||](/docs/objects/or) - boolean OR
- [toggle](/docs/objects/toggle) - boolean switch
