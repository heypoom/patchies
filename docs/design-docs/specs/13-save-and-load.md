# 13. Save and Load

Add ability to serialize and serialize the patch to JSON file.

## Step 1: Command Palette

- Add a command palette that is accessible via `CMD + K`. The command palette should have search bar, similar to the existing Object Palette.
  - For now, there should be four commands:
    - "Save to File" saves the current patch to a single JSON file. You can use the current timestamp as the file name.
    - "Load from File" loads a patch from a JSON file. You can open the system file picker to select a file.
    - "Save" saves the current patch to local storage. You should ask the user for a patch name.
    - "Load" loads a patch from local storage. The user must specify a patch name.
- The command palette is **multi-stage**, like Raycast.
  - If you select "Save", it will change the command palette UI to ask for a patch name: "What is the name of the patch?".
  - If you select "Load", it will change the command palette UI to list all saved patches in local storage and ask the user to select one. You can either search for a patch name or select one from the list, with arrow keys or mouse.
  - Do not use functions like `prompt()` or `alert()`. Do not use any dialogs or modals for multi-stage commands. Use the command palette UI to ask for input for speed and ease of use.
  - If you hit "escape" while during the second stage of the command palette, it should return to the first stage. If you are in the first stage and hit "escape", it should close the command palette.
- Update the ShortcutHelp component to include the "CMD+K" shortcut for the command palette.

## Step 2: Save and Load

- Make sure that the code's state is part of the XYFlow node, not a Svelte state. For example, the `hydra` node still has the code as a local Svelte state, which is not serializable. Let's make sure to persist the code in the XYFlow node data.
- Implement the serialization logic to convert the current patch into a JSON object that can be saved to a file.
  - The JSON should include all nodes, their properties, and connections.
  - Ensure that the serialization handles all node types and their specific properties correctly.
- Implement the deserialization logic to load a patch from a JSON object.
- Implement the above four command palette commands using the serialization and deserialization logic we've created.
  - For "Save to File", convert the current patch to JSON and save it to a file with the current timestamp as the name.
  - For "Load from File", read a JSON file, parse it, and load the patch into the XYFlow.
  - For "Save", serialize the current patch and store it in local storage with the user-defined name.
  - For "Load", retrieve the patch from local storage based on the user-selected name and deserialize it into the XYFlow.
