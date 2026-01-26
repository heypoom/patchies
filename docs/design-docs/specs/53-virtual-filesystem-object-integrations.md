# 53. Virtual Filesystem Object Integrations

Now that we have implemented [the virtual filesystem](./52-virtual-filesystem.md), we need to integrate it with the various objects in Patchies. For many nodes, this is done by using the `objects` namespace (`obj://<object-id>/...`).

## p5 integration

- methods to inject: `loadImage`, `createVideo`, `loadFont`, `loadSound`, `loadJSON`, `loadModel`
- example: `loadImage` should be injected with our special function to support VFS, e.g. `await loadImage('user://images/poom.jpg')`
- only resolve through VFS if the vfs prefix i.e. `user://` is available

## chuck~ integration

chuck~: integrate with chuck's fs methods

- we create special namespace `/obj` to store node-specific filesystem, e.g. `obj://chuck~-20/hello.ck`
- we then call chuck methods to sync filesystem
- `chuck.createDirectory(parent, name)`
- `chuck.createFile(directory, filename, data: string | ArrayBuffer)` -- creates a file in chuck's VFS
- we should add a message to `chuck~` to interact with vfs
- `{type: 'runFile', filename: string, args?: string}` -- run a ChucK file e.g. `{type: 'runFile', filename: './hello.ck', args: '1:2:foo'}`
  - no args use `chuck.runFile`, has args use `chuck.runFileWithArgs`
- `{type: 'replaceFile', filename: string, args?: string}` -- replace last shred with a ChucK file e.g. `{type: 'replaceFile', filename: './hello.ck', args: '1:2:foo'}`
  - no args use `chuck.replaceFile`, has args use `chuck.replaceFileWithArgs`

## elem~ integration

integrate with Elementary Audio's virtual filesystem

- docs: <https://www.elementary.audio/docs/guides/Virtual_File_System>
- `core.updateVirtualFileSystem(fs: Object<string, Float32Array | Float32Array[]))`
- `core.listVirtualFileSystem() -> string[]`
- `core.pruneVirtualFileSystem`

we will need additional parsing here for `elem~` as the audio data has to be decoded, e.g.

```ts
let res = await fetch(...);
let sampleBuffer = await ctx.decodeAudioData(await res.arrayBuffer());

core.updateVirtualFileSystem({
  'sample0': [sampleBuffer.getChannelData(0), sampleBuffer.getChannelData(1)],
});
```

## csound~ integration

csound~: integrate with CSound's virtual filesystem

- We should be able to synchronize csound filesystem with Patchies' virtual filesystem
- You can access csound filesystem with `csound.fs` which returns this object:

```ts
declare interface CsoundFs {
  appendFile: (path: string, file: Uint8Array) => Promise<void>;
  writeFile: (path: string, file: Uint8Array) => Promise<void>;
  readFile: (path: string) => Promise<Uint8Array>;
  unlink: (path: string) => Promise<void>;
  readdir: (path: string) => Promise<string[]>;
  mkdir: (path: string) => Promise<void>;
  stat: (path: string) => Promise<CsoundFsStat | undefined>;
  pathExists: (path: string) => Promise<boolean>;
}
```

## Future Ideas

- Guest upload mode with a really tiny file size limit and rate limiting
