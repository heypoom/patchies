function addShapes(p5, fn, lifecycles) {
	const oldBezierVertex = fn.bezierVertex;
	const oldEndContour = fn.endContour;
	const oldEndShape = fn.endShape;
	const oldCurveDetail = fn.curveDetail;

	lifecycles.predraw = function () {
		this.splineProperty('ends', this.EXCLUDE);
	};

	fn.quadraticVertex = function (...args) {
		this.bezierOrder(2);
		if (args.length === 4) {
			const [x1, y1, x2, y2] = args;
			oldBezierVertex.call(this, x1, y1);
			oldBezierVertex.call(this, x2, y2);
		} else if (args.length === 6) {
			const [x1, y1, z1, x2, y2, z2] = args;
			oldBezierVertex.call(this, x1, y1, z1);
			oldBezierVertex.call(this, x2, y2, z2);
		} else {
			throw new Error(
				`quadraticVertex() was expecting either 4 or 6 arguments, but it was called with ${args.length}.`
			);
		}
	};

	fn.bezierVertex = function (...args) {
		this.bezierOrder(3);
		if (args.length === 6) {
			const [x1, y1, x2, y2, x3, y3] = args;
			oldBezierVertex.call(this, x1, y1);
			oldBezierVertex.call(this, x2, y2);
			oldBezierVertex.call(this, x3, y3);
		} else if (args.length === 9) {
			const [x1, y1, z1, x2, y2, z2, x3, y3, z3] = args;
			oldBezierVertex.call(this, x1, y1, z1);
			oldBezierVertex.call(this, x2, y2, z2);
			oldBezierVertex.call(this, x3, y3, z3);
		} else {
			throw new Error(
				`bezierVertex() was expecting either 6 or 9 arguments, but it was called with ${args.length}.`
			);
		}
	};

	fn.curveVertex = function (...args) {
		return this.splineVertex(...args);
	};

	fn.curveTightness = function (value) {
		return this.splineProperty('tightness', value);
	};

	fn.endContour = function (mode = this.CLOSE, count) {
		oldEndContour.call(this, mode, count);
	};

	fn.endShape = function (mode) {
		const shape = this._renderer._currentShape?.at?.(-1, -1);
		if (shape) {
			shape.handlesClose = () => false;
		}
		oldEndShape.call(this, mode);
	};

	fn.curve = function (...args) {
		return this.spline(...args);
	};

	fn.beginGeometry = function (...args) {
		return this._renderer.beginGeometry(...args);
	};
	fn.endGeometry = function (...args) {
		return this._renderer.endGeometry(...args);
	};

	for (const key of ['curveDetail', 'bezierDetail']) {
		fn[key] = function (numPoints) {
			// p5 2.0's curveDetail defined *density* while 1.x's defined *absolute number of points.*
			// The only way to do a true conversion would involve updating the value dynamically based
			// on the length of the curve. Since this would be complex to do as an addon, we do
			// the calculation based on an approximate average curve length.
			const avgLength = Math.hypot(this.width, this.height) / 3;
			if (numPoints) {
				const density = numPoints / avgLength;
				return oldCurveDetail.call(this, density);
			} else {
				return oldCurveDetail.call(this) * avgLength;
			}
		};
	}

	fn.curvePoint = function (...args) {
		return this.splinePoint(...args);
	};
	fn.curveTangent = function (...args) {
		return this.splineTangent(...args);
	};
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
	module.exports = addShapes;
}

// Also support direct invocation
if (typeof window !== 'undefined') {
	window.addShapesCompat = function (p5) {
		if (p5 && p5.registerAddon) {
			p5.registerAddon(addShapes);
		}
	};
}
