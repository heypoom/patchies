function addPreload(p5, fn, lifecycles) {
	const methods = {
		loadImage: () => new p5.Image(1, 1),
		loadModel: () => new p5.Geometry(),
		loadJSON: () => {},
		loadStrings: () => [],
		loadFont: (pInst) => new p5.Font(pInst, new FontFace('default', 'default.woff'))
	};

	p5.isPreloadSupported = function () {
		return true;
	};

	const promises = [];
	const prevMethods = {};

	// Override existing methods to return an object immediately,
	// and keep track of all things being loaded
	for (const method in methods) {
		const prevMethod = fn[method];
		prevMethods[method] = prevMethod;

		fn[method] = function (...args) {
			if (!this._isInPreload) {
				return prevMethod.apply(this, args);
			}
			const obj = methods[method](this);
			const promise = prevMethod.apply(this, args).then((result) => {
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

		const obj = {};
		const promise = prevLoadBytes.apply(this, args).then((result) => {
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

		const obj = new p5.Table();
		const promise = prevLoadTable.apply(this, args).then((result) => {
			for (const key in result) {
				obj[key] = result[key];
			}
		});
		promises.push(promise);
		return obj;
	};

	// Storage for registered method callbacks
	const registeredMethods = {
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

		if (!window.preload) return;

		this._isInPreload = true;
		window.preload();
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

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
	module.exports = addPreload;
}

// Also support direct invocation
if (typeof window !== 'undefined') {
	window.addPreloadCompat = function (p5) {
		if (p5 && p5.registerAddon) {
			p5.registerAddon(addPreload);
		}
	};
}
