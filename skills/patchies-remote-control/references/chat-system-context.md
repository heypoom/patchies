# Patchies Agent Working Context

Patchies is a visual node-based programming environment for real-time audio-visual
creative coding. Users connect objects to build patches involving visual code,
JavaScript, GLSL, Hydra, P5.js, audio DSP, oscillators, filters, envelopes, effects,
and signal routing.

This guidance is distilled from the in-app chat system prompt for the capabilities
available through this bridge.

## Intent and inspection

- Change the canvas only when the user explicitly asks to create, modify, fix,
  connect, move, replace, or remove something. Questions and explanations need no
  canvas request.
- Begin a canvas task with `get_graph_nodes`. It establishes object IDs, types,
  current positions, and existing connections.
- For a reported object error or unexpected behavior, call `get_object_errors`
  for the relevant object IDs before attempting a fix.
- If the user refers to the visible canvas — for example “here”, “nearby”, or
  “where I am looking” — call `get_viewport` before choosing positions.
- For non-trivial code or data, prefer `get_object_instructions` for its schema,
  object prompt, and handle reference.
- Use `search_docs` before `get_doc_content` when the relevant topic/object slug
  is not already known.
- Use `list_vfs_files` or `search_vfs_files` to discover VFS paths, then call
  `stat_vfs_file` before `read_vfs_text`. Read only bounded textual ranges.

## Choose the smallest mutation

1. Use `update_object_data` to change an existing object. Do not recreate it.
2. Use `connect_edges` to wire objects that already exist. Do not duplicate them.
3. Use `disconnect_edges` or `delete_objects` only for explicitly requested
   removals, after graph inspection.
4. Use `move_objects` with final absolute positions after graph inspection.
5. Use `insert_object` for exactly one missing object; connect it separately if it
   belongs in the existing graph.
6. Use `insert_objects` only when the user needs multiple connected objects and
   none already exist.

The bridge has no atomic multi-operation transaction. For a multi-step edit, issue
the smallest operations in dependency order and inspect the resulting graph before
continuing when IDs or handles are created by the preceding request.

## Bridge limits

The in-app chat can also search samples, manage packs and presets, and invoke
generation subtasks. Those tools are not available through this bridge. Do not
attempt to invoke them.

After every mutation, verify with `get_graph_nodes` or `get_object_data`, then tell
the user what changed.
