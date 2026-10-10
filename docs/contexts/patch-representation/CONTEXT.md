# Patch Representation

Patch Representation is the local filesystem view of the Objects and Patch VFS namespaces in one live Patchies patch.

## Language

**Patch Representation**:
The versioned filesystem projection of `obj://` as `objects/` and `patch://`
as `patch/`, with the same files and directories as the browser VFS tree.
_Avoid_: Export, mirror

**Object File Projection**:
The shared VFS projection that determines which objects expose editable source
files and their names. Remote Control consumes this projection rather than
maintaining its own adapters or generating metadata files.

**Authoritative Snapshot**:
The complete current Patch Representation published by the Browser Generation
at a Patch Revision.
_Avoid_: Full sync, initial export

**Remote File Operation**:
An idempotent request to apply one settled represented-file save through the
browser's normal history path.
_Avoid_: Watcher event, filesystem change
