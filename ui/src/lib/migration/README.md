# Migrations

We regularly update the name of objects and the name of handles, which affects the XYFlow nodes and edges in the saved data.

When a patch is loaded, we run the migration to ensure that we maintain backwards compatibility for older patches created with older versions of Patchies.

## When to create migrations

You MUST create a new migration files in `migrations/` whenever you make changes to `<StandardHandle>` in any objects. If it caused the name of the edge to be changed, that's 100% a breaking change.

## What we cannot guarantee by migrations

- Changes in the _libraries_ that each objects are built on top of. Best case we may be able to run some codemod to smooth things over, but usually this will be a breaking change that requires you to use an earlier version of Patchies, or the patcher dynamically loads a specific version for you.
  - This might be a good idea for things like Three.js, where each minor bump can break everything.
