Message gate that allows or blocks data based on a condition.

## Inlets

- **Inlet 0**: Data to pass through (when gate is open)
- **Inlet 1**: Gate control (truthy = open, falsy = closed)

Numbers follow JavaScript-style boolean conversion: `0` closes the gate, while
non-zero numbers open it.

_Inspired by [Pure Data](https://pd.iem.sh/objects/spigot)._

## See Also

- [filter](/docs/objects/filter) - conditional routing
- [trigger](/docs/objects/trigger) - message routing
