# Remote Control

Remote Control lets a local client act on one live Patchies patch through a
user-enabled, server-mediated session.

## Language

**Remote Control Session**:
A user-enabled, server-mediated authority boundary for one live Patchies patch.
_Avoid_: Connection, mount session

**Connection String**:
A versioned opaque value that gives a local client the instance location and
credential needed to join a Remote Control Session.
_Avoid_: Token URL, endpoint token

**Browser Generation**:
The identity of one loaded browser instance that has reclaimed authority for a
Remote Control Session.
_Avoid_: Tab ID, client ID

**Mutating Client**:
The sole local CLI or agent endpoint currently permitted to request changes to
a Remote Control Session.
_Avoid_: Writer, controller

**Patch Revision**:
The browser-authoritative ordering value for the content of a patch in a
Remote Control Session.
_Avoid_: Event ID, sync version

**Session Trace**:
A bounded, redacted sequence of Remote Control Session lifecycle and operation
outcomes available for troubleshooting.
_Avoid_: Server log, debug dump
