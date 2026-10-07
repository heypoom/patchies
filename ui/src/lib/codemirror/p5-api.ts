// Generated from p5 2.1.2 (LGPL-2.1); see https://github.com/processing/p5.js.
// Regenerate: bun scripts/generate-p5-completions.ts
// Cross-check public API names at https://p5js.org/reference/.
export const p5ApiEntries: [label: string, type: string, detail: string, info: string][] = [
  ['p5.registerAddon', 'function', '(library: Function) => void', 'Loads a p5.js library.'],
  [
    'describe',
    'function',
    '(text: string, display?: typeof p5.FALLBACK | typeof p5.LABEL) => void',
    'Creates a screen reader-accessible description of the canvas.'
  ],
  [
    'describeElement',
    'function',
    '(name: string, text: string, display?: typeof p5.FALLBACK | typeof p5.LABEL) => void',
    'Creates a screen reader-accessible description of elements in the canvas.'
  ],
  [
    'textOutput',
    'function',
    '(display?: typeof p5.FALLBACK | typeof p5.LABEL) => void',
    'Creates a screen reader-accessible description of shapes on the canvas.'
  ],
  [
    'gridOutput',
    'function',
    '(display?: typeof p5.FALLBACK | typeof p5.LABEL) => void',
    'Creates a screen reader-accessible description of shapes on the canvas.'
  ],
  [
    'remove',
    'function',
    '() => void | () => void | () => void | () => void',
    'Removes the sketch from the web page.'
  ],
  [
    'p5',
    'function',
    '(sketch: object, node: string | HTMLElement) => void',
    'Creates a new sketch in "instance" mode.'
  ],
  [
    'color',
    'function',
    '(gray: number, alpha?: number) => p5.Color | (v1: number, v2: number, v3: number, alpha?: number) => p5.Color | (value: string) => p5.Color | (values: number[]) => p5.Color | (color: p5.Color) => p5.Color',
    'Creates a p5.Color object.'
  ],
  [
    'red',
    'function',
    '(color: p5.Color | number[] | string) => number',
    'Gets the red value of a color.'
  ],
  [
    'green',
    'function',
    '(color: p5.Color | number[] | string) => number',
    'Gets the green value of a color.'
  ],
  [
    'blue',
    'function',
    '(color: p5.Color | number[] | string) => number',
    'Gets the blue value of a color.'
  ],
  [
    'alpha',
    'function',
    '(color: p5.Color | number[] | string) => number',
    'Gets the alpha (transparency) value of a color.'
  ],
  [
    'hue',
    'function',
    '(color: p5.Color | number[] | string) => number',
    'Gets the hue value of a color.'
  ],
  [
    'saturation',
    'function',
    '(color: p5.Color | number[] | string) => number',
    'Gets the saturation value of a color.'
  ],
  [
    'brightness',
    'function',
    '(color: p5.Color | number[] | string) => number',
    'Gets the brightness value of a color.'
  ],
  [
    'lightness',
    'function',
    '(color: p5.Color | number[] | string) => number',
    'Gets the lightness value of a color.'
  ],
  [
    'lerpColor',
    'function',
    '(c1: p5.Color, c2: p5.Color, amt: number) => p5.Color',
    'Blends two colors to find a third color between them.'
  ],
  [
    'paletteLerp',
    'function',
    '(colors_stops: [p5.Color | string | number | number[], number][], amt: number) => p5.Color',
    'Blends multiple colors to find a color between them.'
  ],
  [
    'beginClip',
    'function',
    '(options?: { invert?: boolean }) => void',
    'Starts defining a shape that will mask any shapes drawn afterward.'
  ],
  ['endClip', 'function', '() => void', 'Ends defining a mask that was started with beginClip().'],
  [
    'clip',
    'function',
    '(callback: Function, options?: { invert?: boolean }) => void',
    'Defines a shape that will mask any shapes drawn afterward.'
  ],
  [
    'background',
    'function',
    '(color: p5.Color) => void | (colorstring: string, a?: number) => void | (gray: number, a?: number) => void | (v1: number, v2: number, v3: number, a?: number) => void | (values: number[]) => void | (image: p5.Image, a?: number) => void',
    'Sets the color used for the background of the canvas.'
  ],
  [
    'clear',
    'function',
    '(r?: number, g?: number, b?: number, a?: number) => void | () => void',
    'Clears the pixels on the canvas.'
  ],
  [
    'colorMode',
    'function',
    '(mode: typeof p5.RGB | typeof p5.HSB | typeof p5.HSL | typeof p5.RGBHDR | typeof p5.HWB | typeof p5.LAB | typeof p5.LCH | typeof p5.OKLAB | typeof p5.OKLCH, max?: number) => typeof p5.RGB | typeof p5.HSB | typeof p5.HSL | typeof p5.RGBHDR | typeof p5.HWB | typeof p5.LAB | typeof p5.LCH | typeof p5.OKLAB | typeof p5.OKLCH | (mode: typeof p5.RGB | typeof p5.HSB | typeof p5.HSL | typeof p5.RGBHDR | typeof p5.HWB | typeof p5.LAB | typeof p5.LCH | typeof p5.OKLAB | typeof p5.OKLCH, max1: number, max2: number, max3: number, maxA?: number) => typeof p5.RGB | typeof p5.HSB | typeof p5.HSL | typeof p5.RGBHDR | typeof p5.HWB | typeof p5.LAB | typeof p5.LCH | typeof p5.OKLAB | typeof p5.OKLCH | () => typeof p5.RGB | typeof p5.HSB | typeof p5.HSL | typeof p5.RGBHDR | typeof p5.HWB | typeof p5.LAB | typeof p5.LCH | typeof p5.OKLAB | typeof p5.OKLCH',
    'Changes the way color values are interpreted.'
  ],
  [
    'fill',
    'function',
    '(v1: number, v2: number, v3: number, alpha?: number) => void | (value: string) => void | (gray: number, alpha?: number) => void | (values: number[]) => void | (color: p5.Color) => void',
    'Sets the color used to fill shapes.'
  ],
  ['noFill', 'function', '() => void', 'Disables setting the fill color for shapes.'],
  [
    'noStroke',
    'function',
    '() => void',
    'Disables drawing points, lines, and the outlines of shapes.'
  ],
  [
    'stroke',
    'function',
    '(v1: number, v2: number, v3: number, alpha?: number) => void | (value: string) => void | (gray: number, alpha?: number) => void | (values: number[]) => void | (color: p5.Color) => void',
    'Sets the color used to draw points, lines, and the outlines of shapes.'
  ],
  [
    'erase',
    'function',
    '(strengthFill?: number, strengthStroke?: number) => void',
    'Starts using shapes to erase parts of the canvas.'
  ],
  ['noErase', 'function', '() => void', 'Ends erasing that was started with erase().'],
  [
    'blendMode',
    'function',
    '(mode: typeof p5.BLEND | typeof p5.DARKEST | typeof p5.LIGHTEST | typeof p5.DIFFERENCE | typeof p5.MULTIPLY | typeof p5.EXCLUSION | typeof p5.SCREEN | typeof p5.REPLACE | typeof p5.OVERLAY | typeof p5.HARD_LIGHT | typeof p5.SOFT_LIGHT | typeof p5.DODGE | typeof p5.BURN | typeof p5.ADD | typeof p5.REMOVE | typeof p5.SUBTRACT) => void',
    'Sets the way colors blend when added to the canvas.'
  ],
  [
    'print',
    'function',
    '(contents: any) => void | (data: string | number | any[]) => void',
    "Displays text in the web browser's console."
  ],
  [
    'cursor',
    'function',
    '(type: typeof p5.ARROW | typeof p5.CROSS | typeof p5.HAND | typeof p5.MOVE | typeof p5.TEXT | typeof p5.WAIT | string, x?: number, y?: number) => void',
    "Changes the cursor's appearance."
  ],
  [
    'frameRate',
    'function',
    '(fps: number) => number | () => number',
    'Sets the number of frames to draw per second.'
  ],
  ['getTargetFrameRate', 'function', '() => number', 'Returns the target frame rate.'],
  ['noCursor', 'function', '() => void', 'Hides the cursor from view.'],
  [
    'windowResized',
    'function',
    '(event?: Event) => void',
    "A function that's called when the browser window is resized."
  ],
  [
    'fullscreen',
    'function',
    '(val?: boolean) => boolean',
    'Toggles full-screen mode or returns the current mode.'
  ],
  [
    'pixelDensity',
    'function',
    '(val?: number) => number | () => number',
    'Sets the pixel density or returns the current density.'
  ],
  ['displayDensity', 'function', '() => number', "Returns the display's current pixel density."],
  ['getURL', 'function', '() => string', "Returns the sketch's current URL as a string."],
  [
    'getURLPath',
    'function',
    '() => string[]',
    'Returns the current URL path as a list of strings.'
  ],
  ['getURLParams', 'function', '() => object', 'Returns the current URL parameters in an object.'],
  [
    'worldToScreen',
    'function',
    '(x: number | p5.Vector, y: number, z?: number) => p5.Vector',
    'Converts 3D world coordinates to 2D screen coordinates.'
  ],
  [
    'screenToWorld',
    'function',
    '(x: number | p5.Vector, y: number, z?: number) => p5.Vector',
    'Converts 2D screen coordinates to 3D world coordinates.'
  ],
  [
    'setup',
    'function',
    '() => void',
    "A function that's called once when the sketch begins running."
  ],
  ['draw', 'function', '() => void', "A function that's called repeatedly while the sketch runs."],
  [
    'createCanvas',
    'function',
    '(width?: number, height?: number, renderer?: typeof p5.P2D | typeof p5.WEBGL | typeof p5.P2DHDR, canvas?: HTMLCanvasElement) => p5.Renderer | (width?: number, height?: number, canvas?: HTMLCanvasElement) => p5.Renderer',
    'Creates a canvas element on the web page.'
  ],
  [
    'resizeCanvas',
    'function',
    '(width: number, height: number, noRedraw?: boolean) => void',
    'Resizes the canvas to a given width and height.'
  ],
  ['noCanvas', 'function', '() => void', 'Removes the default canvas.'],
  [
    'createGraphics',
    'function',
    '(width: number, height: number, renderer?: typeof p5.P2D | typeof p5.WEBGL, canvas?: HTMLCanvasElement) => p5.Graphics | (width: number, height: number, canvas?: HTMLCanvasElement) => p5.Graphics',
    'Creates a p5.Graphics object.'
  ],
  [
    'createFramebuffer',
    'function',
    '(options?: { format?: typeof p5.UNSIGNED_BYTE | typeof p5.FLOAT | typeof p5.HALF_FLOAT; channels?: typeof p5.RGB | typeof p5.RGBA; depth?: boolean; depthFormat?: typeof p5.UNSIGNED_INT | typeof p5.FLOAT; stencil?: boolean; antialias?: boolean | number; width?: number; height?: number; density?: number; textureFiltering?: typeof p5.LINEAR | typeof p5.NEAREST }) => p5.Framebuffer',
    'Creates and a new p5.Framebuffer object.'
  ],
  ['clearDepth', 'function', '(depth?: number) => void', 'Clears the depth buffer in WebGL mode.'],
  ['noLoop', 'function', '() => void', 'Stops the code in draw() from running repeatedly.'],
  ['loop', 'function', '() => void', 'Resumes the draw loop after noLoop() has been called.'],
  [
    'isLooping',
    'function',
    '() => boolean',
    'Returns true if the draw loop is running and false if not.'
  ],
  ['redraw', 'function', '(n?: number) => Promise<void>', 'Runs the code in draw() once.'],
  [
    'applyMatrix',
    'function',
    '(arr: number[]) => void | (a: number, b: number, c: number, d: number, e: number, f: number) => void | (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number) => void',
    'Applies a transformation matrix to the coordinate system.'
  ],
  [
    'resetMatrix',
    'function',
    '() => void',
    'Clears all transformations applied to the coordinate system.'
  ],
  [
    'rotate',
    'function',
    '(angle: number, axis?: p5.Vector | number[]) => void',
    'Rotates the coordinate system.'
  ],
  [
    'rotateX',
    'function',
    '(angle: number) => void',
    'Rotates the coordinate system about the x-axis in WebGL mode.'
  ],
  [
    'rotateY',
    'function',
    '(angle: number) => void',
    'Rotates the coordinate system about the y-axis in WebGL mode.'
  ],
  [
    'rotateZ',
    'function',
    '(angle: number) => void',
    'Rotates the coordinate system about the z-axis in WebGL mode.'
  ],
  [
    'scale',
    'function',
    '(s: number | p5.Vector | number[], y?: number, z?: number) => void | (scales: p5.Vector | number[]) => void',
    'Scales the coordinate system.'
  ],
  [
    'shearX',
    'function',
    '(angle: number) => void',
    'Shears the x-axis so that shapes appear skewed.'
  ],
  [
    'shearY',
    'function',
    '(angle: number) => void',
    'Shears the y-axis so that shapes appear skewed.'
  ],
  [
    'translate',
    'function',
    '(x: number, y: number, z?: number) => void | (vector: p5.Vector) => void',
    'Translates the coordinate system.'
  ],
  [
    'push',
    'function',
    '() => void',
    'Begins a drawing group that contains its own styles and transformations.'
  ],
  [
    'pop',
    'function',
    '() => void',
    'Ends a drawing group that contains its own styles and transformations.'
  ],
  [
    'storeItem',
    'function',
    '(key: string, value: string | number | boolean | object | any[]) => void',
    "Stores a value in the web browser's local storage."
  ],
  [
    'getItem',
    'function',
    '(key: string) => string | number | boolean | object | any[]',
    "Returns a value in the web browser's local storage."
  ],
  [
    'clearStorage',
    'function',
    '() => void',
    "Removes all items in the web browser's local storage."
  ],
  [
    'removeItem',
    'function',
    '(key: string) => void',
    "Removes an item from the web browser's local storage."
  ],
  [
    'select',
    'function',
    '(selectors: string, container?: string | p5.Element | HTMLElement) => p5.Element | null',
    'Searches the page for the first element that matches the given CSS selector string.'
  ],
  [
    'selectAll',
    'function',
    '(selectors: string, container?: string | p5.Element | HTMLElement) => p5.Element[]',
    'Searches the page for all elements that matches the given CSS selector string.'
  ],
  [
    'createElement',
    'function',
    '(tag: string, content?: string) => p5.Element',
    'Creates a new p5.Element object.'
  ],
  [
    'removeElements',
    'function',
    '() => void',
    'Removes all elements created by p5.js, including any event handlers.'
  ],
  ['addElement', 'function', '() => void | () => void', 'Helpers for create methods.'],
  ['createDiv', 'function', '(html?: string) => p5.Element', 'Creates a div element.'],
  ['createP', 'function', '(html?: string) => p5.Element', 'Creates a paragraph element.'],
  ['createSpan', 'function', '(html?: string) => p5.Element', 'Creates a span element.'],
  [
    'createImg',
    'function',
    '(src: string, alt: string) => p5.Element | (src: string, alt: string, crossOrigin?: string, successCallback?: Function) => p5.Element',
    'Creates an img element that can appear outside of the canvas.'
  ],
  [
    'createA',
    'function',
    '(href: string, html: string, target?: string) => p5.Element',
    'Creates an anchor element that links to another web page.'
  ],
  [
    'createSlider',
    'function',
    '(min: number, max: number, value?: number, step?: number) => p5.Element',
    'Creates a slider input element.'
  ],
  [
    'createButton',
    'function',
    '(label: string, value?: string) => p5.Element',
    'Creates a button element.'
  ],
  [
    'createCheckbox',
    'function',
    '(label?: string, value?: boolean) => p5.Element',
    'Creates a checkbox input element.'
  ],
  [
    'createSelect',
    'function',
    '(multiple?: boolean) => p5.Element | (existing: object) => p5.Element',
    'Creates a dropdown menu select element.'
  ],
  [
    'createRadio',
    'function',
    '(containerElement?: object) => p5.Element | (name?: string) => p5.Element | () => p5.Element',
    'Creates a radio button element.'
  ],
  [
    'createColorPicker',
    'function',
    '(value?: string | p5.Color) => p5.Element',
    'Creates a color picker element.'
  ],
  [
    'createInput',
    'function',
    '(value?: string, type?: string) => p5.Element | (value?: string) => p5.Element',
    'Creates a text input element.'
  ],
  [
    'createFileInput',
    'function',
    '(callback: (input: p5.File) => any, multiple?: boolean) => p5.Element',
    'Creates an input element of type `file`.'
  ],
  [
    'createVideo',
    'function',
    '(src?: string | string[], callback?: (video: p5.MediaElement<HTMLVideoElement>) => any) => p5.MediaElement<HTMLVideoElement>',
    'Creates a video element for simple audio/video playback.'
  ],
  [
    'createAudio',
    'function',
    '(src?: string | string[], callback?: (video: p5.MediaElement<HTMLAudioElement>) => any) => p5.MediaElement<HTMLAudioElement>',
    'Creates a hidden audio element for simple audio playback.'
  ],
  [
    'createCapture',
    'function',
    '(type?: typeof p5.AUDIO | typeof p5.VIDEO | object, flipped?: object, callback?: Function) => p5.MediaElement',
    'Creates a video element that "captures" the audio/video stream from the webcam and microphone.'
  ],
  [
    'setMoveThreshold',
    'function',
    '(value: number) => void',
    'The setMoveThreshold() function is used to set the movement threshold for the deviceMoved() function.'
  ],
  [
    'setShakeThreshold',
    'function',
    '(value: number) => void',
    'The setShakeThreshold() function is used to set the movement threshold for the deviceShaken() function.'
  ],
  [
    'deviceMoved',
    'function',
    '() => void',
    'The deviceMoved() function is called when the device is moved by more than the threshold value along X, Y or Z axis.'
  ],
  [
    'deviceTurned',
    'function',
    '() => void',
    'The deviceTurned() function is called when the device rotates by more than 90 degrees continuously.'
  ],
  [
    'deviceShaken',
    'function',
    '() => void',
    'The deviceShaken() function is called when the device total acceleration changes of accelerationX and accelerationY values is more than the threshold value.'
  ],
  [
    'keyPressed',
    'function',
    '(event?: KeyboardEvent) => void',
    "A function that's called once when any key is pressed."
  ],
  [
    'keyReleased',
    'function',
    '(event?: KeyboardEvent) => void',
    "A function that's called once when any key is released."
  ],
  [
    'keyTyped',
    'function',
    '(event?: KeyboardEvent) => void',
    "A function that's called once when keys with printable characters are pressed."
  ],
  [
    'keyIsDown',
    'function',
    '(code: number | string) => boolean',
    'Returns `true` if the key it’s checking is pressed and `false` if not.'
  ],
  [
    'mouseMoved',
    'function',
    '(event?: MouseEvent) => void',
    "A function that's called when the mouse moves."
  ],
  [
    'mouseDragged',
    'function',
    '(event?: MouseEvent) => void',
    "A function that's called when the mouse moves while a button is pressed."
  ],
  [
    'mousePressed',
    'function',
    '(event?: MouseEvent) => void',
    "A function that's called once when a mouse button is pressed."
  ],
  [
    'mouseReleased',
    'function',
    '(event?: MouseEvent) => void',
    "A function that's called once when a mouse button is released."
  ],
  [
    'mouseClicked',
    'function',
    '(event?: MouseEvent) => void',
    "A function that's called once after a mouse button is pressed and released."
  ],
  [
    'doubleClicked',
    'function',
    '(event?: MouseEvent) => void',
    "A function that's called once when a mouse button is clicked twice quickly."
  ],
  [
    'mouseWheel',
    'function',
    '(event?: WheelEvent) => void',
    "A function that's called once when the mouse wheel moves."
  ],
  [
    'requestPointerLock',
    'function',
    '() => void',
    'Locks the mouse pointer to its current position and makes it invisible.'
  ],
  [
    'exitPointerLock',
    'function',
    '() => void',
    'Exits a pointer lock started with requestPointerLock.'
  ],
  [
    'createImage',
    'function',
    '(width: number, height: number) => p5.Image',
    'Creates a new p5.Image object.'
  ],
  [
    'saveCanvas',
    'function',
    '(selectedCanvas: p5.Framebuffer | p5.Element | HTMLCanvasElement, filename?: string, extension?: string) => void | (filename?: string, extension?: string) => void',
    'Saves the current canvas as an image.'
  ],
  [
    'saveFrames',
    'function',
    '(filename: string, extension: string, duration: number, framerate: number, callback?: (arg0: any[]) => void) => void',
    'Captures a sequence of frames from the canvas that can be saved as images.'
  ],
  [
    'loadImage',
    'function',
    '(path: string | Request, successCallback?: (arg0: p5.Image) => void, failureCallback?: (arg0: Event) => void) => Promise<p5.Image>',
    'Loads an image to create a p5.Image object.'
  ],
  [
    'saveGif',
    'function',
    "(filename: string, duration: number, options?: { delay?: number; units?: 'seconds' | 'frames'; silent?: boolean; notificationDuration?: number; notificationID?: string }) => void",
    'Generates a gif from a sketch and saves it to a file.'
  ],
  [
    'image',
    'function',
    '(img: p5.Image | p5.Element | p5.Texture | p5.Framebuffer | p5.FramebufferTexture | p5.Renderer | p5.Graphics, x: number, y: number, width?: number, height?: number) => void | (img: p5.Image | p5.Element | p5.Texture | p5.Framebuffer | p5.FramebufferTexture, dx: number, dy: number, dWidth: number, dHeight: number, sx: number, sy: number, sWidth?: number, sHeight?: number, fit?: typeof p5.CONTAIN | typeof p5.COVER, xAlign?: typeof p5.LEFT | typeof p5.RIGHT | typeof p5.CENTER, yAlign?: typeof p5.TOP | typeof p5.BOTTOM | typeof p5.CENTER) => void',
    'Draws an image to the canvas.'
  ],
  [
    'tint',
    'function',
    '(v1: number, v2: number, v3: number, alpha?: number) => void | (value: string) => void | (gray: number, alpha?: number) => void | (values: number[]) => void | (color: p5.Color) => void',
    'Tints images using a color.'
  ],
  ['noTint', 'function', '() => void', 'Removes the current tint set by tint().'],
  [
    'imageMode',
    'function',
    '(mode: typeof p5.CORNER | typeof p5.CORNERS | typeof p5.CENTER) => void',
    'Changes the location from which images are drawn when image() is called.'
  ],
  [
    'blend',
    'function',
    '(srcImage: p5.Image, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number, blendMode: typeof p5.BLEND | typeof p5.DARKEST | typeof p5.LIGHTEST | typeof p5.DIFFERENCE | typeof p5.MULTIPLY | typeof p5.EXCLUSION | typeof p5.SCREEN | typeof p5.REPLACE | typeof p5.OVERLAY | typeof p5.HARD_LIGHT | typeof p5.SOFT_LIGHT | typeof p5.DODGE | typeof p5.BURN | typeof p5.ADD | typeof p5.NORMAL) => void | (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number, blendMode: typeof p5.BLEND | typeof p5.DARKEST | typeof p5.LIGHTEST | typeof p5.DIFFERENCE | typeof p5.MULTIPLY | typeof p5.EXCLUSION | typeof p5.SCREEN | typeof p5.REPLACE | typeof p5.OVERLAY | typeof p5.HARD_LIGHT | typeof p5.SOFT_LIGHT | typeof p5.DODGE | typeof p5.BURN | typeof p5.ADD | typeof p5.NORMAL) => void',
    'Copies a region of pixels from one image to another.'
  ],
  [
    'copy',
    'function',
    '(srcImage: p5.Image | p5.Element, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => void | (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => void',
    'Copies pixels from a source image to a region of the canvas.'
  ],
  [
    'filter',
    'function',
    '(filterType: typeof p5.THRESHOLD | typeof p5.GRAY | typeof p5.OPAQUE | typeof p5.INVERT | typeof p5.POSTERIZE | typeof p5.BLUR | typeof p5.ERODE | typeof p5.DILATE | typeof p5.BLUR, filterParam?: number, useWebGL?: boolean) => void | (filterType: typeof p5.THRESHOLD | typeof p5.GRAY | typeof p5.OPAQUE | typeof p5.INVERT | typeof p5.POSTERIZE | typeof p5.BLUR | typeof p5.ERODE | typeof p5.DILATE | typeof p5.BLUR, filterParam?: number, useWebGL?: boolean) => void | (shaderFilter: p5.Shader) => void',
    'Applies an image filter to the canvas.'
  ],
  [
    'get',
    'function',
    '(x: number, y: number, w: number, h: number) => p5.Image | () => p5.Image | (x: number, y: number) => number[]',
    'Gets a pixel or a region of pixels from the canvas.'
  ],
  [
    'loadPixels',
    'function',
    '() => void',
    'Loads the current value of each pixel on the canvas into the pixels array.'
  ],
  [
    'set',
    'function',
    '(x: number, y: number, c: number | number[] | object) => void',
    'Sets the color of a pixel or draws an image to the canvas.'
  ],
  [
    'updatePixels',
    'function',
    '(x?: number, y?: number, w?: number, h?: number) => void | () => void',
    'Updates the canvas with the RGBA values in the pixels array.'
  ],
  [
    'loadJSON',
    'function',
    '(path: string | Request, successCallback?: Function, errorCallback?: Function) => Promise<object>',
    'Loads a JSON file to create an `Object`.'
  ],
  [
    'loadStrings',
    'function',
    '(path: string | Request, successCallback?: Function, errorCallback?: Function) => Promise<string[]>',
    'Loads a text file to create an `Array`.'
  ],
  [
    'loadTable',
    'function',
    '(filename: string | Request, separator?: string, header?: string, callback?: Function, errorCallback?: Function) => Promise<object>',
    'Reads the contents of a file or URL and creates a p5.Table object with its values.'
  ],
  [
    'loadXML',
    'function',
    '(path: string | Request, successCallback?: Function, errorCallback?: Function) => Promise<p5.XML>',
    'Loads an XML file to create a p5.XML object.'
  ],
  [
    'loadBytes',
    'function',
    '(file: string | Request, callback?: Function, errorCallback?: Function) => Promise<Uint8Array>',
    'This method is suitable for fetching files up to size of 64MB.'
  ],
  [
    'loadBlob',
    'function',
    '(path: string | Request, successCallback?: Function, errorCallback?: Function) => Promise<Blob>',
    'Loads a file at the given path as a Blob, then returns the resulting data or passes it to a success callback function, if provided.'
  ],
  [
    'httpGet',
    'function',
    '(path: string | Request, datatype?: string, callback?: Function, errorCallback?: Function) => Promise<any> | (path: string | Request, callback: Function, errorCallback?: Function) => Promise<any>',
    'Method for executing an HTTP GET request.'
  ],
  [
    'httpPost',
    'function',
    '(path: string | Request, data?: object | boolean, datatype?: string, callback?: Function, errorCallback?: Function) => Promise<any> | (path: string | Request, data: object | boolean, callback?: Function, errorCallback?: Function) => Promise<any> | (path: string | Request, callback?: Function, errorCallback?: Function) => Promise<any>',
    'Method for executing an HTTP POST request.'
  ],
  [
    'httpDo',
    'function',
    '(path: string | Request, method?: string, datatype?: string, data?: object, callback?: Function, errorCallback?: Function) => Promise<any> | (path: string | Request, callback?: Function, errorCallback?: Function) => Promise<any>',
    'Method for executing an HTTP request.'
  ],
  [
    'createWriter',
    'function',
    '(name: string, extension?: string) => p5.PrintWriter',
    'Creates a new p5.PrintWriter object.'
  ],
  [
    'write',
    'function',
    '(data: string | number | any[]) => void',
    'Writes data to the print stream without adding new lines.'
  ],
  ['close', 'function', '() => void', 'Saves the file and closes the print stream.'],
  [
    'save',
    'function',
    '(objectOrFilename?: object | string, filename?: string, options?: boolean | string) => void',
    "Saves a given element(image, text, json, csv, wav, or html) to the client's computer."
  ],
  [
    'saveJSON',
    'function',
    '(json: any[] | object, filename: string, optimize?: boolean) => void',
    'Saves an `Object` or `Array` to a JSON file.'
  ],
  [
    'saveStrings',
    'function',
    '(list: string[], filename: string, extension?: string, isCRLF?: boolean) => void',
    'Saves an `Array` of `String`s to a file, one per line.'
  ],
  [
    'saveTable',
    'function',
    '(Table: p5.Table, filename: string, options?: string) => void',
    'Writes the contents of a Table object to a file.'
  ],
  ['setContent', 'function', '(content: string) => void', "Sets the element's content."],
  [
    'abs',
    'function',
    '(n: number) => number | (param0: any) => any | (param0: any) => any',
    'Calculates the absolute value of a number.'
  ],
  [
    'ceil',
    'function',
    '(n: number) => number | (param0: any) => any',
    'Calculates the closest integer value that is greater than or equal to a number.'
  ],
  [
    'constrain',
    'function',
    '(n: number, low: number, high: number) => number',
    'Constrains a number between a minimum and maximum value.'
  ],
  [
    'dist',
    'function',
    '(x1: number, y1: number, x2: number, y2: number) => number | (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => number',
    'Calculates the distance between two points.'
  ],
  [
    'exp',
    'function',
    '(n: number) => number | (param0: any) => any',
    "Calculates the value of Euler's number e (2.71828...) raised to the power of a number."
  ],
  [
    'floor',
    'function',
    '(n: number) => number | (param0: any) => any',
    'Calculates the closest integer value that is less than or equal to the value of a number.'
  ],
  [
    'lerp',
    'function',
    '(start: number, stop: number, amt: number) => number',
    'Calculates a number between two numbers at a specific increment.'
  ],
  [
    'log',
    'function',
    '(n: number) => number | (param0: any) => any',
    'Calculates the natural logarithm (the base-e logarithm) of a number.'
  ],
  [
    'mag',
    'function',
    '(x: number, y: number) => number',
    'Calculates the magnitude, or length, of a vector.'
  ],
  [
    'map',
    'function',
    '(value: number, start1: number, stop1: number, start2: number, stop2: number, withinBounds?: boolean) => number',
    'Re-maps a number from one range to another.'
  ],
  [
    'max',
    'function',
    '(n0: number, n1: number) => number | (nums: number[]) => number | (param0: any, param1: any) => any | (param0: any, param1: any) => any | (param0: any, param1: any) => any | (param0: any, param1: any) => any',
    'Returns the largest value in a sequence of numbers.'
  ],
  [
    'min',
    'function',
    '(n0: number, n1: number) => number | (nums: number[]) => number | (param0: any, param1: any) => any | (param0: any, param1: any) => any | (param0: any, param1: any) => any | (param0: any, param1: any) => any',
    'Returns the smallest value in a sequence of numbers.'
  ],
  [
    'norm',
    'function',
    '(value: number, start: number, stop: number) => number',
    'Maps a number from one range to a value between 0 and 1.'
  ],
  [
    'pow',
    'function',
    '(n: number, e: number) => number | (param0: any, param1: any) => any',
    'Calculates exponential expressions such as 23.'
  ],
  [
    'round',
    'function',
    '(n: number, decimals?: number) => number | (param0: any) => any',
    'Calculates the integer closest to a number.'
  ],
  ['sq', 'function', '(n: number) => number', 'Calculates the square of a number.'],
  [
    'sqrt',
    'function',
    '(n: number) => number | (param0: any) => any',
    'Calculates the square root of a number.'
  ],
  [
    'fract',
    'function',
    '(n: number) => number | (param0: any) => any',
    'Calculates the fractional part of a number.'
  ],
  ['createVector', 'function', '(...x: number[]) => p5.Vector', 'Creates a new p5.Vector object.'],
  [
    'noise',
    'function',
    '(x: number, y?: number, z?: number) => number',
    'Returns random numbers that can be tuned to feel organic.'
  ],
  [
    'noiseDetail',
    'function',
    '(lod: number, falloff: number) => void',
    'Adjusts the character of the noise produced by the noise() function.'
  ],
  [
    'noiseSeed',
    'function',
    '(seed: number) => void',
    'Sets the seed value for the noise() function.'
  ],
  [
    'randomSeed',
    'function',
    '(seed: number) => void',
    'Sets the seed value for the random() and randomGaussian() functions.'
  ],
  [
    'random',
    'function',
    '(min?: number, max?: number) => number | (choices: readonly T[]) => T',
    'Returns a random number or a random element from an array.'
  ],
  [
    'randomGaussian',
    'function',
    '(mean?: number, sd?: number) => number',
    'Returns a random number fitting a Gaussian, or normal, distribution.'
  ],
  [
    'acos',
    'function',
    '(value: number) => number | (param0: any) => any',
    'Calculates the arc cosine of a number.'
  ],
  [
    'asin',
    'function',
    '(value: number) => number | (param0: any) => any',
    'Calculates the arc sine of a number.'
  ],
  [
    'atan',
    'function',
    '(value: number) => number | (param0: any) => any | (param0: any, param1: any) => any',
    'Calculates the arc tangent of a number.'
  ],
  [
    'atan2',
    'function',
    '(y: number, x: number) => number',
    'Calculates the angle formed by a point, the origin, and the positive x-axis.'
  ],
  [
    'cos',
    'function',
    '(angle: number) => number | (param0: any) => any',
    'Calculates the cosine of an angle.'
  ],
  [
    'sin',
    'function',
    '(angle: number) => number | (param0: any) => any',
    'Calculates the sine of an angle.'
  ],
  [
    'tan',
    'function',
    '(angle: number) => number | (param0: any) => any',
    'Calculates the tangent of an angle.'
  ],
  [
    'degrees',
    'function',
    '(radians: number) => number | (param0: any) => any',
    'Converts an angle measured in radians to its value in degrees.'
  ],
  [
    'radians',
    'function',
    '(degrees: number) => number | (param0: any) => any',
    'Converts an angle measured in degrees to its value in radians.'
  ],
  [
    'angleMode',
    'function',
    '(mode: typeof p5.RADIANS | typeof p5.DEGREES) => typeof p5.RADIANS | typeof p5.DEGREES | () => typeof p5.RADIANS | typeof p5.DEGREES',
    'Changes the unit system used to measure angles.'
  ],
  [
    'arc',
    'function',
    '(x: number, y: number, w: number, h: number, start: number, stop: number, mode?: typeof p5.CHORD | typeof p5.PIE | typeof p5.OPEN, detail?: number) => void',
    'Draws an arc.'
  ],
  [
    'ellipse',
    'function',
    '(x: number, y: number, w: number, h?: number) => void | (x: number, y: number, w: number, h: number, detail?: number) => void',
    'Draws an ellipse (oval).'
  ],
  ['circle', 'function', '(x: number, y: number, d: number) => void', 'Draws a circle.'],
  [
    'line',
    'function',
    '(x1: number, y1: number, x2: number, y2: number) => void | (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => void',
    'Draws a straight line between two points.'
  ],
  [
    'point',
    'function',
    '(x: number, y: number, z?: number) => void | (coordinateVector: p5.Vector) => void',
    'Draws a single point in space.'
  ],
  [
    'quad',
    'function',
    '(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, detailX?: number, detailY?: number) => void | (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, x3: number, y3: number, z3: number, x4: number, y4: number, z4: number, detailX?: number, detailY?: number) => void',
    'Draws a quadrilateral (four-sided shape).'
  ],
  [
    'rect',
    'function',
    '(x: number, y: number, w: number, h?: number, tl?: number, tr?: number, br?: number, bl?: number) => void | (x: number, y: number, w: number, h: number, detailX?: number, detailY?: number) => void',
    'Draws a rectangle.'
  ],
  [
    'square',
    'function',
    '(x: number, y: number, s: number, tl?: number, tr?: number, br?: number, bl?: number) => void',
    'Draws a square.'
  ],
  [
    'triangle',
    'function',
    '(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => void',
    'Draws a triangle.'
  ],
  [
    'ellipseMode',
    'function',
    '(mode: typeof p5.CENTER | typeof p5.RADIUS | typeof p5.CORNER | typeof p5.CORNERS) => void',
    'Changes where ellipses, circles, and arcs are drawn.'
  ],
  ['noSmooth', 'function', '() => void', 'Draws certain features with jagged (aliased) edges.'],
  [
    'rectMode',
    'function',
    '(mode: typeof p5.CENTER | typeof p5.RADIUS | typeof p5.CORNER | typeof p5.CORNERS) => void',
    'Changes where rectangles and squares are drawn.'
  ],
  ['smooth', 'function', '() => void', 'Draws certain features with smooth (antialiased) edges.'],
  [
    'strokeCap',
    'function',
    '(cap: typeof p5.ROUND | typeof p5.SQUARE | typeof p5.PROJECT) => void',
    'Sets the style for rendering the ends of lines.'
  ],
  [
    'strokeJoin',
    'function',
    '(join: typeof p5.MITER | typeof p5.BEVEL | typeof p5.ROUND) => void',
    'Sets the style of the joints that connect line segments.'
  ],
  [
    'strokeWeight',
    'function',
    '(weight: number) => void',
    'Sets the width of the stroke used for points, lines, and the outlines of shapes.'
  ],
  [
    'bezier',
    'function',
    '(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => void | (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, x3: number, y3: number, z3: number, x4: number, y4: number, z4: number) => void',
    'Draws a Bézier curve.'
  ],
  [
    'bezierPoint',
    'function',
    '(a: number, b: number, c: number, d: number, t: number) => number',
    'Calculates coordinates along a Bézier curve using interpolation.'
  ],
  [
    'bezierTangent',
    'function',
    '(a: number, b: number, c: number, d: number, t: number) => number',
    "Calculates coordinates along a line that's tangent to a Bézier curve."
  ],
  [
    'spline',
    'function',
    '(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => void | (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, x3: number, y3: number, z3: number, x4: number, y4: number, z4: number) => void',
    'Draws a curve using a Catmull-Rom spline.'
  ],
  [
    'splinePoint',
    'function',
    '(a: number, b: number, c: number, d: number, t: number) => number',
    'Calculates coordinates along a spline curve using interpolation.'
  ],
  [
    'splineTangent',
    'function',
    '(a: number, b: number, c: number, d: number, t: number) => number',
    "Calculates coordinates along a line that's tangent to a spline curve."
  ],
  [
    'bezierOrder',
    'function',
    '(order: number) => number | () => number',
    'Influences the shape of the Bézier curve segment in a custom shape.'
  ],
  [
    'splineVertex',
    'function',
    '(x: number, y: number) => void | (x: number, y: number, z?: number) => void | (x: number, y: number, u?: number, v?: number) => void | (x: number, y: number, z: number, u?: number, v?: number) => void',
    'Connects points with a smooth curve (a spline).'
  ],
  [
    'splineProperty',
    'function',
    '(property: string, value: any) => void | (property: string) => void',
    'Gets or sets a given spline property.'
  ],
  [
    'splineProperties',
    'function',
    '(values: object) => object',
    'Sets multiple properties for spline curves at once.'
  ],
  [
    'vertex',
    'function',
    '(x: number, y: number) => void | (x: number, y: number, u?: number, v?: number) => void | (x: number, y: number, z: number, u?: number, v?: number) => void',
    'Adds a vertex to a custom shape.'
  ],
  ['beginContour', 'function', '() => void', 'Begins creating a hole within a flat shape.'],
  [
    'endContour',
    'function',
    '(mode?: typeof p5.OPEN | typeof p5.CLOSE) => void',
    'Stops creating a hole within a flat shape.'
  ],
  [
    'beginShape',
    'function',
    '(kind?: typeof p5.POINTS | typeof p5.LINES | typeof p5.TRIANGLES | typeof p5.TRIANGLE_FAN | typeof p5.TRIANGLE_STRIP | typeof p5.QUADS | typeof p5.QUAD_STRIP | typeof p5.PATH) => void',
    'Begins adding vertices to a custom shape.'
  ],
  [
    'bezierVertex',
    'function',
    '(x: number, y: number, u?: number, v?: number) => void | (x: number, y: number, z: number, u?: number, v?: number) => void',
    'Adds a Bézier curve segment to a custom shape.'
  ],
  [
    'endShape',
    'function',
    '(mode?: typeof p5.CLOSE, count?: number) => void',
    'Concludes the vertices of a custom shape.'
  ],
  [
    'normal',
    'function',
    '(vector: p5.Vector) => void | (x: number, y: number, z: number) => void',
    'Sets the normal vector for vertices in a custom 3D shape.'
  ],
  [
    'vertexProperty',
    'function',
    '(attributeName: string, data: number | number[]) => void',
    "Sets the shader's vertex property or attribute variables."
  ],
  [
    'getWorldInputs',
    'function',
    '(callback: Function) => void',
    'Registers a callback to modify the world-space properties of each vertex in a shader.'
  ],
  [
    'combineColors',
    'function',
    '(callback: Function) => void',
    'Registers a callback to customize how color components are combined in the fragment shader.'
  ],
  [
    'getPixelInputs',
    'function',
    '(callback: Function) => void',
    'Registers a callback to modify the properties of each fragment (pixel) before the final color is calculated in the fragment shader.'
  ],
  [
    'getFinalColor',
    'function',
    '(callback: Function) => void',
    'Registers a callback to change the final color of each pixel after all lighting and mixing is done in the fragment shader.'
  ],
  [
    'getColor',
    'function',
    '(callback: Function) => void',
    'Registers a callback to set the final color for each pixel in a filter shader.'
  ],
  [
    'getObjectInputs',
    'function',
    '(callback: Function) => void',
    'Registers a callback to modify the properties of each vertex before any transformations are applied in the vertex shader.'
  ],
  [
    'getCameraInputs',
    'function',
    '(callback: Function) => void',
    'Registers a callback to adjust vertex properties after the model has been transformed by the camera, but before projection, in the vertex shader.'
  ],
  [
    'loadFont',
    'function',
    '(path: string, name?: string, options?: { sets?: string | string[] }, successCallback?: (font: p5.Font) => any, failureCallback?: Function) => Promise<p5.Font> | (path: string, successCallback?: (font: p5.Font) => any, failureCallback?: Function) => Promise<p5.Font>',
    'Loads a font and creates a p5.Font object.'
  ],
  [
    'text',
    'function',
    '(str: string | object | any[] | number | boolean, x: number, y: number, maxWidth?: number, maxHeight?: number) => void',
    'Draws text to the canvas.'
  ],
  [
    'textAlign',
    'function',
    '(horizAlign?: typeof p5.LEFT | typeof p5.CENTER | typeof p5.RIGHT, vertAlign?: typeof p5.TOP | typeof p5.BOTTOM | typeof p5.CENTER | typeof p5.BASELINE) => object',
    'Sets the way text is aligned when text() is called.'
  ],
  ['textAscent', 'function', '(txt?: string) => number', 'Returns the ascent of the text.'],
  ['textDescent', 'function', '(txt?: string) => number', 'Returns the descent of the text.'],
  [
    'textLeading',
    'function',
    '(leading?: number) => number',
    'Sets the spacing between lines of text when text() is called.'
  ],
  [
    'textFont',
    'function',
    '(font?: p5.Font | string | object, size?: number) => string | p5.Font',
    'Sets the font used by the text() function.'
  ],
  [
    'textSize',
    'function',
    '(size: number) => number | () => number',
    'Sets or gets the current text size.'
  ],
  [
    'textStyle',
    'function',
    '(style: typeof p5.NORMAL | typeof p5.ITALIC | typeof p5.BOLD | typeof p5.BOLDITALIC) => typeof p5.NORMAL | typeof p5.ITALIC | typeof p5.BOLD | typeof p5.BOLDITALIC | () => typeof p5.NORMAL | typeof p5.BOLD | typeof p5.ITALIC | typeof p5.BOLDITALIC',
    'Sets the style for system fonts when text() is called.'
  ],
  [
    'textWidth',
    'function',
    '(text: string) => number',
    'Calculates the width of the given text string in pixels.'
  ],
  [
    'textWrap',
    'function',
    '(style: typeof p5.WORD | typeof p5.CHAR) => typeof p5.CHAR | typeof p5.WORD | () => typeof p5.CHAR | typeof p5.WORD',
    'Sets the style for wrapping text when text() is called.'
  ],
  [
    'textBounds',
    'function',
    '(str: string, x: number, y: number, width?: number, height?: number) => { x: number; y: number; w: number; h: number }',
    'Computes the tight bounding box for a block of text.'
  ],
  [
    'textDirection',
    'function',
    '(direction: string) => string | () => string',
    'Sets or gets the text drawing direction.'
  ],
  [
    'textProperty',
    'function',
    '(prop: string, value: any) => void | (prop: string) => void',
    'Sets or gets a single text property for the renderer.'
  ],
  [
    'textProperties',
    'function',
    '(properties: object) => object | () => object',
    'Gets or sets text properties in batch, similar to calling `textProperty()` multiple times.'
  ],
  [
    'fontBounds',
    'function',
    '(str: string, x: number, y: number, width?: number, height?: number) => { x: number; y: number; w: number; h: number }',
    'Computes a generic (non-tight) bounding box for a block of text.'
  ],
  [
    'fontWidth',
    'function',
    '(theText: string) => number',
    'Returns the loose width of a text string based on the current font.'
  ],
  [
    'fontAscent',
    'function',
    '() => number',
    "Returns the loose ascent of the text based on the font's intrinsic metrics."
  ],
  [
    'fontDescent',
    'function',
    '() => number',
    "Returns the loose descent of the text based on the font's intrinsic metrics."
  ],
  [
    'textWeight',
    'function',
    '(weight: number) => number | () => number',
    'Sets or gets the current font weight.'
  ],
  [
    'float',
    'function',
    '(str: string) => number | (ns: string[]) => number[] | (value: any) => any',
    'Converts a `String` to a floating point (decimal) `Number`.'
  ],
  [
    'int',
    'function',
    '(n: string | boolean | number) => number | (ns: any[]) => number[] | (value: any) => any',
    'Converts a `Boolean`, `String`, or decimal `Number` to an integer.'
  ],
  [
    'str',
    'function',
    '(n: string | boolean | number) => string',
    'Converts a `Boolean` or `Number` to `String`.'
  ],
  [
    'boolean',
    'function',
    '(n: string | boolean | number) => boolean | (ns: any[]) => boolean[]',
    'Converts a `String` or `Number` to a `Boolean`.'
  ],
  [
    'byte',
    'function',
    '(n: string | boolean | number) => number | (ns: any[]) => number[]',
    'Converts a `Boolean`, `String`, or `Number` to its byte value.'
  ],
  [
    'char',
    'function',
    '(n: string | number) => string | (ns: any[]) => string[]',
    'Converts a `Number` or `String` to a single-character `String`.'
  ],
  [
    'unchar',
    'function',
    '(n: string) => number | (ns: string[]) => number[]',
    'Converts a single-character `String` to a `Number`.'
  ],
  [
    'hex',
    'function',
    '(n: number, digits?: number) => string | (ns: number[], digits?: number) => string[]',
    'Converts a `Number` to a `String` with its hexadecimal value.'
  ],
  [
    'unhex',
    'function',
    '(n: string) => number | (ns: string[]) => number[]',
    'Converts a `String` with a hexadecimal value to a `Number`.'
  ],
  ['day', 'function', '() => number', 'Returns the current day as a number from 1–31.'],
  ['hour', 'function', '() => number', 'Returns the current hour as a number from 0–23.'],
  ['minute', 'function', '() => number', 'Returns the current minute as a number from 0–59.'],
  [
    'millis',
    'function',
    '() => number',
    'Returns the number of milliseconds since a sketch started running.'
  ],
  ['month', 'function', '() => number', 'Returns the current month as a number from 1–12.'],
  ['second', 'function', '() => number', 'Returns the current second as a number from 0–59.'],
  ['year', 'function', '() => number', 'Returns the current year as a number such as 1999.'],
  [
    'nf',
    'function',
    '(num: number | string, left?: number | string, right?: number | string) => string | (nums: number[], left?: number | string, right?: number | string) => string[]',
    'Converts a `Number` into a `String` with a given number of digits.'
  ],
  [
    'nfc',
    'function',
    '(num: number | string, right?: number | string) => string | (nums: number[], right?: number | string) => string[]',
    'Converts a `Number` into a `String` with commas to mark units of 1,000.'
  ],
  [
    'nfp',
    'function',
    '(num: number, left?: number, right?: number) => string | (nums: number[], left?: number, right?: number) => string[]',
    'Converts a `Number` into a `String` with a plus or minus sign.'
  ],
  [
    'nfs',
    'function',
    '(num: number, left?: number, right?: number) => string | (nums: any[], left?: number, right?: number) => string[]',
    'Converts a positive `Number` into a `String` with an extra space in front.'
  ],
  [
    'splitTokens',
    'function',
    '(value: string, delim?: string) => string[]',
    'Splits a `String` into pieces and returns an array containing the pieces.'
  ],
  [
    'shuffle',
    'function',
    '(array: any[], bool?: boolean) => any[]',
    'Shuffles the elements of an array.'
  ],
  [
    'strokeMode',
    'function',
    '(mode: string) => void',
    'Sets the stroke rendering mode to balance performance and visual features when drawing lines.'
  ],
  [
    'buildGeometry',
    'function',
    '(callback: Function) => p5.Geometry',
    'Creates a custom p5.Geometry object from simpler 3D shapes.'
  ],
  [
    'freeGeometry',
    'function',
    '(geometry: p5.Geometry) => void',
    'Clears a p5.Geometry object from the graphics processing unit (GPU) memory.'
  ],
  [
    'plane',
    'function',
    '(width?: number, height?: number, detailX?: number, detailY?: number) => void',
    'Draws a plane.'
  ],
  [
    'box',
    'function',
    '(width?: number, height?: number, depth?: number, detailX?: number, detailY?: number) => void',
    'Draws a box (rectangular prism).'
  ],
  [
    'sphere',
    'function',
    '(radius?: number, detailX?: number, detailY?: number) => void',
    'Draws a sphere.'
  ],
  [
    'cylinder',
    'function',
    '(radius?: number, height?: number, detailX?: number, detailY?: number, bottomCap?: boolean, topCap?: boolean) => void',
    'Draws a cylinder.'
  ],
  [
    'cone',
    'function',
    '(radius?: number, height?: number, detailX?: number, detailY?: number, cap?: boolean) => void',
    'Draws a cone.'
  ],
  [
    'ellipsoid',
    'function',
    '(radiusX?: number, radiusY?: number, radiusZ?: number, detailX?: number, detailY?: number) => void',
    'Draws an ellipsoid.'
  ],
  [
    'torus',
    'function',
    '(radius?: number, tubeRadius?: number, detailX?: number, detailY?: number) => void',
    'Draws a torus.'
  ],
  [
    'curveDetail',
    'function',
    '(resolution: number) => void',
    'Sets the number of segments used to draw spline curves in WebGL mode.'
  ],
  [
    'orbitControl',
    'function',
    '(sensitivityX?: number, sensitivityY?: number, sensitivityZ?: number, options?: { disableTouchActions?: boolean; freeRotation?: boolean }) => void',
    'Allows the user to orbit around a 3D sketch using a mouse, trackpad, or touchscreen.'
  ],
  [
    'debugMode',
    'function',
    '() => void | (mode: typeof p5.GRID | typeof p5.AXES) => void | (mode: typeof p5.GRID | typeof p5.AXES, gridSize?: number, gridDivisions?: number, xOff?: number, yOff?: number, zOff?: number) => void | (mode: typeof p5.GRID | typeof p5.AXES, axesSize?: number, xOff?: number, yOff?: number, zOff?: number) => void | (gridSize?: number, gridDivisions?: number, gridXOff?: number, gridYOff?: number, gridZOff?: number, axesSize?: number, axesXOff?: number, axesYOff?: number, axesZOff?: number) => void',
    'Adds a grid and an axes icon to clarify orientation in 3D sketches.'
  ],
  ['noDebugMode', 'function', '() => void', 'Turns off debugMode() in a 3D sketch.'],
  [
    'ambientLight',
    'function',
    '(v1: number, v2: number, v3: number, alpha?: number) => void | (gray: number, alpha?: number) => void | (value: string) => void | (values: number[]) => void | (color: p5.Color) => void',
    'Creates a light that shines from all directions.'
  ],
  [
    'specularColor',
    'function',
    '(v1: number, v2: number, v3: number) => void | (gray: number) => void | (value: string) => void | (values: number[]) => void | (color: p5.Color) => void',
    'Sets the specular color for lights.'
  ],
  [
    'directionalLight',
    'function',
    '(v1: number, v2: number, v3: number, x: number, y: number, z: number) => void | (v1: number, v2: number, v3: number, direction: p5.Vector) => void | (color: p5.Color | number[] | string, x: number, y: number, z: number) => void | (color: p5.Color | number[] | string, direction: p5.Vector) => void',
    'Creates a light that shines in one direction.'
  ],
  [
    'pointLight',
    'function',
    '(v1: number, v2: number, v3: number, x: number, y: number, z: number) => void | (v1: number, v2: number, v3: number, position: p5.Vector) => void | (color: p5.Color | number[] | string, x: number, y: number, z: number) => void | (color: p5.Color | number[] | string, position: p5.Vector) => void',
    'Creates a light that shines from a point in all directions.'
  ],
  ['imageLight', 'function', '(img: p5.Image) => void', 'Creates an ambient light from an image.'],
  ['panorama', 'function', '(img: p5.Image) => void', 'Creates an immersive 3D background.'],
  ['lights', 'function', '() => void', 'Places an ambient and directional light in the scene.'],
  [
    'lightFalloff',
    'function',
    '(constant: number, linear: number, quadratic: number) => void',
    'Sets the falloff rate for pointLight() and spotLight().'
  ],
  [
    'spotLight',
    'function',
    '(v1: number, v2: number, v3: number, x: number, y: number, z: number, rx: number, ry: number, rz: number, angle?: number, concentration?: number) => void | (color: p5.Color | number[] | string, position: p5.Vector, direction: p5.Vector, angle?: number, concentration?: number) => void | (v1: number, v2: number, v3: number, position: p5.Vector, direction: p5.Vector, angle?: number, concentration?: number) => void | (color: p5.Color | number[] | string, x: number, y: number, z: number, direction: p5.Vector, angle?: number, concentration?: number) => void | (color: p5.Color | number[] | string, position: p5.Vector, rx: number, ry: number, rz: number, angle?: number, concentration?: number) => void | (v1: number, v2: number, v3: number, x: number, y: number, z: number, direction: p5.Vector, angle?: number, concentration?: number) => void | (v1: number, v2: number, v3: number, position: p5.Vector, rx: number, ry: number, rz: number, angle?: number, concentration?: number) => void | (color: p5.Color | number[] | string, x: number, y: number, z: number, rx: number, ry: number, rz: number, angle?: number, concentration?: number) => void',
    'Creates a light that shines from a point in one direction.'
  ],
  ['noLights', 'function', '() => void', 'Removes all lights from the sketch.'],
  [
    'loadModel',
    'function',
    '(path: string | Request, fileType?: string, normalize?: boolean, successCallback?: (arg0: p5.Geometry) => void, failureCallback?: (arg0: Event) => void) => Promise<p5.Geometry> | (path: string | Request, fileType?: string, successCallback?: (arg0: p5.Geometry) => void, failureCallback?: (arg0: Event) => void) => Promise<p5.Geometry> | (path: string | Request, options?: { fileType?: string; successCallback?: (arg0: p5.Geometry) => void; failureCallback?: (arg0: Event) => void; normalize?: boolean; flipU?: boolean; flipV?: boolean }) => Promise<p5.Geometry>',
    'Loads a 3D model to create a p5.Geometry object.'
  ],
  [
    'model',
    'function',
    '(model: p5.Geometry, count?: number) => void',
    'Draws a p5.Geometry object to the canvas.'
  ],
  [
    'createModel',
    'function',
    '(modelString: string, fileType?: string, normalize?: boolean, successCallback?: (arg0: p5.Geometry) => void, failureCallback?: (arg0: Event) => void) => p5.Geometry | (modelString: string, fileType?: string, successCallback?: (arg0: p5.Geometry) => void, failureCallback?: (arg0: Event) => void) => p5.Geometry | (modelString: string, fileType?: string, options?: { successCallback?: (arg0: p5.Geometry) => void; failureCallback?: (arg0: Event) => void; normalize?: boolean; flipU?: boolean; flipV?: boolean }) => p5.Geometry',
    'Load a 3d model from an OBJ or STL string.'
  ],
  [
    'loadShader',
    'function',
    '(vertFilename: string | Request, fragFilename: string | Request, successCallback?: Function, failureCallback?: Function) => Promise<p5.Shader>',
    'Loads vertex and fragment shaders to create a p5.Shader object.'
  ],
  [
    'createShader',
    'function',
    '(vertSrc: string, fragSrc: string, options?: { vertex?: object; fragment?: object }) => p5.Shader',
    'Creates a new p5.Shader object.'
  ],
  [
    'loadFilterShader',
    'function',
    '(fragFilename: string, successCallback?: Function, failureCallback?: Function) => Promise<p5.Shader>',
    'Creates and loads a filter shader from an external file.'
  ],
  [
    'createFilterShader',
    'function',
    '(fragSrc: string) => p5.Shader',
    'Creates a p5.Shader object to be used with the filter() function.'
  ],
  [
    'shader',
    'function',
    '(s: p5.Shader) => void',
    'Sets the p5.Shader object to apply while drawing.'
  ],
  [
    'strokeShader',
    'function',
    '(s: p5.Shader) => void',
    'Sets the p5.Shader object to apply for strokes.'
  ],
  [
    'imageShader',
    'function',
    '(s: p5.Shader) => void',
    'Sets the p5.Shader object to apply for images.'
  ],
  [
    'baseMaterialShader',
    'function',
    '() => p5.Shader',
    'Get the default shader used with lights, materials, and textures.'
  ],
  ['baseFilterShader', 'function', '() => p5.Shader', 'Get the base shader for filters.'],
  ['baseNormalShader', 'function', '() => p5.Shader', 'Get the shader used by `normalMaterial()`.'],
  [
    'baseColorShader',
    'function',
    '() => p5.Shader',
    'Get the shader used when no lights or materials are applied.'
  ],
  [
    'baseStrokeShader',
    'function',
    '() => p5.Shader',
    'Get the shader used when drawing the strokes of shapes.'
  ],
  ['resetShader', 'function', '() => void', 'Restores the default shaders.'],
  [
    'texture',
    'function',
    '(tex: p5.Image | p5.MediaElement | p5.Graphics | p5.Texture | p5.Framebuffer | p5.FramebufferTexture) => void | (param0: any, param1: any) => any',
    'Sets the texture that will be used on shapes.'
  ],
  [
    'textureMode',
    'function',
    '(mode: typeof p5.IMAGE | typeof p5.NORMAL) => void',
    'Changes the coordinate system used for textures when they’re applied to custom shapes.'
  ],
  [
    'textureWrap',
    'function',
    '(wrapX: typeof p5.CLAMP | typeof p5.REPEAT | typeof p5.MIRROR, wrapY?: typeof p5.CLAMP | typeof p5.REPEAT | typeof p5.MIRROR) => void',
    'Changes the way textures behave when a shape’s uv coordinates go beyond the texture.'
  ],
  ['normalMaterial', 'function', '() => void', 'Sets the current material as a normal material.'],
  [
    'ambientMaterial',
    'function',
    '(v1: number, v2: number, v3: number) => void | (gray: number) => void | (color: p5.Color | number[] | string) => void',
    'Sets the ambient color of shapes’ surface material.'
  ],
  [
    'emissiveMaterial',
    'function',
    '(v1: number, v2: number, v3: number, alpha?: number) => void | (gray: number) => void | (color: p5.Color | number[] | string) => void',
    'Sets the emissive color of shapes’ surface material.'
  ],
  [
    'specularMaterial',
    'function',
    '(gray: number, alpha?: number) => void | (v1: number, v2: number, v3: number, alpha?: number) => void | (color: p5.Color | number[] | string) => void',
    'Sets the specular color of shapes’ surface material.'
  ],
  [
    'shininess',
    'function',
    '(shine: number) => void',
    'Sets the amount of gloss ("shininess") of a specularMaterial().'
  ],
  [
    'metalness',
    'function',
    '(metallic: number) => void',
    'Sets the amount of "metalness" of a specularMaterial().'
  ],
  [
    'roll',
    'function',
    '(angle: number) => void',
    'Rotates the camera in a clockwise/counter-clockwise direction.'
  ],
  [
    'camera',
    'function',
    '(x?: number, y?: number, z?: number, centerX?: number, centerY?: number, centerZ?: number, upX?: number, upY?: number, upZ?: number) => void',
    'Sets the position and orientation of the current camera in a 3D sketch.'
  ],
  [
    'perspective',
    'function',
    '(fovy?: number, aspect?: number, near?: number, far?: number) => void',
    'Sets a perspective projection for the current camera in a 3D sketch.'
  ],
  [
    'linePerspective',
    'function',
    '(enable: boolean) => boolean | () => boolean',
    'Enables or disables perspective for lines in 3D sketches.'
  ],
  [
    'ortho',
    'function',
    '(left?: number, right?: number, bottom?: number, top?: number, near?: number, far?: number) => void',
    'Sets an orthographic projection for the current camera in a 3D sketch.'
  ],
  [
    'frustum',
    'function',
    '(left?: number, right?: number, bottom?: number, top?: number, near?: number, far?: number) => void',
    'Sets the frustum of the current camera in a 3D sketch.'
  ],
  ['createCamera', 'function', '() => p5.Camera', 'Creates a new p5.Camera object.'],
  [
    'setCamera',
    'function',
    '(cam: p5.Camera) => void',
    'Sets the current (active) camera of a 3D sketch.'
  ],
  [
    'saveObj',
    'function',
    '(fileName?: string) => void',
    'The `saveObj()` function exports `p5.Geometry` objects as 3D models in the Wavefront .obj file format.'
  ],
  [
    'saveStl',
    'function',
    '(fileName?: string, options?: { binary?: boolean }) => void',
    'The `saveStl()` function exports `p5.Geometry` objects as 3D models in the STL stereolithography file format.'
  ],
  [
    'fromAxisAngle',
    'function',
    '(angle?: number, x?: number, y?: number, z?: number) => void',
    'Returns a Quaternion for the axis angle representation of the rotation'
  ],
  [
    'mult',
    'function',
    '(quat?: p5.Quat) => void',
    'Multiplies a quaternion with other quaternion.'
  ],
  [
    'rotateBy',
    'function',
    '(axesQuat?: p5.Quat) => void',
    'Rotates the Quaternion by the quaternion passed which contains the axis of roation and angle of rotation'
  ],
  [
    'setAttributes',
    'function',
    '(key: string, value: boolean) => void | (obj: object) => void',
    'Set attributes for the WebGL Drawing context.'
  ],
  ['instanceID', 'function', '() => any', 'Returns the ID when drawing many instances'],
  ['discard', 'function', '() => void', 'Discards the current pixel'],
  ['acosh', 'function', '(param0: any) => any', 'GLSL built-in function acosh'],
  ['asinh', 'function', '(param0: any) => any', 'GLSL built-in function asinh'],
  ['atanh', 'function', '(param0: any) => any', 'GLSL built-in function atanh'],
  ['cosh', 'function', '(param0: any) => any', 'GLSL built-in function cosh'],
  ['sinh', 'function', '(param0: any) => any', 'GLSL built-in function sinh'],
  ['tanh', 'function', '(param0: any) => any', 'GLSL built-in function tanh'],
  [
    'clamp',
    'function',
    '(param0: any, param1: any, param2: any) => any | (param0: any, param1: any, param2: any) => any | (param0: any, param1: any, param2: any) => any | (param0: any, param1: any, param2: any) => any',
    'GLSL built-in function clamp'
  ],
  ['dFdx', 'function', '(param0: any) => any', 'GLSL built-in function dFdx'],
  ['dFdy', 'function', '(param0: any) => any', 'GLSL built-in function dFdy'],
  ['exp2', 'function', '(param0: any) => any', 'GLSL built-in function exp2'],
  [
    'fma',
    'function',
    '(param0: any, param1: any, param2: any) => any',
    'GLSL built-in function fma'
  ],
  ['fwidth', 'function', '(param0: any) => any', 'GLSL built-in function fwidth'],
  ['inversesqrt', 'function', '(param0: any) => any', 'GLSL built-in function inversesqrt'],
  ['log2', 'function', '(param0: any) => any', 'GLSL built-in function log2'],
  [
    'mix',
    'function',
    '(param0: any, param1: any, param2: any) => any | (param0: any, param1: any, param2: any) => any | (param0: any, param1: any, param2: any) => any',
    'GLSL built-in function mix'
  ],
  [
    'mod',
    'function',
    '(param0: any, param1: any) => any | (param0: any, param1: any) => any',
    'GLSL built-in function mod'
  ],
  ['roundEven', 'function', '(param0: any) => any', 'GLSL built-in function roundEven'],
  [
    'sign',
    'function',
    '(param0: any) => any | (param0: any) => any',
    'GLSL built-in function sign'
  ],
  [
    'smoothstep',
    'function',
    '(param0: any, param1: any, param2: any) => any | (param0: any, param1: any, param2: any) => any',
    'GLSL built-in function smoothstep'
  ],
  ['step', 'function', '(param0: any, param1: any) => any', 'GLSL built-in function step'],
  ['trunc', 'function', '(param0: any) => any', 'GLSL built-in function trunc'],
  ['cross', 'function', '(param0: any, param1: any) => any', 'GLSL built-in function cross'],
  ['distance', 'function', '(param0: any, param1: any) => any', 'GLSL built-in function distance'],
  ['dot', 'function', '(param0: any, param1: any) => any', 'GLSL built-in function dot'],
  [
    'equal',
    'function',
    '(param0: any, param1: any) => any | (param0: any, param1: any) => any | (param0: any, param1: any) => any',
    'GLSL built-in function equal'
  ],
  [
    'faceforward',
    'function',
    '(param0: any, param1: any, param2: any) => any',
    'GLSL built-in function faceforward'
  ],
  ['length', 'function', '(param0: any) => any', 'GLSL built-in function length'],
  ['normalize', 'function', '(param0: any) => any', 'GLSL built-in function normalize'],
  [
    'notEqual',
    'function',
    '(param0: any, param1: any) => any | (param0: any, param1: any) => any | (param0: any, param1: any) => any',
    'GLSL built-in function notEqual'
  ],
  ['reflect', 'function', '(param0: any, param1: any) => any', 'GLSL built-in function reflect'],
  [
    'refract',
    'function',
    '(param0: any, param1: any, param2: any) => any',
    'GLSL built-in function refract'
  ],
  [
    'getTexture',
    'function',
    '(param0: any, param1: any) => any',
    'GLSL built-in function getTexture'
  ],
  ['uniformFloat', 'function', '(defaultValue?: any) => any', 'Create a Float uniform variable'],
  ['varyingFloat', 'function', '() => any', 'Create a shared Float to pass data between hooks'],
  ['sharedFloat', 'function', '() => any', 'Create a shared Float to pass data between hooks'],
  ['uniformVec2', 'function', '(defaultValue?: any) => any', 'Create a Vec2 uniform variable'],
  ['varyingVec2', 'function', '() => any', 'Create a shared Vec2 to pass data between hooks'],
  ['sharedVec2', 'function', '() => any', 'Create a shared Vec2 to pass data between hooks'],
  ['uniformVector2', 'function', '(defaultValue?: any) => any', 'Create a Vec2 uniform variable'],
  ['varyingVector2', 'function', '() => any', 'Create a shared Vec2 to pass data between hooks'],
  ['sharedVector2', 'function', '() => any', 'Create a shared Vec2 to pass data between hooks'],
  ['uniformVec3', 'function', '(defaultValue?: any) => any', 'Create a Vec3 uniform variable'],
  ['varyingVec3', 'function', '() => any', 'Create a shared Vec3 to pass data between hooks'],
  ['sharedVec3', 'function', '() => any', 'Create a shared Vec3 to pass data between hooks'],
  ['uniformVector3', 'function', '(defaultValue?: any) => any', 'Create a Vec3 uniform variable'],
  ['varyingVector3', 'function', '() => any', 'Create a shared Vec3 to pass data between hooks'],
  ['sharedVector3', 'function', '() => any', 'Create a shared Vec3 to pass data between hooks'],
  ['uniformVec4', 'function', '(defaultValue?: any) => any', 'Create a Vec4 uniform variable'],
  ['varyingVec4', 'function', '() => any', 'Create a shared Vec4 to pass data between hooks'],
  ['sharedVec4', 'function', '() => any', 'Create a shared Vec4 to pass data between hooks'],
  ['uniformVector4', 'function', '(defaultValue?: any) => any', 'Create a Vec4 uniform variable'],
  ['varyingVector4', 'function', '() => any', 'Create a shared Vec4 to pass data between hooks'],
  ['sharedVector4', 'function', '() => any', 'Create a shared Vec4 to pass data between hooks'],
  ['uniformInt', 'function', '(defaultValue?: any) => any', 'Create a Int uniform variable'],
  ['varyingInt', 'function', '() => any', 'Create a shared Int to pass data between hooks'],
  ['sharedInt', 'function', '() => any', 'Create a shared Int to pass data between hooks'],
  ['uniformIVec2', 'function', '(defaultValue?: any) => any', 'Create a IVec2 uniform variable'],
  ['varyingIVec2', 'function', '() => any', 'Create a shared IVec2 to pass data between hooks'],
  ['sharedIVec2', 'function', '() => any', 'Create a shared IVec2 to pass data between hooks'],
  ['uniformIVector2', 'function', '(defaultValue?: any) => any', 'Create a IVec2 uniform variable'],
  ['varyingIVector2', 'function', '() => any', 'Create a shared IVec2 to pass data between hooks'],
  ['sharedIVector2', 'function', '() => any', 'Create a shared IVec2 to pass data between hooks'],
  ['uniformIVec3', 'function', '(defaultValue?: any) => any', 'Create a IVec3 uniform variable'],
  ['varyingIVec3', 'function', '() => any', 'Create a shared IVec3 to pass data between hooks'],
  ['sharedIVec3', 'function', '() => any', 'Create a shared IVec3 to pass data between hooks'],
  ['uniformIVector3', 'function', '(defaultValue?: any) => any', 'Create a IVec3 uniform variable'],
  ['varyingIVector3', 'function', '() => any', 'Create a shared IVec3 to pass data between hooks'],
  ['sharedIVector3', 'function', '() => any', 'Create a shared IVec3 to pass data between hooks'],
  ['uniformIVec4', 'function', '(defaultValue?: any) => any', 'Create a IVec4 uniform variable'],
  ['varyingIVec4', 'function', '() => any', 'Create a shared IVec4 to pass data between hooks'],
  ['sharedIVec4', 'function', '() => any', 'Create a shared IVec4 to pass data between hooks'],
  ['uniformIVector4', 'function', '(defaultValue?: any) => any', 'Create a IVec4 uniform variable'],
  ['varyingIVector4', 'function', '() => any', 'Create a shared IVec4 to pass data between hooks'],
  ['sharedIVector4', 'function', '() => any', 'Create a shared IVec4 to pass data between hooks'],
  ['uniformBool', 'function', '(defaultValue?: any) => any', 'Create a Bool uniform variable'],
  ['varyingBool', 'function', '() => any', 'Create a shared Bool to pass data between hooks'],
  ['sharedBool', 'function', '() => any', 'Create a shared Bool to pass data between hooks'],
  ['uniformBVec2', 'function', '(defaultValue?: any) => any', 'Create a BVec2 uniform variable'],
  ['varyingBVec2', 'function', '() => any', 'Create a shared BVec2 to pass data between hooks'],
  ['sharedBVec2', 'function', '() => any', 'Create a shared BVec2 to pass data between hooks'],
  ['uniformBVector2', 'function', '(defaultValue?: any) => any', 'Create a BVec2 uniform variable'],
  ['varyingBVector2', 'function', '() => any', 'Create a shared BVec2 to pass data between hooks'],
  ['sharedBVector2', 'function', '() => any', 'Create a shared BVec2 to pass data between hooks'],
  ['uniformBVec3', 'function', '(defaultValue?: any) => any', 'Create a BVec3 uniform variable'],
  ['varyingBVec3', 'function', '() => any', 'Create a shared BVec3 to pass data between hooks'],
  ['sharedBVec3', 'function', '() => any', 'Create a shared BVec3 to pass data between hooks'],
  ['uniformBVector3', 'function', '(defaultValue?: any) => any', 'Create a BVec3 uniform variable'],
  ['varyingBVector3', 'function', '() => any', 'Create a shared BVec3 to pass data between hooks'],
  ['sharedBVector3', 'function', '() => any', 'Create a shared BVec3 to pass data between hooks'],
  ['uniformBVec4', 'function', '(defaultValue?: any) => any', 'Create a BVec4 uniform variable'],
  ['varyingBVec4', 'function', '() => any', 'Create a shared BVec4 to pass data between hooks'],
  ['sharedBVec4', 'function', '() => any', 'Create a shared BVec4 to pass data between hooks'],
  ['uniformBVector4', 'function', '(defaultValue?: any) => any', 'Create a BVec4 uniform variable'],
  ['varyingBVector4', 'function', '() => any', 'Create a shared BVec4 to pass data between hooks'],
  ['sharedBVector4', 'function', '() => any', 'Create a shared BVec4 to pass data between hooks'],
  ['uniformMat2x2', 'function', '(defaultValue?: any) => any', 'Create a Mat2x2 uniform variable'],
  ['varyingMat2x2', 'function', '() => any', 'Create a shared Mat2x2 to pass data between hooks'],
  ['sharedMat2x2', 'function', '() => any', 'Create a shared Mat2x2 to pass data between hooks'],
  ['uniformMat3x3', 'function', '(defaultValue?: any) => any', 'Create a Mat3x3 uniform variable'],
  ['varyingMat3x3', 'function', '() => any', 'Create a shared Mat3x3 to pass data between hooks'],
  ['sharedMat3x3', 'function', '() => any', 'Create a shared Mat3x3 to pass data between hooks'],
  ['uniformMat4x4', 'function', '(defaultValue?: any) => any', 'Create a Mat4x4 uniform variable'],
  ['varyingMat4x4', 'function', '() => any', 'Create a shared Mat4x4 to pass data between hooks'],
  ['sharedMat4x4', 'function', '() => any', 'Create a shared Mat4x4 to pass data between hooks'],
  [
    'uniformSampler2D',
    'function',
    '(defaultValue?: any) => any',
    'Create a Sampler2D uniform variable'
  ],
  [
    'varyingSampler2D',
    'function',
    '() => any',
    'Create a shared Sampler2D to pass data between hooks'
  ],
  [
    'sharedSampler2D',
    'function',
    '() => any',
    'Create a shared Sampler2D to pass data between hooks'
  ],
  [
    'uniformTexture',
    'function',
    '(defaultValue?: any) => any',
    'Create a Sampler2D uniform variable'
  ],
  [
    'varyingTexture',
    'function',
    '() => any',
    'Create a shared Sampler2D to pass data between hooks'
  ],
  [
    'sharedTexture',
    'function',
    '() => any',
    'Create a shared Sampler2D to pass data between hooks'
  ],
  ['vec2', 'function', '(value: any) => any', 'GLSL type constructor for vec2'],
  ['vec3', 'function', '(value: any) => any', 'GLSL type constructor for vec3'],
  ['vec4', 'function', '(value: any) => any', 'GLSL type constructor for vec4'],
  ['ivec2', 'function', '(value: any) => any', 'GLSL type constructor for ivec2'],
  ['ivec3', 'function', '(value: any) => any', 'GLSL type constructor for ivec3'],
  ['ivec4', 'function', '(value: any) => any', 'GLSL type constructor for ivec4'],
  ['bool', 'function', '(value: any) => any', 'GLSL type constructor for bool'],
  ['bvec2', 'function', '(value: any) => any', 'GLSL type constructor for bvec2'],
  ['bvec3', 'function', '(value: any) => any', 'GLSL type constructor for bvec3'],
  ['bvec4', 'function', '(value: any) => any', 'GLSL type constructor for bvec4'],
  ['mat2x2', 'function', '(value: any) => any', 'GLSL type constructor for mat2x2'],
  ['mat3x3', 'function', '(value: any) => any', 'GLSL type constructor for mat3x3'],
  ['mat4x4', 'function', '(value: any) => any', 'GLSL type constructor for mat4x4'],
  ['sampler2D', 'function', '(value: any) => any', 'GLSL type constructor for sampler2D'],
  ['RGB', 'constant', "'rgb'", 'P5 constant: RGB.'],
  ['RGBHDR', 'constant', "'rgbhdr'", 'P5 constant: RGBHDR.'],
  ['HSB', 'constant', "'hsb'", 'HSB (hue, saturation, brightness) is a type of color model.'],
  ['HSL', 'constant', "'hsl'", 'P5 constant: HSL.'],
  ['HWB', 'constant', "'hwb'", 'P5 constant: HWB.'],
  ['LAB', 'constant', "'lab'", 'P5 constant: LAB.'],
  ['LCH', 'constant', "'lch'", 'P5 constant: LCH.'],
  ['OKLAB', 'constant', "'oklab'", 'P5 constant: OKLAB.'],
  ['OKLCH', 'constant', "'oklch'", 'P5 constant: OKLCH.'],
  ['RGBA', 'constant', "'rgba'", 'P5 constant: RGBA.'],
  ['VERSION', 'constant', 'string', 'Version of this p5.js.'],
  ['P2D', 'constant', "'p2d'", 'The default, two-dimensional renderer in p5.js.'],
  [
    'P2DHDR',
    'constant',
    "'p2d-hdr'",
    'A high-dynamic-range (HDR) variant of the default, two-dimensional renderer.'
  ],
  [
    'WEBGL',
    'constant',
    "'webgl'",
    'One of the two render modes in p5.js, used for computationally intensive tasks like 3D rendering and shaders.'
  ],
  [
    'WEBGL2',
    'constant',
    "'webgl2'",
    'One of the two possible values of a WebGL canvas (either WEBGL or WEBGL2), which can be used to determine what capabilities the rendering environment has.'
  ],
  ['ARROW', 'constant', "'default'", 'P5 constant: ARROW.'],
  ['SIMPLE', 'constant', 'string', 'P5 constant: SIMPLE.'],
  ['FULL', 'constant', 'string', 'P5 constant: FULL.'],
  ['CROSS', 'constant', "'crosshair'", 'P5 constant: CROSS.'],
  ['HAND', 'constant', "'pointer'", 'P5 constant: HAND.'],
  ['MOVE', 'constant', "'move'", 'P5 constant: MOVE.'],
  ['TEXT', 'constant', "'text'", 'P5 constant: TEXT.'],
  ['WAIT', 'constant', "'wait'", 'P5 constant: WAIT.'],
  ['HALF_PI', 'constant', 'number', "A `Number` constant that's approximately 1.5708."],
  ['PI', 'constant', 'number', "A `Number` constant that's approximately 3.1416."],
  ['QUARTER_PI', 'constant', 'number', "A `Number` constant that's approximately 0.7854."],
  ['TAU', 'constant', 'number', "A `Number` constant that's approximately 6.2382."],
  ['TWO_PI', 'constant', 'number', "A `Number` constant that's approximately 6.2382."],
  ['DEG_TO_RAD', 'constant', 'number', 'P5 constant: DEG_TO_RAD.'],
  ['RAD_TO_DEG', 'constant', 'number', 'P5 constant: RAD_TO_DEG.'],
  ['CORNER', 'constant', "'corner'", 'P5 constant: CORNER.'],
  ['CORNERS', 'constant', "'corners'", 'P5 constant: CORNERS.'],
  ['RADIUS', 'constant', "'radius'", 'P5 constant: RADIUS.'],
  ['RIGHT', 'constant', "'right'", 'P5 constant: RIGHT.'],
  ['LEFT', 'constant', "'left'", 'P5 constant: LEFT.'],
  ['CENTER', 'constant', "'center'", 'P5 constant: CENTER.'],
  ['TOP', 'constant', "'top'", 'P5 constant: TOP.'],
  ['BOTTOM', 'constant', "'bottom'", 'P5 constant: BOTTOM.'],
  ['BASELINE', 'constant', "'alphabetic'", 'P5 constant: BASELINE.'],
  ['POINTS', 'constant', '0', 'P5 constant: POINTS.'],
  ['LINES', 'constant', '1', 'P5 constant: LINES.'],
  ['LINE_STRIP', 'constant', '3', 'P5 constant: LINE_STRIP.'],
  ['LINE_LOOP', 'constant', '2', 'P5 constant: LINE_LOOP.'],
  ['TRIANGLES', 'constant', '4', 'P5 constant: TRIANGLES.'],
  ['TRIANGLE_FAN', 'constant', '6', 'P5 constant: TRIANGLE_FAN.'],
  ['TRIANGLE_STRIP', 'constant', '5', 'P5 constant: TRIANGLE_STRIP.'],
  ['QUADS', 'constant', "'quads'", 'P5 constant: QUADS.'],
  ['QUAD_STRIP', 'constant', "'quad_strip'", 'P5 constant: QUAD_STRIP.'],
  ['TESS', 'constant', "'tess'", 'P5 constant: TESS.'],
  ['EMPTY_PATH', 'constant', '7', 'P5 constant: EMPTY_PATH.'],
  ['PATH', 'constant', '8', 'P5 constant: PATH.'],
  ['CLOSE', 'constant', "'close'", 'P5 constant: CLOSE.'],
  ['OPEN', 'constant', "'open'", 'P5 constant: OPEN.'],
  ['CHORD', 'constant', "'chord'", 'P5 constant: CHORD.'],
  ['PIE', 'constant', "'pie'", 'P5 constant: PIE.'],
  ['PROJECT', 'constant', "'square'", 'P5 constant: PROJECT.'],
  ['SQUARE', 'constant', "'butt'", 'P5 constant: SQUARE.'],
  ['ROUND', 'constant', "'round'", 'P5 constant: ROUND.'],
  ['BEVEL', 'constant', "'bevel'", 'P5 constant: BEVEL.'],
  ['MITER', 'constant', "'miter'", 'P5 constant: MITER.'],
  [
    'AUTO',
    'constant',
    "'auto'",
    'AUTO allows us to automatically set the width or height of an element (but not both), based on the current height and width of the element.'
  ],
  ['ALT', 'constant', "'Alt'", 'P5 constant: ALT.'],
  ['BACKSPACE', 'constant', "'Backspace'", 'P5 constant: BACKSPACE.'],
  ['CONTROL', 'constant', "'Control' | 'Control'", 'P5 constant: CONTROL.'],
  ['DELETE', 'constant', "'Delete'", 'P5 constant: DELETE.'],
  ['DOWN_ARROW', 'constant', "'ArrowDown'", 'P5 constant: DOWN_ARROW.'],
  ['ENTER', 'constant', "'Enter'", 'P5 constant: ENTER.'],
  ['ESCAPE', 'constant', "'Escape'", 'P5 constant: ESCAPE.'],
  ['LEFT_ARROW', 'constant', "'ArrowLeft'", 'P5 constant: LEFT_ARROW.'],
  ['OPTION', 'constant', "'Alt'", 'P5 constant: OPTION.'],
  ['RETURN', 'constant', "'Enter'", 'P5 constant: RETURN.'],
  ['RIGHT_ARROW', 'constant', "'ArrowRight'", 'P5 constant: RIGHT_ARROW.'],
  ['SHIFT', 'constant', "'Shift'", 'P5 constant: SHIFT.'],
  ['TAB', 'constant', "'Tab'", 'P5 constant: TAB.'],
  ['UP_ARROW', 'constant', "'ArrowUp'", 'P5 constant: UP_ARROW.'],
  ['BLEND', 'constant', "'source-over'", 'P5 constant: BLEND.'],
  ['REMOVE', 'constant', "'destination-out'", 'P5 constant: REMOVE.'],
  ['ADD', 'constant', "'lighter'", 'P5 constant: ADD.'],
  ['DARKEST', 'constant', "'darken'", 'P5 constant: DARKEST.'],
  ['LIGHTEST', 'constant', "'lighten'", 'P5 constant: LIGHTEST.'],
  ['DIFFERENCE', 'constant', "'difference'", 'P5 constant: DIFFERENCE.'],
  ['SUBTRACT', 'constant', "'subtract'", 'P5 constant: SUBTRACT.'],
  ['EXCLUSION', 'constant', "'exclusion'", 'P5 constant: EXCLUSION.'],
  ['MULTIPLY', 'constant', "'multiply'", 'P5 constant: MULTIPLY.'],
  ['SCREEN', 'constant', "'screen'", 'P5 constant: SCREEN.'],
  ['REPLACE', 'constant', "'copy'", 'P5 constant: REPLACE.'],
  ['OVERLAY', 'constant', "'overlay'", 'P5 constant: OVERLAY.'],
  ['HARD_LIGHT', 'constant', "'hard-light'", 'P5 constant: HARD_LIGHT.'],
  ['SOFT_LIGHT', 'constant', "'soft-light'", 'P5 constant: SOFT_LIGHT.'],
  ['DODGE', 'constant', "'color-dodge'", 'P5 constant: DODGE.'],
  ['BURN', 'constant', "'color-burn'", 'P5 constant: BURN.'],
  ['THRESHOLD', 'constant', "'threshold'", 'P5 constant: THRESHOLD.'],
  ['GRAY', 'constant', "'gray'", 'P5 constant: GRAY.'],
  ['OPAQUE', 'constant', "'opaque'", 'P5 constant: OPAQUE.'],
  ['INVERT', 'constant', "'invert'", 'P5 constant: INVERT.'],
  ['POSTERIZE', 'constant', "'posterize'", 'P5 constant: POSTERIZE.'],
  ['DILATE', 'constant', "'dilate'", 'P5 constant: DILATE.'],
  ['ERODE', 'constant', "'erode'", 'P5 constant: ERODE.'],
  ['BLUR', 'constant', "'blur'", 'P5 constant: BLUR.'],
  ['NORMAL', 'constant', "'normal'", 'P5 constant: NORMAL.'],
  ['ITALIC', 'constant', "'italic'", 'P5 constant: ITALIC.'],
  ['BOLD', 'constant', "'bold'", 'P5 constant: BOLD.'],
  ['BOLDITALIC', 'constant', "'bold italic'", 'P5 constant: BOLDITALIC.'],
  ['CHAR', 'constant', "'CHAR'", 'P5 constant: CHAR.'],
  ['WORD', 'constant', "'WORD'", 'P5 constant: WORD.'],
  ['LINEAR', 'constant', "'linear'", 'P5 constant: LINEAR.'],
  ['QUADRATIC', 'constant', "'quadratic'", 'P5 constant: QUADRATIC.'],
  ['BEZIER', 'constant', "'bezier'", 'P5 constant: BEZIER.'],
  ['CURVE', 'constant', "'curve'", 'P5 constant: CURVE.'],
  ['STROKE', 'constant', "'stroke'", 'P5 constant: STROKE.'],
  ['FILL', 'constant', "'fill'", 'P5 constant: FILL.'],
  ['TEXTURE', 'constant', "'texture'", 'P5 constant: TEXTURE.'],
  ['IMMEDIATE', 'constant', "'immediate'", 'P5 constant: IMMEDIATE.'],
  ['IMAGE', 'constant', "'image'", 'P5 constant: IMAGE.'],
  ['NEAREST', 'constant', "'nearest'", 'P5 constant: NEAREST.'],
  ['REPEAT', 'constant', "'repeat'", 'P5 constant: REPEAT.'],
  ['CLAMP', 'constant', "'clamp'", 'P5 constant: CLAMP.'],
  ['MIRROR', 'constant', "'mirror'", 'P5 constant: MIRROR.'],
  ['FLAT', 'constant', "'flat'", 'P5 constant: FLAT.'],
  ['SMOOTH', 'constant', "'smooth'", 'P5 constant: SMOOTH.'],
  ['LANDSCAPE', 'constant', "'landscape'", 'P5 constant: LANDSCAPE.'],
  ['PORTRAIT', 'constant', "'portrait'", 'P5 constant: PORTRAIT.'],
  ['GRID', 'constant', "'grid'", 'P5 constant: GRID.'],
  ['AXES', 'constant', "'axes'", 'P5 constant: AXES.'],
  ['LABEL', 'constant', "'label'", 'P5 constant: LABEL.'],
  ['FALLBACK', 'constant', "'fallback'", 'P5 constant: FALLBACK.'],
  ['CONTAIN', 'constant', "'contain'", 'P5 constant: CONTAIN.'],
  ['COVER', 'constant', "'cover'", 'P5 constant: COVER.'],
  ['UNSIGNED_BYTE', 'constant', "'unsigned-byte'", 'P5 constant: UNSIGNED_BYTE.'],
  ['UNSIGNED_INT', 'constant', "'unsigned-int'", 'P5 constant: UNSIGNED_INT.'],
  ['FLOAT', 'constant', "'float'", 'P5 constant: FLOAT.'],
  ['HALF_FLOAT', 'constant', "'half-float'", 'P5 constant: HALF_FLOAT.'],
  [
    'INCLUDE',
    'constant',
    'Symbol',
    "The `splineProperty('ends')` mode where splines curve through their first and last points."
  ],
  [
    'EXCLUDE',
    'constant',
    'Symbol',
    "The `splineProperty('ends')` mode where the first and last points in a spline affect the direction of the curve, but are not rendered."
  ],
  [
    'frameCount',
    'variable',
    'number',
    'A number that tracks the number of frames drawn since the sketch started.'
  ],
  [
    'deltaTime',
    'variable',
    'number',
    'A number that tracks the number of milliseconds it took to draw the last frame.'
  ],
  [
    'focused',
    'variable',
    'boolean',
    "A `Boolean` variable that's `true` if the browser is focused and `false` if not."
  ],
  [
    'webglVersion',
    'variable',
    "'webgl' | 'webgl2'",
    'A `String` variable with the WebGL version in use.'
  ],
  ['displayWidth', 'variable', 'number', 'A number that stores the width of the screen display.'],
  ['displayHeight', 'variable', 'number', 'A number that stores the height of the screen display.'],
  [
    'windowWidth',
    'variable',
    'number',
    "A number that stores the width of the browser's viewport."
  ],
  [
    'windowHeight',
    'variable',
    'number',
    "A number that stores the height of the browser's viewport."
  ],
  [
    'deviceOrientation',
    'variable',
    "'landscape' | 'portrait'",
    'deviceOrientation always contains the orientation of the device.'
  ],
  [
    'accelerationX',
    'variable',
    'number',
    'accelerationX always contains the acceleration of the device along the x axis.'
  ],
  [
    'accelerationY',
    'variable',
    'number',
    'accelerationY always contains the acceleration of the device along the y axis.'
  ],
  [
    'accelerationZ',
    'variable',
    'number',
    'accelerationZ always contains the acceleration of the device along the z axis.'
  ],
  [
    'pAccelerationX',
    'variable',
    'number',
    'pAccelerationX always contains the acceleration of the device along the x axis in the frame previous to the current frame.'
  ],
  [
    'pAccelerationY',
    'variable',
    'number',
    'pAccelerationY always contains the acceleration of the device along the y axis in the frame previous to the current frame.'
  ],
  [
    'pAccelerationZ',
    'variable',
    'number',
    'pAccelerationZ always contains the acceleration of the device along the z axis in the frame previous to the current frame.'
  ],
  [
    'rotationX',
    'variable',
    'number',
    'rotationX always contains the rotation of the device along the x axis.'
  ],
  [
    'rotationY',
    'variable',
    'number',
    'rotationY always contains the rotation of the device along the y axis.'
  ],
  [
    'rotationZ',
    'variable',
    'number',
    'rotationZ always contains the rotation of the device along the z axis.'
  ],
  [
    'pRotationX',
    'variable',
    'number',
    'pRotationX always contains the rotation of the device along the x axis in the frame previous to the current frame.'
  ],
  [
    'pRotationY',
    'variable',
    'number',
    'pRotationY always contains the rotation of the device along the y axis in the frame previous to the current frame.'
  ],
  [
    'pRotationZ',
    'variable',
    'number',
    'pRotationZ always contains the rotation of the device along the z axis in the frame previous to the current frame.'
  ],
  [
    'turnAxis',
    'variable',
    'string',
    'When a device is rotated, the axis that triggers the deviceTurned() method is stored in the turnAxis variable.'
  ],
  [
    'keyIsPressed',
    'variable',
    'boolean',
    "A boolean that's `true` if any key is currently pressed and `false` if not."
  ],
  ['key', 'variable', 'string', 'A string that contains the value of the last key typed.'],
  [
    'code',
    'variable',
    'string',
    'The `code` property represents a physical key on the keyboard (as opposed to the character generated by pressing the key).'
  ],
  ['keyCode', 'variable', 'number', 'A number that contains the code of the last key pressed.'],
  ['movedX', 'variable', 'number', "A number that tracks the mouse's horizontal movement."],
  ['movedY', 'variable', 'number', "A number that tracks the mouse's vertical movement."],
  ['mouseX', 'variable', 'number', "A number that tracks the mouse's horizontal position."],
  ['mouseY', 'variable', 'number', "A number that tracks the mouse's vertical position."],
  [
    'pmouseX',
    'variable',
    'number',
    "A number that tracks the mouse's previous horizontal position."
  ],
  ['pmouseY', 'variable', 'number', "A number that tracks the mouse's previous vertical position."],
  [
    'winMouseX',
    'variable',
    'number',
    "A number that tracks the mouse's horizontal position within the browser."
  ],
  [
    'winMouseY',
    'variable',
    'number',
    "A number that tracks the mouse's vertical position within the browser."
  ],
  [
    'pwinMouseX',
    'variable',
    'number',
    "A number that tracks the mouse's previous horizontal position within the browser."
  ],
  [
    'pwinMouseY',
    'variable',
    'number',
    "A number that tracks the mouse's previous vertical position within the browser."
  ],
  [
    'mouseButton',
    'variable',
    '{ left: boolean; center: boolean; right: boolean }',
    'An object that tracks the current state of mouse buttons, showing which buttons are pressed at any given moment.'
  ],
  [
    'touches',
    'variable',
    'object[]',
    'A list of all the current touch points on a touchscreen device.'
  ],
  [
    'mouseIsPressed',
    'variable',
    'boolean',
    "A boolean that's `true` if the mouse is pressed and `false` if not."
  ],
  ['width', 'variable', 'number', 'A number that stores the width of the canvas in pixels.'],
  ['height', 'variable', 'number', 'A number that stores the height of the canvas in pixels.'],
  [
    'p5.disableFriendlyErrors',
    'variable',
    'boolean',
    'Turns off the parts of the Friendly Error System (FES) that impact performance.'
  ],
  [
    'drawingContext',
    'variable',
    'CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext',
    "A variable that provides direct access to the sketch's canvas element."
  ],
  ['VIDEO', 'constant', "'video'", 'P5 constant: VIDEO.'],
  ['AUDIO', 'constant', "'audio'", 'P5 constant: AUDIO.'],
  ['pixels', 'variable', 'number[]', 'An array containing the color of each pixel on the canvas.'],
  ['DEGREES', 'constant', "'degrees'", "A `String` constant that's used to set the angleMode()."],
  ['RADIANS', 'constant', "'radians'", "A `String` constant that's used to set the angleMode()."],
  ['p5.Color', 'class', 'p5.Color', 'A class to describe a color.'],
  [
    'p5.Graphics',
    'class',
    'p5.Graphics',
    "A class to describe a drawing surface that's separate from the main canvas."
  ],
  ['p5.Element', 'class', 'p5.Element', 'A class to describe an HTML element.'],
  ['p5.File', 'class', 'p5.File', 'A class to describe a file.'],
  ['p5.MediaElement', 'class', 'p5.MediaElement', 'A class to handle audio and video.'],
  ['p5.Image', 'class', 'p5.Image', 'A class to describe an image.'],
  ['p5.PrintWriter', 'class', 'p5.PrintWriter', 'A class to describe a print stream.'],
  [
    'p5.Table',
    'class',
    'p5.Table',
    'Table objects store data with multiple rows and columns, much like in a traditional spreadsheet.'
  ],
  [
    'p5.TableRow',
    'class',
    'p5.TableRow',
    'A TableRow object represents a single row of data values, stored in columns, from a table.'
  ],
  ['p5.XML', 'class', 'p5.XML', 'A class to describe an XML object.'],
  ['p5.Vector', 'class', 'p5.Vector', 'A class to describe a two or three-dimensional vector.'],
  [
    'p5.Vector.fromAngle',
    'function',
    '(angle: number, length?: number) => Vector',
    'Creates a new 2D vector from an angle.'
  ],
  [
    'p5.Vector.fromAngles',
    'function',
    '(theta: number, phi: number, length?: number) => Vector',
    'Creates a new 3D vector from a pair of ISO spherical angles.'
  ],
  [
    'p5.Vector.random2D',
    'function',
    '() => Vector',
    'Creates a new 2D unit vector with a random heading.'
  ],
  [
    'p5.Vector.random3D',
    'function',
    '() => Vector',
    'Creates a new 3D unit vector with a random heading.'
  ],
  ['p5.Vector.copy', 'function', '(v: Vector) => Vector', 'P5 copy function.'],
  [
    'p5.Vector.add',
    'function',
    '(v1: Vector, v2: Vector, target?: Vector) => Vector',
    'P5 add function.'
  ],
  [
    'p5.Vector.rem',
    'function',
    '(v1: Vector, v2: Vector) => Vector | (v1: Vector, v2: Vector) => Vector',
    'P5 rem function.'
  ],
  [
    'p5.Vector.sub',
    'function',
    '(v1: Vector, v2: Vector, target?: Vector) => Vector',
    'P5 sub function.'
  ],
  [
    'p5.Vector.mult',
    'function',
    '() => Vector | (x: number, y: number, z?: number) => Vector | (v: Vector, n: number, target?: Vector) => Vector | (v0: Vector, v1: Vector, target?: Vector) => Vector | (v0: Vector, arr: number[], target?: Vector) => Vector',
    'Multiplies a vector by a scalar and returns a new vector.'
  ],
  [
    'p5.Vector.rotate',
    'function',
    '() => void | (v: Vector, angle: number, target?: Vector) => void',
    'Rotates the vector (only 2D vectors) by the given angle; magnitude remains the same.'
  ],
  [
    'p5.Vector.div',
    'function',
    '() => Vector | (x: number, y: number, z?: number) => Vector | (v: Vector, n: number, target?: Vector) => Vector | (v0: Vector, v1: Vector, target?: Vector) => Vector | (v0: Vector, arr: number[], target?: Vector) => Vector',
    'Divides a vector by a scalar and returns a new vector.'
  ],
  [
    'p5.Vector.dot',
    'function',
    '() => number | (v1: Vector, v2: Vector) => number',
    'Calculates the dot product of two vectors.'
  ],
  [
    'p5.Vector.cross',
    'function',
    '() => number | (v1: Vector, v2: Vector) => number',
    'Calculates the cross product of two vectors.'
  ],
  [
    'p5.Vector.dist',
    'function',
    '() => number | (v1: Vector, v2: Vector) => number',
    'Calculates the Euclidean distance between two points (considering a point as a vector object).'
  ],
  [
    'p5.Vector.lerp',
    'function',
    '() => Vector | (v1: Vector, v2: Vector, amt: number, target?: Vector) => Vector',
    'Linear interpolate a vector to another vector and return the result as a new vector.'
  ],
  [
    'p5.Vector.slerp',
    'function',
    '() => Vector | (v1: Vector, v2: Vector, amt: number, target?: Vector) => Vector',
    'Performs spherical linear interpolation with the other vector and returns the resulting vector.'
  ],
  [
    'p5.Vector.mag',
    'function',
    '() => number | (vecT: Vector) => number',
    'Calculates the magnitude (length) of the vector and returns the result as a float (this is simply the equation `sqrt(x*x + y*y + z*z)`.)'
  ],
  [
    'p5.Vector.magSq',
    'function',
    '() => number | (vecT: Vector) => number',
    'Calculates the squared magnitude of the vector and returns the result as a float (this is simply the equation (x*x + y*y + z*z).) Faster if the real length is not required in the case of comparing vectors, etc.'
  ],
  [
    'p5.Vector.normalize',
    'function',
    '() => Vector | (v: Vector, target?: Vector) => Vector',
    'Normalize the vector to length 1 (make it a unit vector).'
  ],
  [
    'p5.Vector.limit',
    'function',
    '() => Vector | (v: Vector, max: number, target?: Vector) => Vector',
    'Limit the magnitude of the vector to the value used for the max parameter.'
  ],
  [
    'p5.Vector.setMag',
    'function',
    '() => Vector | (v: Vector, len: number, target?: Vector) => Vector',
    'Set the magnitude of the vector to the value used for the len parameter.'
  ],
  [
    'p5.Vector.heading',
    'function',
    '() => number | (v: Vector) => number',
    'Calculate the angle of rotation for this vector (only 2D vectors).'
  ],
  [
    'p5.Vector.angleBetween',
    'function',
    '() => number | (v1: Vector, v2: Vector) => number',
    'Calculates and returns the angle between two vectors.'
  ],
  [
    'p5.Vector.reflect',
    'function',
    '() => Vector | (incidentVector: Vector, surfaceNormal: Vector, target?: Vector) => Vector',
    'Reflect a vector about a normal to a line in 2D, or about a normal to a plane in 3D.'
  ],
  [
    'p5.Vector.array',
    'function',
    '() => number[] | (v: Vector) => number[]',
    'Return a representation of this vector as a float array.'
  ],
  [
    'p5.Vector.equals',
    'function',
    '() => boolean | (v1: Vector | any[], v2: Vector | any[]) => boolean',
    'Equality check against a p5.Vector'
  ],
  ['p5.Font', 'class', 'p5.Font', 'A class to describe fonts.'],
  ['p5.Camera', 'class', 'p5.Camera', 'A class to describe a camera for viewing a 3D sketch.'],
  [
    'p5.Framebuffer',
    'class',
    'p5.Framebuffer',
    'A class to describe a high-performance drawing surface for textures.'
  ],
  ['p5.Geometry', 'class', 'p5.Geometry', 'A class to describe a 3D shape.'],
  ['p5.Shader', 'class', 'p5.Shader', 'A class to describe a shader program.'],
  ['p5.Renderer', 'class', 'p5.Renderer', 'P5 Renderer constructor.'],
  ['p5.Renderer2D', 'class', 'p5.Renderer2D', 'P5 Renderer2D constructor.'],
  ['p5.RendererGL', 'class', 'p5.RendererGL', 'P5 RendererGL constructor.'],
  ['p5.FramebufferTexture', 'class', 'p5.FramebufferTexture', 'P5 FramebufferTexture constructor.'],
  ['p5.Texture', 'class', 'p5.Texture', 'P5 Texture constructor.'],
  ['p5.Quat', 'class', 'p5.Quat', 'P5 Quat constructor.']
];
