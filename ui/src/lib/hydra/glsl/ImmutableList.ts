/**
 * Bare bones append only immutable list.
 */
export default class ImmutableList<T> {
  readonly parent: ImmutableList<T> | undefined;

  readonly element: T;

  constructor(element: T, parent?: ImmutableList<T>) {
    this.parent = parent;
    this.element = element;
  }

  append(element: T): ImmutableList<T> {
    return new ImmutableList(element, this);
  }

  toArray(): T[] {
    if (!this.parent) {
      return [this.element];
    }
    const elements = this.parent.toArray();
    elements.push(this.element);
    return elements;
  }

  forEach(callbackfn: (value: T, index: number, array: T[]) => void) {
    this.toArray().forEach(callbackfn);
  }
}
