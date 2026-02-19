Executes [UIUA](https://www.uiua.org/) code, a stack-based array programming language.

Use `$1`, `$2`, etc. as placeholders for inlet values
that get substituted before evaluation.

## Hot/Cold Inlet Pattern

- **$1 (hot)**: First inlet triggers evaluation when it receives a value
- **$2, $3, ...** (cold): Store values but don't trigger evaluation

## Examples

### Basic arithmetic

```txt
+ $1 $2
```

Connect two number sources. When `$1` receives a value,
the sum is computed and output.

### Array operations

```txt
/+ $1
```

Sum all elements in an array received at `$1`.

### Reverse an array

```txt
⇌ $1
```

### Generate range

```txt
⇡ $1
```

Creates an array from 0 to n-1.

## UIUA Syntax

UIUA uses Unicode glyphs for operations:

- `+` `-` `×` `÷` - arithmetic
- `⇡` - range (iota)
- `⇌` - reverse
- `/` - reduce
- `\` - scan
- `≡` - rows (map)
- `⊂` - join
- `⊏` - select

Negative numbers use `¯` (not `-`): `¯5` means -5.

## Auto-formatting

Press Shift+Enter to format your code using UIUA's built-in formatter.

## See also

- [UIUA documentation](https://www.uiua.org/docs)
- [UIUA tutorial](https://www.uiua.org/tutorial/introduction)
