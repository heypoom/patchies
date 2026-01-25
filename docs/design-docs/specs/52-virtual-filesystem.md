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
  - default when the file dragged into the canvas or nodes
- URL: load that file content from a given URL
  - creating an object with a default url e.g. `img <url>` should use the URL provider automatically
  - using a message to set the url should use the URL provider automatically
- (Future) cloud providers: dragging a file into Patchies can upload it to a default cloud provider automatically e.g. S3, Minio

## Example

```txt
/ (root)
  /images
    /poom.jpg {provider: 'url', url: 'https://poom.dev/cool'}
  /secrets {provider: 'fs'}
```

## Design Ideas

- Each object only stores the virtual filesystem path, it must not store the file object.
- Patchies vfs has two prefixes:
  - `user://` is for user uploaded files. example: `user://images/poom.jpg`
  - `nodes://` is for files associated with nodes, using `/<node-id>` as prefixes.
    - example: `nodes://chuck~-24` contains filesystem for ChucK
    - example: `nodes://elem~-36` contains filesystem for Elementary Audio
    - only some node will have a virtual node filesystem, such as `chuck~` and `elem~`
  - the prefixes helps us to check if it is a virtual filesystem path, or an already resolved path.

## Integration Paths

- persist uploaded media in media source objects
  - images (`img`)
  - video (`video`)
  - sound (`soundfile~`)
  - this is *highest priority* to implement.

- P5.js (`p5`)
  - `loadImage` should be injected with our special function to support VFS, e.g. `await loadImage('mount://images/poom.jpg')`
  - `createVideo` as well, e.g. `await createVideo('mount://videos/poom.mp4')`

- chuck~: integrate with chuck's fs methods
  - we create special directory `/nodes/` to store node-specific filesystem
    - e.g. `mount://nodes/`
  - we then call chuck methods to sync filesystem
    - `chuck.createDirectory(parent, name)`
    - `chuck.createFile(directory, filename, data: string | ArrayBuffer)` -- creates a file in chuck's VFS
  - we should add a message to `chuck~` to interact with vfs
    - `{type: 'runFile', filename: string, args?: string}` -- run a ChucK file e.g. `{type: 'runFile', filename: './hello.ck', args: '1:2:foo'}`
      - no args use `chuck.runFile`, has args use `chuck.runFileWithArgs`
    - `{type: 'replaceFile', filename: string, args?: string}` -- replace last shred with a ChucK file e.g. `{type: 'replaceFile', filename: './hello.ck', args: '1:2:foo'}`
      - no args use `chuck.replaceFile`, has args use `chuck.replaceFileWithArgs`

- elem~: integrate with Elementary Audio's virtual filesystem
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

- csound~: integrate with CSound's virtual filesystem

## Future Ideas

- Recorded samples in sampler~
- Guest upload mode with a really tiny file size limit and rate limiting
