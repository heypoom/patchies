Tests input against a list of values and outputs a bang on the matching outlet. Non-matching input is passed through the rightmost outlet.

Alias: `sel`

## Usage

```text
select <value1> <value2> ...
sel <value1> <value2> ...
```

## Arguments

Values to match against. Can be numbers or strings.

- `select 1 2 3` - match against 1, 2, or 3 (4 outlets: bang for each value + pass-through)
- `select hello` - match against "hello" (2 outlets: bang on match + pass-through)

## Examples

`select 1 2 3` receives the number `2`:

1. Outlet 0: nothing (1 didn't match)
2. Outlet 1: bang (2 matched)
3. Outlet 2: nothing (3 didn't match)
4. Outlet 3: nothing (no pass-through needed)

`select 1 2 3` receives the number `5`:

1. Outlets 0-2: nothing (no match)
2. Outlet 3 (rightmost): passes `5` through

## Single-Argument Mode

When created with a single argument (e.g., `select 10`), inlet 1 lets you update the match value dynamically without recreating the object.

## See Also

- [spigot](/docs/objects/spigot) - message gate
- [trigger](/docs/objects/trigger) - message routing
- [filter](/docs/objects/filter) - conditional routing
