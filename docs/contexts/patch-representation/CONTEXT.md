# Patch Representation

Patch Representation is the Git-friendly local filesystem view of the objects that has code representations in one live Patchies patch.

## Language

**Patch Representation**:
The versioned filesystem projection of the code-bearing objects in one live
patch.
_Avoid_: Export, mirror

**Representation Adapter**:
An object-type-owned declarative mapping between represented text files and
named object data fields.
_Avoid_: File plugin, serializer

**Object Metadata**:
Generated read-only data beside a represented object that identifies its type,
adapter version, and represented files.
_Avoid_: Editable manifest, object config

**Authoritative Snapshot**:
The complete current Patch Representation published by the Browser Generation
at a Patch Revision.
_Avoid_: Full sync, initial export

**Remote File Operation**:
An idempotent request to apply one settled represented-file save through the
browser's normal history path.
_Avoid_: Watcher event, filesystem change
