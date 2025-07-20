# 9. Insert Object Palette

Right now we have to drag and drop objects from the bottom bar to the canvas, which is pretty slow. I want to be able to hit "N" on the XYFlow canvas, to open a menu that allows me to insert an object at mouse cursor.

This should be almost identical to the Max/MSP or PureData object palette, where you can type to search for an object, and hit enter to insert it.

It should be very snappy and fast: I should be able to hit "N" (short for new object), type "js", hit enter, and have a the `js` object inserted into the canvas at my cursor position immediately.

If I type `hyd`, it should show me a list of all objects that includes the string `hyd` (e.g. `hydra` in our case), and I can select one of them with the arrow keys, or by clicking on it with the mouse. If I hit enter, it should insert the selected object at my cursor position.
