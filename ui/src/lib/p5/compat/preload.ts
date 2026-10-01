type LoadedObject = Record<string, unknown>;
type Loader = (this: PreloadSketch, ...args: unknown[]) => Promise<LoadedObject> | LoadedObject;
type MethodName = 'init' | 'afterSetup' | 'pre' | 'post' | 'remove';
type LifecycleCallback = (this: PreloadSketch) => void;

interface PreloadSketch {
  _isInPreload?: boolean;
  loadImage: Loader;
  loadModel: Loader;
  loadJSON: Loader;
  loadStrings: Loader;
  loadFont: Loader;
  loadBytes: (this: PreloadSketch, ...args: unknown[]) => unknown;
  loadTable: Loader;
  registerMethod: (methodName: MethodName, callback: LifecycleCallback) => void;
}

interface PreloadConstructor {
  Image: new (width: number, height: number) => object;
  Geometry: new () => object;
  Font: new (sketch: PreloadSketch, face: FontFace) => object;
  Table: new () => object;
  prototype: PreloadSketch;
  isPreloadSupported?: () => boolean;
}

type PreloadLifecycles = Partial<
  Record<
    'presetup' | 'postsetup' | 'predraw' | 'postdraw' | 'remove',
    (this: PreloadSketch) => void | Promise<void>
  >
>;

export function addPreload(
  p5: PreloadConstructor,
  fn: PreloadSketch,
  lifecycles: PreloadLifecycles
) {
  const methods = {
    loadImage: () => new p5.Image(1, 1),
    loadModel: () => new p5.Geometry(),
    loadJSON: () => undefined,
    loadStrings: () => [],
    loadFont: (pInst: PreloadSketch) => new p5.Font(pInst, new FontFace('default', 'default.woff'))
  };

  p5.isPreloadSupported = () => true;

  const promises: Promise<void>[] = [];

  // Override existing methods to return an object immediately,
  // and keep track of all things being loaded
  for (const method of Object.keys(methods) as (keyof typeof methods)[]) {
    const prevMethod = fn[method];

    fn[method] = function (...args) {
      if (!this._isInPreload) {
        return prevMethod.apply(this, args);
      }

      const obj = methods[method](this) as LoadedObject;
      const promise = (prevMethod.apply(this, args) as Promise<LoadedObject>).then((result) => {
        for (const key in result) {
          obj[key] = result[key];
        }
      });
      promises.push(promise);

      return obj;
    };
  }

  const prevLoadBytes = fn.loadBytes;
  fn.loadBytes = function (...args) {
    if (!this._isInPreload) return prevLoadBytes.apply(this, args);

    const obj: LoadedObject = {};
    const promise = (prevLoadBytes.apply(this, args) as Promise<unknown>).then((result) => {
      obj.bytes = result;
    });
    promises.push(promise);

    return obj;
  };

  const prevLoadTable = fn.loadTable;
  fn.loadTable = function (...args) {
    if (args.length > 1 && args[1] instanceof String) {
      if (args[1] === 'csv') {
        args[1] = ',';
      } else if (args[1] === 'tsv') {
        args[1] = '\t';
      } else if (args[1] === 'ssv') {
        args[1] = ';';
      }
    }

    if (!this._isInPreload) return prevLoadTable.apply(this, args);

    const obj = new p5.Table() as LoadedObject;
    const promise = (prevLoadTable.apply(this, args) as Promise<LoadedObject>).then((result) => {
      for (const key in result) {
        obj[key] = result[key];
      }
    });
    promises.push(promise);

    return obj;
  };

  // Storage for registered method callbacks
  const registeredMethods: Record<MethodName, LifecycleCallback[]> = {
    init: [],
    afterSetup: [],
    pre: [],
    post: [],
    remove: []
  };

  // Implement registerMethod similar to p5.js v1
  p5.prototype.registerMethod = function (methodName, callback) {
    if (registeredMethods[methodName]) {
      registeredMethods[methodName].push(callback);
    } else {
      console.warn(`p5.registerMethod: "${methodName}" is not a valid method name`);
    }
  };

  lifecycles.presetup = async function () {
    // Call init callbacks first
    for (const callback of registeredMethods.init) {
      callback.call(this);
    }

    const preload = (window as Window & { preload?: () => void }).preload;

    if (!preload) return;

    this._isInPreload = true;
    preload.call(window);
    this._isInPreload = false;

    // Wait for everything to load before letting setup run
    await Promise.all(promises);
  };

  // Hook into postsetup for afterSetup callbacks
  lifecycles.postsetup = function () {
    for (const callback of registeredMethods.afterSetup) {
      callback.call(this);
    }
  };

  // Hook into other lifecycle events
  lifecycles.predraw = function () {
    for (const callback of registeredMethods.pre) {
      callback.call(this);
    }
  };

  lifecycles.postdraw = function () {
    for (const callback of registeredMethods.post) {
      callback.call(this);
    }
  };

  lifecycles.remove = function () {
    for (const callback of registeredMethods.remove) {
      callback.call(this);
    }
  };
}
