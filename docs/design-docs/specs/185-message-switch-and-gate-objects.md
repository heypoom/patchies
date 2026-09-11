# 185. Message Switch and Gate Objects

## Summary

Replace the existing visual `switch` with Max-style message-routing `switch`
and `gate` objects. Rename the existing visual boolean control to
`toggleswitch` and keep it available from the User Interfaces pack.

## Behavior

- `switch <count>` has `<count>` data inlets and one selector inlet. Its
  selector is one-based: the selected data inlet passes messages to its only
  outlet; `0` or an out-of-range value blocks all input.
- `gate <count>` has a selector inlet and one data inlet. Its one-based
  selector routes the data inlet to the corresponding outlet; `0` or an
  out-of-range value blocks all output.
- Both objects default to two routes when no valid positive integer argument
  is supplied.

## Catalog

`switch` and `gate` belong to the Control pack alongside `spigot`.
`toggleswitch` belongs to the User Interfaces pack. This is a breaking rename:
existing visual `switch` nodes are not migrated.

## Verification

- Unit tests cover default and argument-defined port counts, one-based
  selection, closed routing, and out-of-range selection.
- Generated schemas expose the representative default ports for documentation
  and object discovery.
