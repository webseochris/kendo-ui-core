(function(f, define) {
    define([
        "../util/main", "../mixins/observers"
    ], f);
})(function() {

(function() {
    /* jshint latedef: nofunc */
    // Imports ================================================================
    var math = Math,
        pow = math.pow,

        kendo = window.kendo,
        Class = kendo.Class,
        deepExtend = kendo.deepExtend,
        ObserversMixin = kendo.mixins.ObserversMixin,

        util = kendo.util,
        defined = util.defined,
        rad = util.rad,
        deg = util.deg,
        round = util.round;

    var PI_DIV_2 = math.PI / 2,
        MIN_NUM = util.MIN_NUM,
        MAX_NUM = util.MAX_NUM,
        PRECISION = 10;

    // Geometrical primitives =================================================
    var Point = Class.extend({
        init: function(x, y) {
            this.x = x || 0;
            this.y = y || 0;
        },

        equals: function(other) {
            return other && other.x === this.x && other.y === this.y;
        },

        clone: function() {
            return new Point(this.x, this.y);
        },

        rotate: function(angle, origin) {
            return this.transform(
                transform().rotate(angle, origin)
            );
        },

        translate: function(x, y) {
            this.x += x;
            this.y += y;

            this.geometryChange();

            return this;
        },

        translateWith: function(point) {
            return this.translate(point.x, point.y);
        },

        move: function(x, y) {
            this.x = this.y = 0;
            return this.translate(x, y);
        },

        scale: function(scaleX, scaleY) {
            if (!defined(scaleY)) {
                scaleY = scaleX;
            }

            this.x *= scaleX;
            this.y *= scaleY;

            this.geometryChange();

            return this;
        },

        scaleCopy: function(scaleX, scaleY) {
            return this.clone().scale(scaleX, scaleY);
        },

        transform: function(transformation) {
            var mx = toMatrix(transformation),
                x = this.x,
                y = this.y;

            this.x = mx.a * x + mx.c * y + mx.e;
            this.y = mx.b * x + mx.d * y + mx.f;

            this.geometryChange();

            return this;
        },

        transformCopy: function(transformation) {
            var point = this.clone();

            if (transformation) {
                point.transform(transformation);
            }

            return point;
        },

        distanceTo: function(point) {
            var dx = this.x - point.x;
            var dy = this.y - point.y;

            return math.sqrt(dx * dx + dy * dy);
        },

        round: function(digits) {
            this.x = round(this.x, digits);
            this.y = round(this.y, digits);

            this.geometryChange();

            return this;
        },

        toArray: function(digits) {
            var doRound = defined(digits);
            var x = doRound ? round(this.x, digits) : this.x;
            var y = doRound ? round(this.y, digits) : this.y;

            return [x, y];
        }
    });
    defineAccessors(Point.fn, ["x", "y"]);
    deepExtend(Point.fn, ObserversMixin);

    // IE < 9 doesn't allow to override toString on definition
    Point.fn.toString = function(digits, separator) {
        var x = this.x,
            y = this.y;

        if (defined(digits)) {
            x = round(x, digits);
            y = round(y, digits);
        }

        separator = separator || " ";
        return x + separator + y;
    };

    Point.create = function(arg0, arg1) {
        if (defined(arg0)) {
            if (arg0 instanceof Point) {
                return arg0;
            } else if (arguments.length === 1 && arg0.length === 2) {
                return new Point(arg0[0], arg0[1]);
            } else {
                return new Point(arg0, arg1);
            }
        }
    };

    Point.min = function() {
        var minX = util.MAX_NUM;
        var minY = util.MAX_NUM;

        for (var i = 0; i < arguments.length; i++) {
            var pt = arguments[i];
            minX = math.min(pt.x, minX);
            minY = math.min(pt.y, minY);
        }

        return new Point(minX, minY);
    };

    Point.max = function() {
        var maxX = util.MIN_NUM;
        var maxY = util.MIN_NUM;

        for (var i = 0; i < arguments.length; i++) {
            var pt = arguments[i];
            maxX = math.max(pt.x, maxX);
            maxY = math.max(pt.y, maxY);
        }

        return new Point(maxX, maxY);
    };

    Point.minPoint = function() {
        return new Point(MIN_NUM, MIN_NUM);
    };

    Point.maxPoint = function() {
        return new Point(MAX_NUM, MAX_NUM);
    };

    Point.ZERO = new Point(0, 0);

    var Size = Class.extend({
        init: function(width, height) {
            this.width = width || 0;
            this.height = height || 0;
        },

        equals: function(other) {
            return other && other.width === this.width && other.height === this.height;
        },

        clone: function() {
            return new Size(this.width, this.height);
        },

        toArray: function(digits) {
            var doRound = defined(digits);
            var width = doRound ? round(this.width, digits) : this.width;
            var height = doRound ? round(this.height, digits) : this.height;

            return [width, height];
        }
    });
    defineAccessors(Size.fn, ["width", "height"]);
    deepExtend(Size.fn, ObserversMixin);

    Size.create = function(arg0, arg1) {
        if (defined(arg0)) {
            if (arg0 instanceof Size) {
                return arg0;
            } else if (arguments.length === 1 && arg0.length === 2) {
                return new Size(arg0[0], arg0[1]);
            } else {
                return new Size(arg0, arg1);
            }
        }
    };

    Size.ZERO = new Size(0, 0);

    var Rect = Class.extend({
        init: function(origin, size) {
            this.setOrigin(origin || new Point());
            this.setSize(size || new Size());
        },

        clone: function() {
            return new Rect(
                this.origin.clone(),
                this.size.clone()
            );
        },

        equals: function(other) {
            return other &&
                   other.origin.equals(this.origin) &&
                   other.size.equals(this.size);
        },

        setOrigin: function(value) {
            this._observerField("origin", Point.create(value));
            this.geometryChange();
            return this;
        },

        getOrigin: function() {
            return this.origin;
        },

        setSize: function(value) {
            this._observerField("size", Size.create(value));
            this.geometryChange();
            return this;
        },

        getSize: function() {
            return this.size;
        },

        width: function() {
            return this.size.width;
        },

        height: function() {
            return this.size.height;
        },

        topLeft: function() {
            return this.origin.clone();
        },

        bottomRight: function() {
            return this.origin.clone().translate(this.width(), this.height());
        },

        topRight: function() {
            return this.origin.clone().translate(this.width(), 0);
        },

        bottomLeft: function() {
            return this.origin.clone().translate(0, this.height());
        },

        center: function() {
            return this.origin.clone().translate(this.width() / 2, this.height() / 2);
        },

        bbox: function(matrix) {
            var tl = this.topLeft().transformCopy(matrix);
            var tr = this.topRight().transformCopy(matrix);
            var br = this.bottomRight().transformCopy(matrix);
            var bl = this.bottomLeft().transformCopy(matrix);

            return Rect.fromPoints(tl, tr, br, bl);
        },

        transformCopy: function(m) {
            return Rect.fromPoints(
                this.topLeft().transform(m),
                this.bottomRight().transform(m)
            );
        },

        expand: function(x, y) {
            if (!defined(y)) {
                y = x;
            }
            this.size.width += 2 * x;
            this.size.height += 2 * y;

            this.origin.translate(-x, -y);

            return this;
        },

        expandCopy: function(x, y) {
            return this.clone().expand(x, y);
        },

        containsPoint: function(point) {
            var origin = this.origin;
            var bottomRight = this.bottomRight();
            return !(point.x < origin.x || point.y < origin.y || bottomRight.x < point.x || bottomRight.y < point.y);
        },

        _isOnPath: function(point, width) {
            var rectOuter = this.expandCopy(width, width);
            var rectInner = this.expandCopy(-width, -width);

            return rectOuter.containsPoint(point) && !rectInner.containsPoint(point);
        }
    });

    deepExtend(Rect.fn, ObserversMixin);

    Rect.fromPoints = function() {
        var topLeft = Point.min.apply(this, arguments);
        var bottomRight = Point.max.apply(this, arguments);
        var size = new Size(
            bottomRight.x - topLeft.x,
            bottomRight.y - topLeft.y
        );

        return new Rect(topLeft, size);
    };

    Rect.union = function(a, b) {
        return Rect.fromPoints(
            Point.min(a.topLeft(), b.topLeft()),
            Point.max(a.bottomRight(), b.bottomRight())
        );
    };

    Rect.intersect = function(a, b) {
        a = { left   : a.topLeft().x,
              top    : a.topLeft().y,
              right  : a.bottomRight().x,
              bottom : a.bottomRight().y };

        b = { left   : b.topLeft().x,
              top    : b.topLeft().y,
              right  : b.bottomRight().x,
              bottom : b.bottomRight().y };

        if (a.left <= b.right &&
            b.left <= a.right &&
            a.top <= b.bottom &&
            b.top <= a.bottom)
        {
            return Rect.fromPoints(
                new Point(math.max(a.left, b.left), math.max(a.top, b.top)),
                new Point(math.min(a.right, b.right), math.min(a.bottom, b.bottom))
            );
        }
    };

    var Circle = Class.extend({
        init: function(center, radius) {
            this.setCenter(center || new Point());
            this.setRadius(radius || 0);
        },

        setCenter: function(value) {
            this._observerField("center", Point.create(value));
            this.geometryChange();
            return this;
        },

        getCenter: function() {
            return this.center;
        },

        equals: function(other) {
            return  other &&
                    other.center.equals(this.center) &&
                    other.radius === this.radius;
        },

        clone: function() {
            return new Circle(this.center.clone(), this.radius);
        },

        pointAt: function(angle) {
            return this._pointAt(rad(angle));
        },

        bbox: function(matrix) {
            var minPoint = Point.maxPoint();
            var maxPoint = Point.minPoint();
            var extremeAngles = ellipseExtremeAngles(this.center, this.radius, this.radius, matrix);

            for (var i = 0; i < 4; i++) {
                var currentPointX = this._pointAt(extremeAngles.x + i * PI_DIV_2).transformCopy(matrix);
                var currentPointY = this._pointAt(extremeAngles.y + i * PI_DIV_2).transformCopy(matrix);
                var currentPoint = new Point(currentPointX.x, currentPointY.y);

                minPoint = Point.min(minPoint, currentPoint);
                maxPoint = Point.max(maxPoint, currentPoint);
            }

            // TODO: Let fromPoints figure out the min/max
            return Rect.fromPoints(minPoint, maxPoint);
        },

        _pointAt: function(angle) {
            var c = this.center;
            var r = this.radius;

            return new Point(
                c.x - r * math.cos(angle),
                c.y - r * math.sin(angle)
            );
        },

        containsPoint: function(point) {
            var center = this.center;
            var inCircle = math.pow(point.x - center.x, 2) +
                math.pow(point.y - center.y, 2) <= math.pow(this.radius, 2);
            return inCircle;
        },

        _isOnPath: function(point, width) {
            var center = this.center;
            var radius = this.radius;
            var pointDistance = center.distanceTo(point);

            return radius - width <= pointDistance && pointDistance <= radius + width;
        }
    });
    defineAccessors(Circle.fn, ["radius"]);
    deepExtend(Circle.fn, ObserversMixin);

    var Arc = Class.extend({
        init: function(center, options) {
            this.setCenter(center || new Point());

            options = options || {};
            this.radiusX = options.radiusX;
            this.radiusY = options.radiusY || options.radiusX;
            this.startAngle = options.startAngle;
            this.endAngle = options.endAngle;
            this.anticlockwise = options.anticlockwise || false;
        },

        // TODO: clone, equals
        clone: function() {
            return new Arc(this.center, {
                radiusX: this.radiusX,
                radiusY: this.radiusY,
                startAngle: this.startAngle,
                endAngle: this.endAngle,
                anticlockwise: this.anticlockwise
            });
        },

        setCenter: function(value) {
            this._observerField("center", Point.create(value));
            this.geometryChange();
            return this;
        },

        getCenter: function() {
            return this.center;
        },

        MAX_INTERVAL: 45,

        pointAt: function(angle) {
            var center = this.center;
            var radian = rad(angle);

            return new Point(
                center.x + this.radiusX * math.cos(radian),
                center.y + this.radiusY * math.sin(radian)
            );
        },

        // TODO: Review, document
        curvePoints: function() {
            var startAngle = this.startAngle;
            var dir = this.anticlockwise ? -1 : 1;
            var curvePoints = [this.pointAt(startAngle)];
            var currentAngle = startAngle;
            var interval = this._arcInterval();
            var intervalAngle = interval.endAngle - interval.startAngle;
            var subIntervalsCount = math.ceil(intervalAngle / this.MAX_INTERVAL);
            var subIntervalAngle = intervalAngle / subIntervalsCount;

            for (var i = 1; i <= subIntervalsCount; i++) {
                var nextAngle = currentAngle + dir * subIntervalAngle;
                var points = this._intervalCurvePoints(currentAngle, nextAngle);

                curvePoints.push(points.cp1, points.cp2, points.p2);
                currentAngle = nextAngle;
            }

            return curvePoints;
        },

        bbox: function(matrix) {
            var arc = this;
            var interval = arc._arcInterval();
            var startAngle = interval.startAngle;
            var endAngle = interval.endAngle;
            var extremeAngles = ellipseExtremeAngles(this.center, this.radiusX, this.radiusY, matrix);
            var extremeX = deg(extremeAngles.x);
            var extremeY = deg(extremeAngles.y);
            var currentPoint = arc.pointAt(startAngle).transformCopy(matrix);
            var endPoint = arc.pointAt(endAngle).transformCopy(matrix);
            var minPoint = Point.min(currentPoint, endPoint);
            var maxPoint = Point.max(currentPoint, endPoint);
            var currentAngleX = bboxStartAngle(extremeX, startAngle);
            var currentAngleY = bboxStartAngle(extremeY, startAngle);

            while (currentAngleX < endAngle || currentAngleY < endAngle) {
                var currentPointX;
                if (currentAngleX < endAngle) {
                    currentPointX = arc.pointAt(currentAngleX).transformCopy(matrix);
                    currentAngleX += 90;
                }

                var currentPointY;
                if (currentAngleY < endAngle) {
                    currentPointY = arc.pointAt(currentAngleY).transformCopy(matrix);
                    currentAngleY += 90;
                }

                currentPoint = new Point(currentPointX.x, currentPointY.y);
                minPoint = Point.min(minPoint, currentPoint);
                maxPoint = Point.max(maxPoint, currentPoint);
            }

            // TODO: Let fromPoints figure out the min/max
            return Rect.fromPoints(minPoint, maxPoint);
        },

        _arcInterval: function() {
            var startAngle = this.startAngle;
            var endAngle = this.endAngle;
            var anticlockwise = this.anticlockwise;

            if (anticlockwise) {
                var oldStart = startAngle;
                startAngle = endAngle;
                endAngle = oldStart;
            }

            if (startAngle > endAngle || (anticlockwise && startAngle === endAngle)) {
                endAngle += 360;
            }

            return {
                startAngle: startAngle,
                endAngle: endAngle
            };
        },

        _intervalCurvePoints: function(startAngle, endAngle) {
            var arc = this;
            var p1 = arc.pointAt(startAngle);
            var p2 = arc.pointAt(endAngle);
            var p1Derivative = arc._derivativeAt(startAngle);
            var p2Derivative = arc._derivativeAt(endAngle);
            var t = (rad(endAngle) - rad(startAngle)) / 3;
            var cp1 = new Point(p1.x + t * p1Derivative.x, p1.y + t * p1Derivative.y);
            var cp2 = new Point(p2.x - t * p2Derivative.x, p2.y - t * p2Derivative.y);

            return {
                p1: p1,
                cp1: cp1,
                cp2: cp2,
                p2: p2
            };
        },

        _derivativeAt: function(angle) {
            var arc = this;
            var radian = rad(angle);

            return new Point(-arc.radiusX * math.sin(radian), arc.radiusY * math.cos(radian));
        },

        containsPoint: function(point) {
            var interval = this._arcInterval();
            var intervalAngle = interval.endAngle - interval.startAngle;
            var center = this.center;
            var distance = center.distanceTo(point);
            var angleRad = math.atan2(point.y - center.y, point.x - center.x);
            var pointRadius = (this.radiusX * this.radiusY) /
                math.sqrt(math.pow(this.radiusX, 2) * math.pow(math.sin(angleRad), 2) + math.pow(this.radiusY, 2) * math.pow(math.cos(angleRad), 2));
            var startPoint = this.pointAt(this.startAngle).round(PRECISION);
            var endPoint = this.pointAt(this.endAngle).round(PRECISION);
            var intersection = lineIntersection(center, point.round(PRECISION), startPoint, endPoint);
            var containsPoint;

            if (intervalAngle < 180) {
                containsPoint = intersection && closeOrLess(center.distanceTo(intersection), distance) && closeOrLess(distance, pointRadius);
            } else {
                var angle = calculateAngle(center.x, center.y, this.radiusX, this.radiusY, point.x, point.y);
                if (angle != 360) {
                    angle = (360 + angle) % 360;
                }

                var inAngleRange = interval.startAngle <= angle && angle <= interval.endAngle;
                containsPoint = (inAngleRange && closeOrLess(distance, pointRadius)) || (!inAngleRange && (!intersection || intersection.equals(point)));
            }
            return containsPoint;
        },

        _isOnPath: function(point, width) {
            var interval = this._arcInterval();
            var center = this.center;
            var angle = calculateAngle(center.x, center.y, this.radiusX, this.radiusY, point.x, point.y);
            if (angle != 360) {
                angle = (360 + angle) % 360;
            }

            var inAngleRange = interval.startAngle <= angle && angle <= interval.endAngle;

            return inAngleRange && this.pointAt(angle).distanceTo(point) <= width;
        }
    });
    defineAccessors(Arc.fn, ["radiusX", "radiusY", "startAngle", "endAngle", "anticlockwise"]);
    deepExtend(Arc.fn, ObserversMixin);

    Arc.fromPoints = function(start, end, rx, ry, largeArc, swipe) {
        var arcParameters = normalizeArcParameters(start.x, start.y, end.x, end.y, rx, ry, largeArc, swipe);
        return new Arc(arcParameters.center, {
            startAngle: arcParameters.startAngle,
            endAngle: arcParameters.endAngle,
            radiusX: rx,
            radiusY: ry,
            anticlockwise: swipe === 0
        });
    };

    var Matrix = Class.extend({
        init: function (a, b, c, d, e, f) {
            this.a = a || 0;
            this.b = b || 0;
            this.c = c || 0;
            this.d = d || 0;
            this.e = e || 0;
            this.f = f || 0;
        },

        multiplyCopy: function (m) {
            return new Matrix(
                this.a * m.a + this.c * m.b,
                this.b * m.a + this.d * m.b,
                this.a * m.c + this.c * m.d,
                this.b * m.c + this.d * m.d,
                this.a * m.e + this.c * m.f + this.e,
                this.b * m.e + this.d * m.f + this.f
            );
        },

        // Invert function for general 3x3 matrixes, based on
        // http://en.wikipedia.org/wiki/Invertible_matrix#Inversion_of_3.C3.973_matrices
        // (simplified below for transformation matrixes, where the
        // last col is constant, but let's keep this commented here)
        //
        // invert: function() {
        //     var a = this.a, b = this.b, c = 0;
        //     var d = this.c, e = this.d, f = 0;
        //     var g = this.e, h = this.f, i = 1;
        //
        //     var A =  (e*i - f*h), D = -(b*i - c*h), G =  (b*f - c*e);
        //     var B = -(d*i - f*g), E =  (a*i - c*g), H = -(a*f - c*d);
        //     var C =  (d*h - e*g), F = -(a*h - b*g), I =  (a*e - b*d);
        //
        //     var det = a*A + b*B + c*C;
        //     if (det === 0) {
        //         return null;
        //     }
        //
        //     return new Matrix(A/det, D/det, B/det, E/det, C/det, F/det);
        // },

        invert: function() {
            var a = this.a, b = this.b;
            var d = this.c, e = this.d;
            var g = this.e, h = this.f;

            var det = a*e - b*d;
            if (det === 0) {
                return null;
            }

            return new Matrix(e/det, -b/det, -d/det, a/det,
                              (d*h - e*g)/det, (b*g - a*h)/det);
        },

        clone: function() {
            return new Matrix(this.a, this.b, this.c, this.d, this.e, this.f);
        },

        equals: function(other) {
            if (!other) {
                return false;
            }

            return this.a === other.a && this.b === other.b &&
                   this.c === other.c && this.d === other.d &&
                   this.e === other.e && this.f === other.f;
        },

        round: function(precision) {
            this.a = round(this.a, precision);
            this.b = round(this.b, precision);
            this.c = round(this.c, precision);
            this.d = round(this.d, precision);
            this.e = round(this.e, precision);
            this.f = round(this.f, precision);

            return this;
        },

        toArray: function(precision) {
            var arr = [this.a, this.b, this.c, this.d, this.e, this.f];

            if (defined(precision)) {
                for (var i = 0; i < arr.length; i++) {
                    arr[i] = round(arr[i], precision);
                }
            }

            return arr;
        }
    });

    Matrix.fn.toString = function(precision, separator) {
        return this.toArray(precision).join(separator || ",");
    };

    Matrix.translate = function (x, y) {
        return new Matrix(1, 0, 0, 1, x, y);
    };

    Matrix.unit = function () {
        return new Matrix(1, 0, 0, 1, 0, 0);
    };

    Matrix.rotate = function (angle, x, y) {
        var m = new Matrix();
        m.a = math.cos(rad(angle));
        m.b = math.sin(rad(angle));
        m.c = -m.b;
        m.d = m.a;
        m.e = (x - x * m.a + y * m.b) || 0;
        m.f = (y - y * m.a - x * m.b) || 0;

        return m;
    };

    Matrix.scale = function (scaleX, scaleY) {
        return new Matrix(scaleX, 0, 0, scaleY, 0, 0);
    };

    Matrix.IDENTITY = Matrix.unit();

    var Transformation = Class.extend({
        init: function(matrix) {
            this._matrix = matrix || Matrix.unit();
        },

        clone: function() {
            return new Transformation(
                this._matrix.clone()
            );
        },

        equals: function(other) {
            return other &&
                   other._matrix.equals(this._matrix);
        },

        _optionsChange: function() {
            this.optionsChange({
                field: "transform",
                value: this
            });
        },

        translate: function(x, y) {
            this._matrix = this._matrix.multiplyCopy(Matrix.translate(x, y));

            this._optionsChange();
            return this;
        },

        scale: function(scaleX, scaleY, origin) {
            if (!defined(scaleY)) {
               scaleY = scaleX;
            }

            if (origin) {
                origin = Point.create(origin);
                this._matrix = this._matrix.multiplyCopy(Matrix.translate(origin.x, origin.y));
            }

            this._matrix = this._matrix.multiplyCopy(Matrix.scale(scaleX, scaleY));

            if (origin) {
                this._matrix = this._matrix.multiplyCopy(Matrix.translate(-origin.x, -origin.y));
            }

            this._optionsChange();
            return this;
        },

        rotate: function(angle, origin) {
            origin = Point.create(origin) || Point.ZERO;

            this._matrix = this._matrix.multiplyCopy(Matrix.rotate(angle, origin.x, origin.y));

            this._optionsChange();
            return this;
        },

        multiply: function(transformation) {
            var matrix = toMatrix(transformation);

            this._matrix = this._matrix.multiplyCopy(matrix);

            this._optionsChange();
            return this;
        },

        matrix: function(matrix) {
            if (matrix) {
                this._matrix = matrix;
                this._optionsChange();
                return this;
            } else {
                return this._matrix;
            }
        }
    });

    deepExtend(Transformation.fn, ObserversMixin);

    function transform(matrix) {
        if (matrix === null) {
            return null;
        }

        if (matrix instanceof Transformation) {
            return matrix;
        }

        return new Transformation(matrix);
    }

    function toMatrix(value) {
        if (value && kendo.isFunction(value.matrix)) {
            return value.matrix();
        }

        return value;
    }

    // Helper functions =======================================================
    function ellipseExtremeAngles(center, rx, ry, matrix) {
        var extremeX = 0,
            extremeY = 0;

        if (matrix) {
            extremeX = math.atan2(matrix.c * ry, matrix.a * rx);
            if (matrix.b !== 0) {
                extremeY = math.atan2(matrix.d * ry, matrix.b * rx);
            }
        }

        return {
            x: extremeX,
            y: extremeY
        };
    }

    function bboxStartAngle(angle, start) {
        while(angle < start) {
            angle += 90;
        }

        return angle;
    }

    function defineAccessors(fn, fields) {
        for (var i = 0; i < fields.length; i++) {
            var name = fields[i];
            var capitalized = name.charAt(0).toUpperCase() +
                              name.substring(1, name.length);

            fn["set" + capitalized] = setAccessor(name);
            fn["get" + capitalized] = getAccessor(name);
        }
    }

    function setAccessor(field) {
        return function(value) {
            if (this[field] !== value) {
                this[field] = value;
                this.geometryChange();
            }

            return this;
        };
    }

    function getAccessor(field) {
        return function() {
            return this[field];
        };
    }


    function elipseAngle(start, end, swipe) {
        if (start > end) {
            end += 360;
        }

        var alpha = math.abs(end - start);
        if (!swipe) {
            alpha = 360 - alpha;
        }

        return alpha;
    }

    function calculateAngle(cx, cy, rx, ry, x, y) {
        var cos = round((x - cx) / rx, 3);
        var sin = round((y - cy) / ry, 3);

        return round(deg(math.atan2(sin, cos)));
    }

    function normalizeArcParameters(x1, y1, x2, y2, rx, ry, largeArc, swipe) {
        var cx, cy;
        var cx1, cy1;
        var a, b, c, sqrt;

        if  (y1 !== y2) {
            var x21 = x2 - x1;
            var y21 = y2 - y1;
            var rx2 = pow(rx, 2), ry2 = pow(ry, 2);
            var k = (ry2 * x21 * (x1 + x2) + rx2 * y21 * (y1 + y2)) / (2 * rx2 * y21);
            var yk2 = k - y2;
            var l = -(x21 * ry2) / (rx2 * y21);

            a = 1 / rx2 + pow(l, 2) / ry2;
            b = 2 * ((l * yk2) / ry2 - x2 / rx2);
            c = pow(x2, 2) / rx2 + pow(yk2, 2) / ry2 - 1;
            sqrt = math.sqrt(pow(b, 2) - 4 * a * c);

            cx = (-b - sqrt) / (2 * a);
            cy = k + l * cx;
            cx1 = (-b + sqrt) / (2 * a);
            cy1 = k + l * cx1;
        } else if (x1 !== x2) {
            b = - 2 * y2;
            c = pow(((x2 - x1) * ry) / (2 * rx), 2) + pow(y2, 2) - pow(ry, 2);
            sqrt = math.sqrt(pow(b, 2) - 4 * c);

            cx = cx1 = (x1 + x2) / 2;
            cy = (-b - sqrt) / 2;
            cy1 = (-b + sqrt) / 2;
        } else {
            return false;
        }

        var start = calculateAngle(cx, cy, rx, ry, x1, y1);
        var end = calculateAngle(cx, cy, rx, ry, x2, y2);
        var alpha = elipseAngle(start, end, swipe);

        if ((largeArc && alpha <= 180) || (!largeArc && alpha > 180)) {
           cx = cx1; cy = cy1;
           start = calculateAngle(cx, cy, rx, ry, x1, y1);
           end = calculateAngle(cx, cy, rx, ry, x2, y2);
        }

        return {
            center: new Point(cx, cy),
            startAngle: start,
            endAngle: end
        };
    }

    var ComplexNumber = function(real, img) {
        this.real  = real || 0;
        this.img = img || 0;
    };

    ComplexNumber.fn = ComplexNumber.prototype = {
        add: function(cNumber) {
            return new ComplexNumber(round(this.real + cNumber.real, PRECISION), round(this.img + cNumber.img, PRECISION));
        },

        addConstant: function(value) {
            return new ComplexNumber(this.real + value, this.img);
        },

        negate: function(){
            return new ComplexNumber(-this.real, -this.img);
        },

        multiply: function(cNumber) {
            return new ComplexNumber(this.real * cNumber.real - this.img * cNumber.img,
                this.real * cNumber.img + this.img * cNumber.real);
        },

        multiplyConstant: function(value) {
            return new ComplexNumber(this.real * value, this.img * value);
        },

        nthRoot: function(n) {
            var rad = math.atan2(this.img, this.real),
                r = math.sqrt(math.pow(this.img, 2) + math.pow(this.real, 2)),
                nthR = math.pow(r, 1 / n);
            return new ComplexNumber(nthR * math.cos(rad / n), nthR * math.sin(rad / n)); //Moivre's formula
        },

        equals: function(cNumber) {
            return this.real === cNumber.real && this.img === cNumber.img;
        },

        isReal: function() {
            return this.img === 0;
        }
    };

    //Cardano's formula
    function solveCubic(a, b, c, d) {
        if (a === 0) {
            return solveQuadratic(b, c, d);
        }

        var p =  (3 * a * c - math.pow(b, 2)) / (3 * math.pow(a, 2)),
            q =  (2 * math.pow(b, 3) - 9 * a * b * c + 27 * math.pow(a, 2) * d) / (27 * math.pow(a, 3)),
            Q = math.pow(p / 3, 3) + math.pow(q / 2, 2),
            i = new ComplexNumber(0,1),
            b3a = -b / (3 * a),
            x1, x2,
            y1, y2, y3,
            result = [],
            z1, z2;

        if (Q < 0) {
            x1 = new ComplexNumber(-q / 2, math.sqrt(-Q)).nthRoot(3);
            x2 = new ComplexNumber(-q / 2, - math.sqrt(-Q)).nthRoot(3);
        } else {
            x1 = -q / 2 + math.sqrt(Q);
            x1 = new ComplexNumber(numberSign(x1) * math.pow(math.abs(x1), 1/3));
            x2 = -q / 2 - math.sqrt(Q);
            x2 = new ComplexNumber(numberSign(x2) * math.pow(math.abs(x2), 1/3));
        }

        y1 = x1.add(x2);

        z1 = x1.add(x2).multiplyConstant(-1 / 2);
        z2 = x1.add(x2.negate()).multiplyConstant(math.sqrt(3) / 2);

        y2 = z1.add(i.multiply(z2));
        y3 = z1.add(i.negate().multiply(z2));

        if (y1.isReal()) {
            result.push(round(y1.real + b3a, PRECISION));
        }
        if (y2.isReal()) {
            result.push(round(y2.real + b3a, PRECISION));
        }
        if (y3.isReal()) {
            result.push(round(y3.real + b3a, PRECISION));
        }

        return result;
    }

    function toCubicPolynomial(points, field) {
        return [-points[0][field] + 3 * points[1][field] - 3 * points[2][field] + points[3][field],
            3 * (points[0][field] - 2 * points[1][field] + points[2][field]),
            3 * (-points[0][field] + points[1][field]),
            points[0][field]
        ];
    }

    function calculateCurveAt(t, field, points) {
        var t1 = 1- t;
        return math.pow(t1, 3) * points[0][field] +
            3 * math.pow(t1, 2) * t * points[1][field] +
            3 * math.pow(t, 2) * t1 * points[2][field] +
            math.pow(t, 3) * points[3][field];
    }

    function curveIntersectionsCount(points, point, bbox) {
        var polynomial = toCubicPolynomial(points, "x");
        var roots = solveCubic(polynomial[0], polynomial[1], polynomial[2], polynomial[3] - point.x);
        var count = 0;
        var rayIntersection;
        var intersectsRay;
        for (var i = 0; i < roots.length ; i++) {
            rayIntersection = calculateCurveAt(roots[i], "y", points);
            intersectsRay = close(rayIntersection, point.y) || rayIntersection > point.y;
            if (intersectsRay && (((roots[i] === 0 || roots[i] === 1) && bbox.bottomRight().x > point.x) || (0 < roots[i] && roots[i] < 1))) {
                count++;
            }
        }

        return count;
    }

    function lineIntersectionsCount(a, b, point) {
        var intersects;
        if (a.x != b.x) {
            var minX = math.min(a.x, b.x),
                maxX = math.max(a.x, b.x),
                minY = math.min(a.y, b.y),
                maxY = math.max(a.y, b.y),
                inRange = minX <= point.x && point.x < maxX;

            if (minY == maxY) {
                intersects = point.y <= minY && inRange;
            } else {
                intersects = inRange && (((maxY - minY) * ((a.x - b.x) * (a.y - b.y) > 0 ? point.x - minX : maxX - point.x)) / (maxX - minX) + minY - point.y) >= 0;
            }
        }
        return intersects ? 1 : 0;
    }

    function lineIntersection (p0, p1, p2, p3) {
        var s1x = p1.x - p0.x;
        var s2x = p3.x - p2.x;
        var s1y = p1.y - p0.y;
        var s2y = p3.y - p2.y;
        var nx = p0.x - p2.x;
        var ny = p0.y - p2.y;
        var d = s1x * s2y - s2x * s1y;
        var s = (s1x * ny - s1y * nx) / d;
        var t = (s2x * ny - s2y * nx) / d;

        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            return new Point(p0.x + t * s1x, p0.y + t * s1y);
        }
    }

    function close(a, b, tolerance) {
        return round(math.abs(a - b), tolerance || PRECISION) === 0;
    }

    function closeOrLess(a, b, tolerance) {
        return a < b || close(a, b, tolerance);
    }

    function numberSign(x) {
        return x < 0 ? -1 : 1;
    }

    function isOutOfEndPoint(endPoint, controlPoint, point) {
        var angle = util.deg(math.atan2(controlPoint.y - endPoint.y, controlPoint.x - endPoint.x));
        var rotatedPoint = point.transformCopy(transform().rotate(-angle, endPoint));

        return rotatedPoint.x < endPoint.x;
    }

    function hasRootsInRange(points, point, field, rootField, range) {
        var polynomial = toCubicPolynomial(points, rootField);
        var roots = solveCubic(polynomial[0], polynomial[1], polynomial[2], polynomial[3] - point[rootField]);
        var intersection;

        for (var idx = 0; idx < roots.length; idx++) {
            if (0 <= roots[idx] && roots[idx] <= 1) {
                intersection = calculateCurveAt(roots[idx], field, points);
                if (math.abs(intersection - point[field]) <= range) {
                    return true;
                }
            }
        }
    }

    function solveQuadratic(a, b, c) {
        var squareRoot = math.sqrt(math.pow(b, 2) - 4 * a * c);
        return [
            (-b + squareRoot) / (2 * a),
            (-b - squareRoot) / (2 * a)
        ];
    }

    // Exports ================================================================
    deepExtend(kendo, {
        geometry: {
            Arc: Arc,
            Circle: Circle,
            curveIntersectionsCount: curveIntersectionsCount,
            lineIntersectionsCount: lineIntersectionsCount,
            Matrix: Matrix,
            Point: Point,
            Rect: Rect,
            Size: Size,
            Transformation: Transformation,
            transform: transform,
            toMatrix: toMatrix,
            isOutOfEndPoint: isOutOfEndPoint,
            hasRootsInRange: hasRootsInRange
        }
    });

    kendo.dataviz.geometry = kendo.geometry;

})();

return window.kendo;

}, typeof define == 'function' && define.amd ? define : function(a1, a2, a3){ (a3 || a2)(); });
