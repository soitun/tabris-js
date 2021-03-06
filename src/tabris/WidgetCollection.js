import NativeObject from './NativeObject';

export default class WidgetCollection {

  constructor(collection, selector, deep) {
    let arr = collection instanceof WidgetCollection ? collection.toArray() : collection;
    this._array = select(arr, selector || '*', deep);
    for (let i = 0; i < this._array.length; i++) {
      this[i] = this._array[i];
    }
  }

  get length() {
    return this._array.length;
  }

  first(selector) {
    if (selector) {
      return this.filter(selector).first();
    }
    return this._array[0];
  }

  last(selector) {
    if (selector) {
      return this.filter(selector).last();
    }
    return this._array[this._array.length - 1];
  }

  toArray() {
    return this._array.concat();
  }

  forEach(callback) {
    this._array.forEach((value, index) => callback(value, index, this));
  }

  indexOf(needle) {
    return this._array.indexOf(needle);
  }

  includes(needle) {
    return this._array.indexOf(needle) !== -1;
  }

  filter(selector) {
    return new WidgetCollection(this._array, selector);
  }

  get(prop) {
    if (this._array[0]) {
      return this._array[0].get(prop);
    }
  }

  parent() {
    let result = [];
    for (let widget of this._array) {
      let parent = widget.parent();
      if (parent && result.indexOf(parent) === -1) {
        result.push(parent);
      }
    }
    if (result.length) {
      return new WidgetCollection(result);
    }
  }

  children(selector) {
    let result = [];
    for (let widget of this._array) {
      result.push.apply(result, widget.children());
    }
    return new WidgetCollection(result, selector);
  }

  find(selector) {
    return new WidgetCollection(this.children()._array, selector, true);
  }

  appendTo(parent) {
    parent.append(this);
  }

  set() {
    this._array.forEach(widget => widget.set.apply(widget, arguments));
    return this;
  }

  on() {
    this._array.forEach(widget => widget.on.apply(widget, arguments));
    return this;
  }

  off() {
    this._array.forEach(widget => widget.off.apply(widget, arguments));
    return this;
  }

  once() {
    this._array.forEach(widget => widget.once.apply(widget, arguments));
    return this;
  }

  trigger() {
    this._array.forEach(widget => widget.trigger.apply(widget, arguments));
    return this;
  }

  animate() {
    this._array.forEach(widget => widget.animate.apply(widget, arguments));
  }

  dispose() {
    this._array.forEach(widget => widget.dispose.apply(widget, arguments));
  }

  [Symbol.iterator]() {
    let index = 0;
    return {
      next: () => index < this.length
        ? {value: this[index++], done: false}
        : {done: true}
    };
  }

}

function select(array, selector, deep) {
  if (!array || array.length === 0) {
    return [];
  }
  if (selector === '*' && !deep) {
    return array.concat();
  }
  let filter = getFilter(selector);
  if (deep) {
    return deepSelect([], array, filter);
  }
  return array.filter(filter);
}

function deepSelect(result, iterable, filter) {
  for (let widget of iterable) {
    if (filter(widget)) {
      result.push(widget);
    }
    let children = widget.children();
    if (children instanceof WidgetCollection && children.length) {
      deepSelect(result, children, filter);
    }
  }
  return result;
}

function getFilter(selector) {
  let matches = {};
  let filter = isFilter(selector) ? selector : createMatcher(selector);
  return (widget) => {
    if (matches[widget.cid]) {
      return false;
    }
    if (filter(widget)) {
      matches[widget.cid] = true;
      return true;
    }
    return false;
  };
}

function createMatcher(selector) {
  if (selector instanceof Function) {
    return widget => widget instanceof selector;
  }
  if (selector.charAt(0) === '#') {
    let expectedId = selector.slice(1);
    return widget => expectedId === widget.id;
  }
  if (selector.charAt(0) === '.') {
    let expectedClass = selector.slice(1);
    return widget => widget.classList.indexOf(expectedClass) !== -1;
  }
  if (selector === '*') {
    return () => true;
  }
  return widget => selector === widget.constructor.name;
}

function isFilter(selector) {
  return selector instanceof Function && !isWidgetConstructor(selector);
}

function isWidgetConstructor(fn) {
  let proto = fn.prototype;
  while (proto) {
    // Use NativeObject since importing Widget would causes circulary module dependency issues
    if (proto === NativeObject.prototype) {
      return true;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
