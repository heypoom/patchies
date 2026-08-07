# Message Control Headless Migration

## Objective

Move `trigger`, `curve`, and `msg` message behavior out of their Svelte views so
the objects continue to work while their views are unmounted.

## Key Challenges & Solutions

- `trigger` and `msg` use dynamic ports. The runtime objects now derive their
  ports from object-shaped node data while preserving existing message handle
  IDs.
- `msg` shorthand parsing depends on connected target types. `ObjectContext`
  now exposes a read-only target-type query backed by the message runtime, so
  parsing does not depend on XYFlow or a mounted view.
- `msg` placeholder values must survive view unmounts without becoming saved
  patch data. They now live as private runtime object state.
- Curve array schemas use `minItems`. The TypeBox source emitter now preserves
  array length constraints in generated schemas.

## What Could Be Better

- The migration still requires coordinated edits to the visual-object registry,
  schema registry, and generated schema artifact.
- Dynamic port metadata is split between a static schema entry and instance
  methods. A future registry interface could make that relationship clearer.

## Action Items

- Use the same runtime-owned target-type query for future objects whose message
  parsing depends on downstream schemas.
- Keep transient message state inside runtime objects unless it is intentionally
  part of saved patch data.
