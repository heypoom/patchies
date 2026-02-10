# Files

![Files sidebar](/content/images/files-sidebar.webp)

The Files panel in the sidebar lets you work with virtual files in your patches.

## Opening the Files Panel

Use `Ctrl/Cmd + B > Files` to show the files panel.

## Adding Files

You can add files to your patch in two ways:

- **Drop into file tree**: Drag files from your system into the Files panel to add them as linked files
- **Drop into patcher**: Drag files directly onto the canvas to create virtual files that are embedded in your patch

## Linking Folders

Click the folder icon to link a local folder. This gives your patch read access to files in that folder, useful for loading images, audio samples, or data files.

**Note**: Linking folders is only supported in Chromium browsers.

## Virtual Files

Files dropped into the patcher become virtual files stored within the patch itself. These files persist when you save or share the patch.

You can also store URLs as virtual files by using the "add link" button.

## Using Files in Code

See [Virtual Filesystem](/docs/virtual-filesystem) for how to load files in your objects with `getVfsUrl()`.

## See Also

- [Virtual Filesystem](/docs/virtual-filesystem) - Loading files in code
- [JavaScript Runner](/docs/javascript-runner)
- [Saves](/docs/manage-saves)
