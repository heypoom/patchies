# Registries (V2)

When registering a new entity (e.g. audio nodes, text objects, shorthands), we want to create registries for them.

Reason is to store registry-related logic (e.g. getters) there, as well as to make dynamic registration possible in a variety of cases:

- defining new audio nodes and text objects dynamically in the `js` object
- using headless patchies to call `AudioRegistry` to register new objects dynamically
- using plugin marketplaces to register new objects dynamically

This should allow them to define things like object presets and object shorthands as well.
