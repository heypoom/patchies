function addData(p5, fn) {
	fn.touchStarted = function (...args) {
		return this.mousePressed(...args);
	};
	fn.touchEnded = function (...args) {
		return this.mouseReleased(...args);
	};
	fn.touchMoved = function (...args) {
		return this.mouseDragged(...args);
	};
	p5.Element.prototype.touchStarted = function (cb) {
		return this.mousePressed(cb);
	};
	p5.Element.prototype.touchEnded = function (cb) {
		return this.mouseReleased(cb);
	};
	p5.Element.prototype.touchMoved = function (cb) {
		if (cb === false) {
			return this.mouseMoved(false);
		}
		return this.mouseMoved(function (event) {
			if ((event.buttons & 1) !== 0) {
				return cb(event);
			}
		});
	};

	fn.append = function (array, value) {
		array.push(value);
		return array;
	};

	fn.arrayCopy = function (src, srcPosition, dst, dstPosition, length) {
		// the index to begin splicing from dst array
		let start;
		let end;

		if (typeof length !== 'undefined') {
			end = Math.min(length, src.length);
			start = dstPosition;
			src = src.slice(srcPosition, end + srcPosition);
		} else {
			if (typeof dst !== 'undefined') {
				// src, dst, length
				// rename  so we don't get confused
				end = dst;
				end = Math.min(end, src.length);
			} else {
				// src, dst
				end = src.length;
			}

			start = 0;
			// rename  so we don't get confused
			dst = srcPosition;
			src = src.slice(0, end);
		}

		// Since we are not returning the array and JavaScript is pass by reference
		// we must modify the actual values of the array
		// instead of reassigning arrays
		Array.prototype.splice.apply(dst, [start, end].concat(src));
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
			arr = arr.sort((a, b) => a - b);
		}
		return arr.concat(rest);
	};

	fn.splice = function (list, value, index) {
		// note that splice returns spliced elements and not an array
		Array.prototype.splice.apply(list, [index, 0].concat(value));

		return list;
	};

	fn.subset = function (list, start, count) {
		if (typeof count !== 'undefined') {
			return list.slice(start, start + count);
		} else {
			return list.slice(start, list.length);
		}
	};

	fn.join = function (list, separator) {
		return list.join(separator);
	};

	fn.match = function (str, reg) {
		return str.match(reg);
	};

	fn.matchAll = function (str, reg) {
		const re = new RegExp(reg, 'g');
		let match = re.exec(str);
		const matches = [];
		while (match !== null) {
			matches.push(match);
			// matched text: match[0]
			// match start: match.index
			// capturing group n: match[n]
			match = re.exec(str);
		}
		return matches;
	};

	fn.split = function (str, delim) {
		return str.split(delim);
	};

	fn.trim = function (str) {
		if (str instanceof Array) {
			return str.map(this.trim);
		} else {
			return str.trim();
		}
	};

	fn.createStringDict = function (key, value) {
		return new p5.StringDict(key, value);
	};

	fn.createNumberDict = function (key, value) {
		return new p5.NumberDict(key, value);
	};

	p5.TypedDict = class TypedDict {
		constructor(key, value) {
			if (key instanceof Object) {
				this.data = key;
			} else {
				this.data = {};
				this.data[key] = value;
			}
			return this;
		}

		size() {
			return Object.keys(this.data).length;
		}

		hasKey(key) {
			return this.data.hasOwnProperty(key);
		}

		get(key) {
			if (this.data.hasOwnProperty(key)) {
				return this.data[key];
			} else {
				console.log(`${key} does not exist in this Dictionary`);
			}
		}

		set(key, value) {
			if (this._validate(value)) {
				this.data[key] = value;
			} else {
				console.log('Those values dont work for this dictionary type.');
			}
		}

		_addObj(obj) {
			for (const key in obj) {
				this.set(key, obj[key]);
			}
		}

		create(key, value) {
			if (key instanceof Object && typeof value === 'undefined') {
				this._addObj(key);
			} else if (typeof key !== 'undefined') {
				this.set(key, value);
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

		remove(key) {
			if (this.data.hasOwnProperty(key)) {
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

		saveTable(filename) {
			let output = '';

			for (const key in this.data) {
				output += `${key},${this.data[key]}\n`;
			}

			const blob = new Blob([output], { type: 'text/csv' });
			fn.downloadFile(blob, filename || 'mycsv', 'csv');
		}

		saveJSON(filename, opt) {
			fn.saveJSON(this.data, filename, opt);
		}

		_validate(value) {
			return true;
		}
	};

	p5.StringDict = class StringDict extends p5.TypedDict {
		constructor(...args) {
			super(...args);
		}

		_validate(value) {
			return typeof value === 'string';
		}
	};

	p5.NumberDict = class NumberDict extends p5.TypedDict {
		constructor(...args) {
			super(...args);
		}

		_validate(value) {
			return typeof value === 'number';
		}

		add(key, amount) {
			if (this.data.hasOwnProperty(key)) {
				this.data[key] += amount;
			} else {
				console.log(`The key - ${key} does not exist in this dictionary.`);
			}
		}

		sub(key, amount) {
			this.add(key, -amount);
		}

		mult(key, amount) {
			if (this.data.hasOwnProperty(key)) {
				this.data[key] *= amount;
			} else {
				console.log(`The key - ${key} does not exist in this dictionary.`);
			}
		}

		div(key, amount) {
			if (this.data.hasOwnProperty(key)) {
				this.data[key] /= amount;
			} else {
				console.log(`The key - ${key} does not exist in this dictionary.`);
			}
		}

		_valueTest(flip) {
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

		_keyTest(flip) {
			if (Object.keys(this.data).length === 0) {
				throw new Error('Unable to use minValue on an empty NumberDict');
			} else if (Object.keys(this.data).length === 1) {
				return Object.keys(this.data)[0];
			} else {
				let result = Object.keys(this.data)[0];
				for (let i = 1; i < Object.keys(this.data).length; i++) {
					if (Object.keys(this.data)[i] * flip < result * flip) {
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
	};
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
	module.exports = addData;
}

// Also support direct invocation
if (typeof window !== 'undefined') {
	window.addDataCompat = function (p5) {
		if (p5 && p5.registerAddon) {
			p5.registerAddon(addData);
		}
	};
}
