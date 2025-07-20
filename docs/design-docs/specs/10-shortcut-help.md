# 10. Help Menu

On the bottom bar on the right side, add a little "shortcut" menu that opens a modal with all the shortcuts.

Examples of shortcuts we have right now:

- N on an empty canvas to create a new node.
- SHIFT + ENTER in code editor to run a node.

You can use Shadcn for the modal. Example:

```svelte
<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
</script>

<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Are you sure absolutely sure?</Dialog.Title>
      <Dialog.Description>
        This action cannot be undone. This will permanently delete your account
        and remove your data from our servers.
      </Dialog.Description>
    </Dialog.Header>
  </Dialog.Content>
</Dialog.Root>
```

The above is from <https://www.shadcn-svelte.com/docs/components/dialog>
