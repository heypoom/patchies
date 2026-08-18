# 180. Chat VFS Context Tools

**Status**: Implemented

## Problem

Patch agents can inspect canvas state, documentation, presets, and logs, but cannot discover or inspect files stored with the current patch. This prevents an agent from safely using existing code, data, and assets referenced by VFS paths.

## Goals

- Let chat agents list one VFS directory level and recursively search VFS paths.
- Let agents inspect a file's stored size and MIME type when available.
- Let agents read textual file content in bounded, resumable ranges.
- Preserve VFS provider permissions and keep all chat VFS tools read-only.

## Design

The chat resolver exposes four context tools backed by `VirtualFilesystem`:

- `list_vfs_files({ path? })` lists immediate child files and directories.
- `search_vfs_files({ query, path? })` recursively searches paths below a directory.
- `stat_vfs_file({ path })` returns the entry's path, kind, provider, stored size, and MIME type.
- `read_vfs_text({ path, offset?, length? })` returns a textual byte range.

Relative paths are resolved under `user://`, while explicit `user://` and `obj://` paths remain intact. The tools use the existing VFS listing, search, metadata, and resolution APIs, so linked local folders retain their existing permission checks.

`read_vfs_text` accepts known textual MIME types and source/data extensions. It refuses binary formats, including images, audio, and video. Reads default to 16 KiB and are capped at 32 KiB. The result reports `offset`, `bytesRead`, `size`, and `truncated`, allowing the agent to request the next range without overflowing the chat context.

## Acceptance Criteria

1. An agent can list and search the patch VFS without mutating it.
2. An agent can inspect stored file metadata before reading content.
3. An agent can read a partial text range and continue when `truncated` is true.
4. An agent cannot read a binary VFS asset through the text tool.
