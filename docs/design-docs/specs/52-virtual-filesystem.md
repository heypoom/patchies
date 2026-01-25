# 52. Virtual Filesystem

I wanted the ability to persist, browse and resolve files in a virtual file system.

## Goals

- I want to be able to have a virtual filesystem with directories and files
- I want to be able to resolve the content of folders and files from many providers
  - example: some files might be resolved from a static url, while other files and folders may need to be loaded from user's filesystem
- I want to be able to visually browse that filesystem
  - e.g. with "Command Palette > Browse Files"
  - should show up in a collapsible sidebar on the left side
  - See files and directories in a tree structure
  - Be able to view files. See images and hear audio files.
  - Create and delete files and directories
  - Set a "provider" on where to load a specific file or directory
    - e.g. you might load video.mp4 from a URL, but you might load super-secret.jpeg from your own local filesystem
- The UI should be able to show "unmapped files"
- API-wise, it should be easy to write your own provider.
  - Ideally we have a class for providers e.g. `LocalFilesystemProvider`, `UrlProvider`

## Providers

- Local Filesystem: use the `Filesystem` browser API to map the virtual filesystem file and folder to the user's local folder
  - default when the file dragged into the canvas or obj
- URL: load that file content from a given URL
  - creating an object with a default url e.g. `img <url>` should use the URL provider automatically
  - using a message to set the url should use the URL provider automatically
- (Future) cloud providers: dragging a file into Patchies can upload it to a default cloud provider automatically e.g. S3, Minio

## Example

```txt
/user
  /images
    /poom.jpg  -- {provider: 'url', url: 'https://poom.dev/cool'}
  /secrets     -- {provider: 'local'}
```

## Design Ideas

- Each object must only store the virtual filesystem path, it must not store the file object.
- Create a singleton class `VirtualFilesystem` for accessing the virtual filesystem.
- Patchies vfs has two prefixes:
  - `user://` is for user uploaded files. example: `user://images/poom.jpg`
  - `obj://` is for files associated with obj, using `/<object-id>` as prefixes.
    - example: `obj://chuck~-24` contains filesystem for a ChucK object
    - example: `obj://elem~-36` contains filesystem for an Elementary Audio object
    - example: `obj://csound~-42` contains filesystem for a Csound object
    - only some node will have a virtual node filesystem, such as `chuck~` and `elem~` and `csound~`
  - the prefixes helps us to check if it is a virtual filesystem path, or an already resolved path.
- In the saved patches, we should also store a `files` mapping as well, with top-level namespaces `user` and `obj`:

```ts
{
    "nodes": [],
    "edges": [],
    "files": {
        "user": {
            "images": {
                "poom.mp4": {
                    provider: "url",
                    url: "https://"
                },
                "foobar.mp4": {
                    provider: "local",
                },
            }
        }
    }
}
```

## Integration Paths

- persist uploaded media in media source objects
  - images (`img`)
  - video (`video`)
  - sound (`soundfile~`)
  - this is *highest priority* to implement.

### p5 integration

- methods to inject: `loadImage`, `createVideo`, `loadFont`, `loadSound`, `loadJSON`, `loadModel`
- example: `loadImage` should be injected with our special function to support VFS, e.g. `await loadImage('user://images/poom.jpg')`
- only resolve through VFS if the vfs prefix i.e. `user://` is available

### chuck~ integration

chuck~: integrate with chuck's fs methods

- we create special directory `/obj/` to store node-specific filesystem
- e.g. `mount://obj/`
- we then call chuck methods to sync filesystem
- `chuck.createDirectory(parent, name)`
- `chuck.createFile(directory, filename, data: string | ArrayBuffer)` -- creates a file in chuck's VFS
- we should add a message to `chuck~` to interact with vfs
- `{type: 'runFile', filename: string, args?: string}` -- run a ChucK file e.g. `{type: 'runFile', filename: './hello.ck', args: '1:2:foo'}`
  - no args use `chuck.runFile`, has args use `chuck.runFileWithArgs`
- `{type: 'replaceFile', filename: string, args?: string}` -- replace last shred with a ChucK file e.g. `{type: 'replaceFile', filename: './hello.ck', args: '1:2:foo'}`
  - no args use `chuck.replaceFile`, has args use `chuck.replaceFileWithArgs`

### elem~ integration

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

### csound~ integration

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

- Recorded samples in sampler~
- Guest upload mode with a really tiny file size limit and rate limiting
