# Current Node Data Updates

## Objective

Prevent synchronous editor updates from overwriting each other when several messages or UI actions target one node before its Svelte props refresh.

## Key Challenges & Solutions

XYFlow's `updateNodeData` functional form can read from a node lookup that lags behind the current nodes array during same-turn fan-out. The shared `useUpdateNodeData` composable binds the current flow instance to a pure updater that performs read-modify-write changes through `updateNode`, whose callback receives the current node being reduced.

The audit separated two update shapes:

- Independent fields now use partial `updateNodeData` writes.
- Collection edits, counters, toggles, and normalized controls derive from the current node snapshot.

This distinction removed stale whole-data spreads without forcing every simple update through the new helper.

## What Could Be Better

The upstream flow API exposes two functional update paths with subtly different freshness behavior. The local helper documents the safe path, but future call sites still need to choose the correct update shape.

## Action Items

- Use partial data writes for independent fields.
- Use `useUpdateNodeData` for read-modify-write operations in Svelte components.
- Keep regression coverage for same-turn message fan-out and sequential collection updates.
