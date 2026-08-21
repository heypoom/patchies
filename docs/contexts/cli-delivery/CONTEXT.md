# CLI Delivery

CLI Delivery packages the local Patchies command-line client for artists and
developers to install and use with a live Remote Control Session.

## Language

**Patchies CLI**:
The standalone local `patchies` command that mounts and later operates on a
Remote Control Session.
_Avoid_: Agent, server binary

**Embedded Server**:
The standalone `patchies-server` executable that runs the Patchies browser app
and Remote Control relay.
_Avoid_: Patchies CLI, patchies binary

**Release Pair**:
The `patchies` CLI and `patchies-server` assets published from the same Patchies
release tag.
_Avoid_: Lockstep binary version
