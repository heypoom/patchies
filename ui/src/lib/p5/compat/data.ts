type TouchCallback = ((event: MouseEvent) => unknown) | false;

interface CompatElement {
  mousePressed: (callback: TouchCallback) => unknown;
  mouseReleased: (callback: TouchCallback) => unknown;
  mouseMoved: (callback: TouchCallback) => unknown;

  touchStarted: (callback: TouchCallback) => unknown;
  touchEnded: (callback: TouchCallback) => unknown;
  touchMoved: (callback: TouchCallback) => unknown;
}

interface DataPrototype {
  mousePressed: (...args: unknown[]) => unknown;
  mouseReleased: (...args: unknown[]) => unknown;
  mouseDragged: (...args: unknown[]) => unknown;
  touchStarted: (...args: unknown[]) => unknown;
  touchEnded: (...args: unknown[]) => unknown;
  touchMoved: (...args: unknown[]) => unknown;

  append: <T>(array: T[], value: T) => T[];

  arrayCopy: <T>(
    src: T[],
    srcPosition: number | T[],
    dst?: T[] | number,
    dstPosition?: number,
    length?: number
  ) => void;

  concat: <T>(list0: T[], list1: T[]) => T[];
  reverse: <T>(list: T[]) => T[];
  shorten: <T>(list: T[]) => T[];
  sort: <T extends string | number>(list: T[], count?: number) => T[];
  splice: <T>(list: T[], value: T | T[], index: number) => T[];
  subset: <T>(list: T[], start: number, count?: number) => T[];
  join: (list: unknown[], separator?: string) => string;
  match: (str: string, reg: string | RegExp) => RegExpMatchArray | null;
  matchAll: (str: string, reg: string | RegExp) => RegExpExecArray[];
  split: (str: string, delim: string | RegExp) => string[];
  trim: { (str: string): string; (str: string[]): string[] };

  createStringDict: (
    key: string | Record<string, string>,
    value?: string
  ) => CompatDictionary<string>;

  createNumberDict: (
    key: string | Record<string, number>,
    value?: number
  ) => CompatNumberDictionary;

  downloadFile: (blob: Blob, filename: string, extension: string) => void;
  saveJSON: (data: unknown, filename?: string, opt?: boolean) => void;
}

interface CompatDictionary<T> {
  data: Record<string, T>;
  size: () => number;
  hasKey: (key: string) => boolean;
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  create: (key?: string | Record<string, T>, value?: T) => void;
  clear: () => void;
  remove: (key: string) => void;
  print: () => void;
  saveTable: (filename?: string) => void;
  saveJSON: (filename?: string, opt?: boolean) => void;
}

interface CompatNumberDictionary extends CompatDictionary<number> {
  add: (key: string, amount: number) => void;
  sub: (key: string, amount: number) => void;
  mult: (key: string, amount: number) => void;
  div: (key: string, amount: number) => void;
  minValue: () => number;
  maxValue: () => number;
  minKey: () => string;
  maxKey: () => string;
}

interface DataConstructor {
  Element: { prototype: CompatElement };

  TypedDict: new (
    key?: string | Record<string, unknown>,
    value?: unknown
  ) => CompatDictionary<unknown>;

  StringDict: new (
    key?: string | Record<string, string>,
    value?: string
  ) => CompatDictionary<string>;

  NumberDict: new (key?: string | Record<string, number>, value?: number) => CompatNumberDictionary;
}

export function addData(p5: DataConstructor, fn: DataPrototype) {
  fn.touchStarted = function (...args) {
    return this.mousePressed(...args);
  };

  fn.touchEnded = function (...args) {
    return this.mouseReleased(...args);
  };

  fn.touchMoved = function (...args) {
    return this.mouseDragged(...args);
  };

  p5.Element.prototype.touchStarted = function (callback) {
    return this.mousePressed(callback);
  };

  p5.Element.prototype.touchEnded = function (callback) {
    return this.mouseReleased(callback);
  };

  p5.Element.prototype.touchMoved = function (callback) {
    if (callback === false) {
      return this.mouseMoved(false);
    }

    return this.mouseMoved(function (event) {
      if ((event.buttons & 1) !== 0) {
        return callback(event);
      }
    });
  };

  fn.append = function (array, value) {
    array.push(value);

    return array;
  };

  fn.arrayCopy = function <T>(
    src: T[],
    srcPosition: number | T[],
    dst?: T[] | number,
    dstPosition?: number,
    length?: number
  ) {
    const start = length !== undefined ? dstPosition! : 0;
    const end = Math.min(length ?? (typeof dst === 'number' ? dst : src.length), src.length);

    const destination = (length !== undefined ? dst : srcPosition) as T[];
    const sourceStart = length !== undefined ? (srcPosition as number) : 0;

    const values = src.slice(sourceStart, sourceStart + end);

    destination.splice(start, end, ...values);
  };

  fn.concat = (list0, list1) => list0.concat(list1);

  fn.reverse = (list) => list.reverse();

  fn.shorten = function (list) {
    list.pop();

    return list;
  };

  fn.sort = function (list, count) {
    let arr = count ? list.slice(0, Math.min(count, list.length)) : list;
    const rest = count ? list.slice(Math.min(count, list.length)) : [];

    if (typeof arr[0] === 'string') {
      arr = arr.sort();
    } else {
      arr = arr.sort((a, b) => Number(a) - Number(b));
    }

    return arr.concat(rest);
  };

  fn.splice = function (list, value, index) {
    // note that splice returns spliced elements and not an array
    list.splice(index, 0, ...(Array.isArray(value) ? value : [value]));

    return list;
  };

  fn.subset = function (list, start, count) {
    if (typeof count !== 'undefined') {
      return list.slice(start, start + count);
    } else {
      return list.slice(start, list.length);
    }
  };

  fn.join = (list, separator) => list.join(separator);

  fn.match = (str, reg) => str.match(reg);

  fn.matchAll = function (str, reg) {
    const re = new RegExp(reg, 'g');
    let match = re.exec(str);

    const matches: RegExpExecArray[] = [];

    while (match !== null) {
      matches.push(match);

      // matched text: match[0]
      // match start: match.index
      // capturing group n: match[n]
      match = re.exec(str);
    }

    return matches;
  };

  fn.split = (str, delim) => str.split(delim);

  function trim(str: string): string;
  function trim(str: string[]): string[];

  function trim(str: string | string[]): string | string[] {
    if (Array.isArray(str)) {
      return str.map((value) => value.trim());
    }

    return str.trim();
  }

  fn.trim = trim;

  fn.createStringDict = (key, value) => new p5.StringDict(key, value);

  fn.createNumberDict = (key, value) => new p5.NumberDict(key, value);

  class TypedDict<T> {
    data: Record<string, T>;

    constructor(key?: string | Record<string, T>, value?: T) {
      if (key instanceof Object) {
        this.data = key;
      } else {
        this.data = {};
        this.data[String(key)] = value as T;
      }

      return this;
    }

    size() {
      return Object.keys(this.data).length;
    }

    hasKey(key: string) {
      return Object.prototype.hasOwnProperty.call(this.data, key);
    }

    get(key: string) {
      if (Object.prototype.hasOwnProperty.call(this.data, key)) {
        return this.data[key];
      } else {
        console.log(`${key} does not exist in this Dictionary`);
      }
    }

    set(key: string, value: T) {
      if (this._validate(value)) {
        this.data[key] = value;
      } else {
        console.log('Those values dont work for this dictionary type.');
      }
    }

    _addObj(obj: Record<string, T>) {
      for (const key in obj) {
        this.set(key, obj[key]);
      }
    }

    create(key?: string | Record<string, T>, value?: T) {
      if (key instanceof Object && typeof value === 'undefined') {
        this._addObj(key);
      } else if (typeof key !== 'undefined') {
        this.set(String(key), value as T);
      } else {
        console.log(
          'In order to create a new Dictionary entry you must pass ' +
            'an object or a key, value pair'
        );
      }
    }

    clear() {
      this.data = {};
    }

    remove(key: string) {
      if (Object.prototype.hasOwnProperty.call(this.data, key)) {
        delete this.data[key];
      } else {
        throw new Error(`${key} does not exist in this Dictionary`);
      }
    }

    print() {
      for (const item in this.data) {
        console.log(`key:${item} value:${this.data[item]}`);
      }
    }

    saveTable(filename?: string) {
      let output = '';

      for (const key in this.data) {
        output += `${key},${this.data[key]}\n`;
      }

      const blob = new Blob([output], { type: 'text/csv' });
      fn.downloadFile(blob, filename || 'mycsv', 'csv');
    }

    saveJSON(filename?: string, opt?: boolean) {
      fn.saveJSON(this.data, filename, opt);
    }

    // Subclasses validate the value; the base dictionary accepts any value.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _validate(_value: unknown) {
      return true;
    }
  }

  class StringDict extends TypedDict<string> {
    _validate(value: unknown) {
      return typeof value === 'string';
    }
  }

  class NumberDict extends TypedDict<number> {
    _validate(value: unknown) {
      return typeof value === 'number';
    }

    add(key: string, amount: number) {
      if (Object.prototype.hasOwnProperty.call(this.data, key)) {
        this.data[key] += amount;
      } else {
        console.log(`The key - ${key} does not exist in this dictionary.`);
      }
    }

    sub(key: string, amount: number) {
      this.add(key, -amount);
    }

    mult(key: string, amount: number) {
      if (Object.prototype.hasOwnProperty.call(this.data, key)) {
        this.data[key] *= amount;
      } else {
        console.log(`The key - ${key} does not exist in this dictionary.`);
      }
    }

    div(key: string, amount: number) {
      if (Object.prototype.hasOwnProperty.call(this.data, key)) {
        this.data[key] /= amount;
      } else {
        console.log(`The key - ${key} does not exist in this dictionary.`);
      }
    }

    _valueTest(flip: number) {
      if (Object.keys(this.data).length === 0) {
        throw new Error('Unable to search for a minimum or maximum value on an empty NumberDict');
      } else if (Object.keys(this.data).length === 1) {
        return this.data[Object.keys(this.data)[0]];
      } else {
        let result = this.data[Object.keys(this.data)[0]];

        for (const key in this.data) {
          if (this.data[key] * flip < result * flip) {
            result = this.data[key];
          }
        }

        return result;
      }
    }

    minValue() {
      return this._valueTest(1);
    }

    maxValue() {
      return this._valueTest(-1);
    }

    _keyTest(flip: number) {
      if (Object.keys(this.data).length === 0) {
        throw new Error('Unable to use minValue on an empty NumberDict');
      } else if (Object.keys(this.data).length === 1) {
        return Object.keys(this.data)[0];
      } else {
        let result = Object.keys(this.data)[0];

        for (let i = 1; i < Object.keys(this.data).length; i++) {
          if (Number(Object.keys(this.data)[i]) * flip < Number(result) * flip) {
            result = Object.keys(this.data)[i];
          }
        }

        return result;
      }
    }

    minKey() {
      return this._keyTest(1);
    }

    maxKey() {
      return this._keyTest(-1);
    }
  }

  p5.TypedDict = TypedDict;
  p5.StringDict = StringDict;
  p5.NumberDict = NumberDict;
}
