(function(f, define){
    define([
        "./shapes",
        "../text-metrics",      // XXX: needed to measure text in IE
        "./pdf" // XXX: for parseColor.  we shouldn't otherwise depend on this
    ], f);
})(function(){

(function(parseFloat, Math){

    "use strict";

    /* global console */ // XXX: temporary

    /* -----[ local vars ]----- */

    var dataviz = kendo.dataviz;
    var drawing = dataviz.drawing;
    var geo = dataviz.geometry;
    var slice = Array.prototype.slice;
    var pdf = drawing.pdf; // XXX: should not really depend on this.  needed for parseColor

    /* -----[ exports ]----- */

    drawing.drawDOM = function(element, cont) {
        var group = new drawing.Group();

        // translate to start of page
        var pos = element.getBoundingClientRect();
        setTransform(group, [ 1, 0, 0, 1, -pos.left, -pos.top ]);

        renderElement(element, group);
        cont(group);
    };

    var nodeInfo = {};

    // only function definitions after this line.
    return;

    function pushNodeInfo(element, style) {
        var Tmp = function(parent) {
            this._up = parent;
        };
        Tmp.prototype = nodeInfo;
        nodeInfo = new Tmp(nodeInfo);
        nodeInfo[element.tagName.toLowerCase()] = {
            element: element,
            style: style
        };
        var decoration = getPropertyValue(style, "text-decoration");
        if (decoration && decoration != "none") {
            var color = getPropertyValue(style, "color");
            decoration.split(/\s+/g).forEach(function(name){
                if (!nodeInfo[name]) {
                    nodeInfo[name] = color;
                }
            });
            return true;
        }
    }

    function popNodeInfo() {
        nodeInfo = nodeInfo._up;
    }

    function getComputedStyle(element) {
        return window.getComputedStyle(element);
    }

    function getPropertyValue(style, prop) {
        return style.getPropertyValue(prop);
    }

    function getBorder(style, side) {
        side = "border-" + side;
        return {
            width: parseFloat(getPropertyValue(style, side + "-width")),
            style: getPropertyValue(style, side + "-style"),
            color: getPropertyValue(style, side + "-color")
        };
    }

    function getBorderRadius(style, side) {
        var r = getPropertyValue(style, "border-" + side + "-radius").split(/\s+/g).map(parseFloat);
        if (r.length == 1) {
            r.push(r[0]);
        }
        return sanitizeRadius({ x: r[0], y: r[1] });
    }

    function getContentBox(element) {
        var box = element.getBoundingClientRect();
        box = innerBox(box, "border-*-width", element);
        box = innerBox(box, "padding-*", element);
        return box;
    }

    function innerBox(box, prop, element) {
        var style, wt, wr, wb, wl;
        if (typeof prop == "string") {
            style = getComputedStyle(element);
            wt = parseFloat(getPropertyValue(style, prop.replace("*", "top")));
            wr = parseFloat(getPropertyValue(style, prop.replace("*", "right")));
            wb = parseFloat(getPropertyValue(style, prop.replace("*", "bottom")));
            wl = parseFloat(getPropertyValue(style, prop.replace("*", "left")));
        }
        else if (typeof prop == "number") {
            wt = wr = wb = wl = prop;
        }
        return {
            top    : box.top + wt,
            right  : box.right - wr,
            bottom : box.bottom - wb,
            left   : box.left + wl,
            width  : box.right - box.left - wr - wl,
            height : box.bottom - box.top - wb - wt
        };
    }

    function getTransform(style) {
        var transform = getPropertyValue(style, "transform");
        if (transform == "none") {
            return null;
        }
        var matrix = /^\s*matrix\(\s*(.*?)\s*\)\s*$/.exec(transform);
        if (matrix) { // IE9 doesn't support CSS transforms
            var origin = getPropertyValue(style, "transform-origin");
            matrix = matrix[1].split(/\s*,\s*/g).map(parseFloat);
            origin = origin.split(/\s+/g).map(parseFloat);
            return {
                matrix: matrix,
                origin: origin
            };
        }
    }

    function toDegrees(radians) {
        return ((180 * radians) / Math.PI) % 360;
    }

    function setTransform(shape, m) {
        shape.transform(new geo.Matrix(m[0], m[1], m[2], m[3], m[4], m[5]));
    }

    function setClipping(shape, clipPath) {
        shape.clip(clipPath);
    }

    function addArcToPath(path, x, y, options) {
        var points = new geo.Arc([ x, y ], options).curvePoints(), i = 1;
        while (i < points.length) {
            path.curveTo(points[i++], points[i++], points[i++]);
        }
    }

    function sanitizeRadius(r) {
        if (r.x <= 0 || r.y <= 0) {
            r.x = r.y = 0;
        }
        return r;
    }

    function elementRoundBox(element, box, type) {
        var style = getComputedStyle(element);

        var rTL = getBorderRadius(style, "top-left");
        var rTR = getBorderRadius(style, "top-right");
        var rBL = getBorderRadius(style, "bottom-left");
        var rBR = getBorderRadius(style, "bottom-right");

        if (type == "padding" || type == "content") {
            var bt = getBorder(style, "top");
            var br = getBorder(style, "right");
            var bb = getBorder(style, "bottom");
            var bl = getBorder(style, "left");
            rTL.x -= bl.width; rTL.y -= bt.width;
            rTR.x -= br.width; rTR.y -= bt.width;
            rBR.x -= br.width; rBR.y -= bb.width;
            rBL.x -= bl.width; rBL.y -= bb.width;
            if (type == "content") {
                var pt = parseFloat(getPropertyValue(style, "padding-top"));
                var pr = parseFloat(getPropertyValue(style, "padding-right"));
                var pb = parseFloat(getPropertyValue(style, "padding-bottom"));
                var pl = parseFloat(getPropertyValue(style, "padding-left"));
                rTL.x -= pl; rTL.y -= pt;
                rTR.x -= pr; rTR.y -= pt;
                rBR.x -= pr; rBR.y -= pb;
                rBL.x -= pl; rBL.y -= pb;
            }
        }

        if (typeof type == "number") {
            rTL.x -= type; rTL.y -= type;
            rTR.x -= type; rTR.y -= type;
            rBR.x -= type; rBR.y -= type;
            rBL.x -= type; rBL.y -= type;
        }

        return roundBox(box, rTL, rTR, rBR, rBL);
    }

    // Create a drawing.Path for a rounded rectangle.  Receives the
    // bounding box and the border-radiuses in CSS order (top-left,
    // top-right, bottom-right, bottom-left).  The radiuses must be
    // objects containing x (horiz. radius) and y (vertical radius).
    function roundBox(box, rTL, rTR, rBR, rBL) {
        var path = new drawing.Path({ fill: null, stroke: null });
        sanitizeRadius(rTL);
        sanitizeRadius(rTR);
        sanitizeRadius(rBR);
        sanitizeRadius(rBL);
        path.moveTo(box.left, box.top + rTL.y);
        if (rTL.x) {
            addArcToPath(path, box.left + rTL.x, box.top + rTL.y, {
                startAngle: -180,
                endAngle: -90,
                radiusX: rTL.x,
                radiusY: rTL.y
            });
        }
        path.lineTo(box.right - rTR.x, box.top);
        if (rTR.x) {
            addArcToPath(path, box.right - rTR.x, box.top + rTR.y, {
                startAngle: -90,
                endAngle: 0,
                radiusX: rTR.x,
                radiusY: rTR.y
            });
        }
        path.lineTo(box.right, box.bottom - rBR.y);
        if (rBR.x) {
            addArcToPath(path, box.right - rBR.x, box.bottom - rBR.y, {
                startAngle: 0,
                endAngle: 90,
                radiusX: rBR.x,
                radiusY: rBR.y
            });
        }
        path.lineTo(box.left + rBL.x, box.bottom);
        if (rBL.x) {
            addArcToPath(path, box.left + rBL.x, box.bottom - rBL.y, {
                startAngle: 90,
                endAngle: 180,
                radiusX: rBL.x,
                radiusY: rBL.y
            });
        }
        return path.close();
    }

    function _renderElement(element, group) {
        var style = getComputedStyle(element);
        var top = getBorder(style, "top");
        var right = getBorder(style, "right");
        var bottom = getBorder(style, "bottom");
        var left = getBorder(style, "left");

        var rTL = getBorderRadius(style, "top-left");
        var rTR = getBorderRadius(style, "top-right");
        var rBL = getBorderRadius(style, "bottom-left");
        var rBR = getBorderRadius(style, "bottom-right");

        var dir = getPropertyValue(style, "direction");

        var backgroundColor = getPropertyValue(style, "background-color");
        backgroundColor = pdf.parseColor(backgroundColor);
        if (backgroundColor && backgroundColor.a === 0) {
            backgroundColor = null;     // opacity zero
        }

        var backgroundImage = getPropertyValue(style, "background-image");
        var backgroundRepeat = getPropertyValue(style, "background-repeat");
        var backgroundPosition = getPropertyValue(style, "background-position");
        var backgroundOrigin = getPropertyValue(style, "background-origin");

        if (element.currentStyle) {
            // IE9 hacks.  getPropertyValue won't return the correct
            // value.  Sucks that we have to do it here, I'd prefer to
            // move it in getPropertyValue, but we don't have the
            // element.
            backgroundPosition = element.currentStyle.backgroundPosition;

            // gradients rendered as SVG (for instance in the colorpicker)
            // cannot be displayed.
            if (/^url\(\"data:image\/svg/i.test(backgroundImage)) {
                // this will taint the canvas in IE9 for some reason
                // and we get a DOM security exception when we try to
                // retrieve the image from it.  ditch it.
                backgroundImage = null;
            }
        }

        var innerbox = innerBox(element.getBoundingClientRect(), "border-*-width", element);

        // CSS "clip" property - if present, replace the group with a
        // new one which is clipped.  This must happen before drawing
        // the borders and background.
        (function(){
            var clip = getPropertyValue(style, "clip");
            var m = /^\s*rect\((.*)\)\s*$/.exec(clip);
            if (m) {
                var a = m[1].split(/[ ,]+/g);
                var top = a[0] == "auto" ? innerbox.top : parseFloat(a[0]) + innerbox.top;
                var right = a[1] == "auto" ? innerbox.right : parseFloat(a[1]) + innerbox.left;
                var bottom = a[2] == "auto" ? innerbox.bottom : parseFloat(a[2]) + innerbox.top;
                var left = a[3] == "auto" ? innerbox.left : parseFloat(a[3]) + innerbox.left;
                var tmp = new drawing.Group();
                setClipping(tmp,
                            (new drawing.Path({ fill: null, stroke: null })
                             .moveTo(left, top)
                             .lineTo(right, top)
                             .lineTo(right, bottom)
                             .lineTo(left, bottom)
                             .close()));
                group.append(tmp);
                group = tmp;
            }
        })();

        var boxes = element.getClientRects();
        if (boxes.length == 1) {
            // Workaround the missing borders in Chrome!  getClientRects() boxes contains values
            // rounded to integer.  getBoundingClientRect() appears to work fine.  We still need
            // getClientRects() to support cases where there are more boxes (continued inline
            // elements that might have border/background).
            boxes = [ element.getBoundingClientRect() ];
        }

        // This function workarounds another Chrome bug, where boxes returned for a table with
        // border-collapse: collapse will overlap the table border.  Our rendering is not perfect in
        // such case anyway, but with this is better than without it.
        boxes = adjustBoxes(boxes);

        for (var i = 0; i < boxes.length; ++i) {
            drawOne(boxes[i], i === 0, i == boxes.length - 1);
        }

        // overflow: hidden/auto - if present, replace the group with
        // a new one clipped by the inner box.
        (function(){
            var overflow = getPropertyValue(style, "overflow");
            if (/^(hidden|auto)$/.test(overflow)) {
                var clipPath = elementRoundBox(element, innerbox, "padding");
                var tmp = new drawing.Group();
                setClipping(tmp, clipPath);
                group.append(tmp);
                group = tmp;
            }
        })();

        renderContents(element, style, group);

        return group; // only utility functions after this line.

        function adjustBoxes(boxes) {
            if (/^td$/i.test(element.tagName)) {
                var table = nodeInfo.table;
                if (table && getPropertyValue(table.style, "border-collapse") == "collapse") {
                    var tableBorderLeft = getBorder(table.style, "left").width;
                    var tableBorderTop = getBorder(table.style, "top").width;
                    // check if we need to adjust
                    if (tableBorderLeft === 0 && tableBorderTop === 0) {
                        return boxes; // nope
                    }
                    var tableBox = table.element.getBoundingClientRect();
                    var firstCell = table.element.rows[0].cells[0];
                    var firstCellBox = firstCell.getBoundingClientRect();
                    if (firstCellBox.top == tableBox.top || firstCellBox.left == tableBox.left) {
                        return slice.call(boxes).map(function(box){
                            return {
                                left   : box.left + tableBorderLeft,
                                top    : box.top + tableBorderTop,
                                right  : box.right + tableBorderLeft,
                                bottom : box.bottom + tableBorderTop,
                                height : box.height,
                                width  : box.width
                            };
                        });
                    }
                }
            }
            return boxes;
        }

        // this function will be called to draw each border.  it
        // draws starting at origin and the resulted path must be
        // translated/rotated to be placed in the proper position.
        //
        // arguments are named as if it draws the top border:
        //
        //    - `len` the length of the edge
        //    - `Wtop` the width of the edge (i.e. border-top-width)
        //    - `Wleft` the width of the left edge (border-left-width)
        //    - `Wright` the width of the right edge
        //    - `rl` and `rl` -- the border radius on the left and right
        //      (objects containing x and y, for horiz/vertical radius)
        //    - `transform` -- transformation to apply
        //
        function drawEdge(color, len, Wtop, Wleft, Wright, rl, rr, transform) {
            var path, edge = new drawing.Group();
            setTransform(edge, transform);
            group.append(edge);

            sanitizeRadius(rl);
            sanitizeRadius(rr);

            // draw main border.  this is the area without the rounded corners
            path = new drawing.Path({
                fill: { color: color },
                stroke: null
            });
            edge.append(path);
            path.moveTo(rl.x ? Math.max(rl.x, Wleft) : 0, 0)
                .lineTo(len - (rr.x ? Math.max(rr.x, Wright) : 0), 0)
                .lineTo(len - Math.max(rr.x, Wright), Wtop)
                .lineTo(Math.max(rl.x, Wleft), Wtop)
                .close();

            if (rl.x) {
                path = drawRoundCorner(Wleft, rl);
                setTransform(path, [ -1, 0, 0, 1, rl.x, 0 ]);
                edge.append(path);
            }

            if (rr.x) {
                path = drawRoundCorner(Wright, rr);
                setTransform(path, [ 1, 0, 0, 1, len - rr.x, 0 ]);
                edge.append(path);
            }

            // draws one round corner, starting at origin (needs to be
            // translated/rotated to be placed properly).
            function drawRoundCorner(Wright, r) {
                var angle = Math.PI/2 * Wright / (Wright + Wtop);

                // not sanitizing this one, because negative values
                // are useful to fill the box correctly.
                var ri = {
                    x: r.x - Wright,
                    y: r.y - Wtop
                };

                var path = new drawing.Path({
                    fill: { color: color },
                    stroke: null
                }).moveTo(0, 0);

                addArcToPath(path, 0, r.y, {
                    startAngle: -90,
                    endAngle: -toDegrees(angle),
                    radiusX: r.x,
                    radiusY: r.y
                });

                if (ri.x > 0 && ri.y > 0) {
                    path.lineTo(ri.x * Math.cos(angle), r.y - ri.y * Math.sin(angle));
                    addArcToPath(path, 0, r.y, {
                        startAngle: -toDegrees(angle),
                        endAngle: -90,
                        radiusX: ri.x,
                        radiusY: ri.y,
                        anticlockwise: true
                    });
                }
                else if (ri.x > 0) {
                    path.lineTo(ri.x, Wtop)
                        .lineTo(0, Wtop);
                }
                else {
                    path.lineTo(ri.x, Wtop)
                        .lineTo(ri.x, 0);
                }

                return path.close();
            }

            return edge;
        }

        // for left/right borders we need to invert the border-radiuses
        function inv(p) {
            return { x: p.y, y: p.x };
        }

        function drawBackground(box) {
            if (!backgroundColor && (!backgroundImage || (backgroundImage == "none"))) {
                return;
            }

            var background = new drawing.Group();
            setClipping(background, roundBox(box, rTL, rTR, rBR, rBL));
            group.append(background);

            if (backgroundColor) {
                background.append(
                    new drawing.Path({
                        fill: { color: backgroundColor.toCssRgba() },
                        stroke: null
                    })
                        .moveTo(box.left, box.top)
                        .lineTo(box.right, box.top)
                        .lineTo(box.right, box.bottom)
                        .lineTo(box.left, box.bottom)
                        .close());
            }

            var m = /^\s*url\((['"]?)(.*?)\1\)\s*$/i.exec(backgroundImage);
            if (m) {
                drawBackgroundImage(background, box, m[2]);
            }
        }

        function drawBackgroundImage(group, box, url) {
            var img = new Image();
            var pos = backgroundPosition.split(/\s+/g);

            // for background-origin: border-box the box is already appropriate
            var orgBox = box;
            if (backgroundOrigin == "content-box") {
                orgBox = innerBox(orgBox, "border-*-width", element);
                orgBox = innerBox(orgBox, "padding-*", element);
            } else if (backgroundOrigin == "padding-box") {
                orgBox = innerBox(orgBox, "border-*-width", element);
            }

            // XXX: this really assumes the image is in cache.
            //      position won't be correctly computed otherwise.
            img.src = url;
            pos = { x: pos[0], y: pos[1] };

            if (/%$/.test(pos.x)) {
                pos.x = parseFloat(pos.x) / 100 * (orgBox.width - img.width);
            } else {
                pos.x = parseFloat(pos.x);
            }
            if (/%$/.test(pos.y)) {
                pos.y = parseFloat(pos.y) / 100 * (orgBox.height - img.height);
            } else {
                pos.y = parseFloat(pos.y);
            }

            var rect = new geo.Rect([ orgBox.left + pos.x, orgBox.top + pos.y ], [ img.width, img.height ]);

            // XXX: background-repeat could be implemented more
            //      efficiently as a fill pattern (at least for PDF
            //      output, probably SVG too).

            function rewX() {
                while (rect.origin.x > box.left) {
                    rect.origin.x -= img.width;
                }
            }

            function rewY() {
                while (rect.origin.y > box.top) {
                    rect.origin.y -= img.height;
                }
            }

            function repeatX() {
                while (rect.origin.x < box.right) {
                    group.append(new drawing.Image(url, rect.clone()));
                    rect.origin.x += img.width;
                }
            }

            if (backgroundRepeat == "no-repeat") {
                group.append(new drawing.Image(url, rect));
            }
            else if (backgroundRepeat == "repeat-x") {
                rewX();
                repeatX();
            }
            else if (backgroundRepeat == "repeat-y") {
                rewY();
                while (rect.origin.y < box.bottom) {
                    group.append(new drawing.Image(url, rect.clone()));
                    rect.origin.y += img.height;
                }
            }
            else if (backgroundRepeat == "repeat") {
                rewX();
                rewY();
                var origin = rect.origin.clone();
                while (rect.origin.y < box.bottom) {
                    rect.origin.x = origin.x;
                    repeatX();
                    rect.origin.y += img.height;
                }
            }
        }

        // draws a single border box
        function drawOne(box, isFirst, isLast) {
            if (box.width === 0 || box.height === 0) {
                return;
            }

            drawBackground(box);

            var shouldDrawLeft = (left.width > 0 && ((isFirst && dir == "ltr") || (isLast && dir == "rtl")));
            var shouldDrawRight = (right.width > 0 && ((isLast && dir == "ltr") || (isFirst && dir == "rtl")));

            // The most general case is that the 4 borders have different widths and border
            // radiuses.  The way that is handled is by drawing 3 Paths for each border: the
            // straight line, and two round corners which represent half of the entire rounded
            // corner.  To simplify code those shapes are drawed at origin (by the drawEdge
            // function), then translated/rotated into the right position.
            //
            // However, this leads to poor results due to rounding in the simpler cases where
            // borders are straight lines.  Therefore we handle a few such cases separately with
            // straight lines. C^wC^wC^w -- nope, scratch that.  poor rendering was because of a bug
            // in Chrome (getClientRects() returns rounded integer values rather than exact floats.
            // web dev is still a ghetto.)

            // first, just in case there is no border...
            if (top.width === 0 && left.width === 0 && right.width === 0 && bottom.width === 0) {
                return;
            }

            if (true) { // so that it's easy to comment out..  uglifyjs will drop the spurious if.

                // if all borders have equal colors...
                if (top.color == right.color && top.color == bottom.color && top.color == left.color) {

                    // if same widths too, we can draw the whole border by stroking a single path.
                    if (top.width == right.width && top.width == bottom.width && top.width == left.width)
                    {
                        // reduce box by half the border width, so we can draw it by stroking.
                        box = innerBox(box, top.width/2);

                        if (shouldDrawLeft && shouldDrawRight) {
                            // adjust the border radiuses, again by top.width/2, and make the path element.
                            var path = elementRoundBox(element, box, top.width/2);
                            path.options.stroke = {
                                color: top.color,
                                width: top.width
                            };
                            group.append(path);
                            return;
                        }
                    }
                }

                // if border radiuses are zero and widths are at most one pixel, we can again use simple
                // paths.
                if (rTL.x === 0 && rTR.x === 0 && rBR.x === 0 && rBL.x === 0) {
                    // alright, 1.9px will do as well.  the difference in color blending should not be
                    // noticeable.
                    if (top.width < 2 && left.width < 2 && right.width < 2 && bottom.width < 2) {
                        // top border
                        if (top.width > 0) {
                            group.append(
                                new drawing.Path({
                                    stroke: { width: top.width, color: top.color }
                                })
                                    .moveTo(box.left, box.top + top.width/2)
                                    .lineTo(box.right, box.top + top.width/2)
                            );
                        }

                        // bottom border
                        if (bottom.width > 0) {
                            group.append(
                                new drawing.Path({
                                    stroke: { width: bottom.width, color: bottom.color }
                                })
                                    .moveTo(box.left, box.bottom - bottom.width/2)
                                    .lineTo(box.right, box.bottom - bottom.width/2)
                            );
                        }

                        // left border
                        if (shouldDrawLeft) {
                            group.append(
                                new drawing.Path({
                                    stroke: { width: left.width, color: left.color }
                                })
                                    .moveTo(box.left + left.width/2, box.top)
                                    .lineTo(box.left + left.width/2, box.bottom)
                            );
                        }

                        // right border
                        if (shouldDrawRight) {
                            group.append(
                                new drawing.Path({
                                    stroke: { width: right.width, color: right.color }
                                })
                                    .moveTo(box.right - right.width/2, box.top)
                                    .lineTo(box.right - right.width/2, box.bottom)
                            );
                        }

                        return;
                    }
                }

            }

            // top border
            if (top.width > 0) {
                drawEdge(top.color,
                         box.width, top.width, left.width, right.width,
                         rTL, rTR,
                         [ 1, 0, 0, 1, box.left, box.top ]);
            }

            // bottom border
            if (bottom.width > 0) {
                drawEdge(bottom.color,
                         box.width, bottom.width, right.width, left.width,
                         rBR, rBL,
                         [ -1, 0, 0, -1, box.right, box.bottom ]);
            }

            // left border
            if (shouldDrawLeft) {
                drawEdge(left.color,
                         box.height, left.width, bottom.width, top.width,
                         inv(rBL), inv(rTL),
                         [ 0, -1, 1, 0, box.left, box.bottom ]);
            }

            // right border
            if (shouldDrawRight) {
                drawEdge(right.color,
                         box.height, right.width, top.width, bottom.width,
                         inv(rTR), inv(rBR),
                         [ 0, 1, -1, 0, box.right, box.top ]);
            }
        }
    }

    function renderImage(element, group) {
        var box = getContentBox(element);
        var rect = new geo.Rect([ box.left, box.top ], [ box.width, box.height ]);
        var image = new drawing.Image(element.src, rect);
        setClipping(image, elementRoundBox(element, box, "content"));
        group.append(image);
    }

    function zIndexSort(a, b) {
        var sa = getComputedStyle(a);
        var sb = getComputedStyle(b);
        var za = parseFloat(getPropertyValue(sa, "z-index"));
        var zb = parseFloat(getPropertyValue(sb, "z-index"));
        var pa = getPropertyValue(sa, "position");
        var pb = getPropertyValue(sb, "position");
        if (isNaN(za) && isNaN(zb)) {
            if (pa == "static" && pb == "static") {
                return 0;
            }
            if (pa == "static") {
                return -1;
            }
            if (pb == "static") {
                return 1;
            }
            return 0;
        }
        if (isNaN(za)) {
            return zb === 0 ? 0 : zb > 0 ? -1 : 1;
        }
        if (isNaN(zb)) {
            return za === 0 ? 0 : za > 0 ? 1 : -1;
        }
        return parseFloat(za) - parseFloat(zb);
    }

    function renderContents(element, style, group) {
        switch (element.tagName.toLowerCase()) {
          case "img":
            renderImage(element, group);
            return;
        }

        pushNodeInfo(element, style);

        var children = [];
        for (var i = element.firstChild; i; i = i.nextSibling) {
            switch (i.nodeType) {
              case 1:         // Element
                var pos = getPropertyValue(getComputedStyle(i), "position");
                if (pos == "static") {
                    renderElement(i, group);
                } else {
                    children.push(i);
                }
                break;
              case 3:         // Text
                if (/\S/.test(i.data)) {
                    renderText(element, i, group);
                }
                break;
            }
        }
        children.sort(zIndexSort).forEach(function(el){
            renderElement(el, group);
        });

        popNodeInfo();
    }

    function renderText(element, node, group) {
        var text = node.data;
        var range = element.ownerDocument.createRange();
        var style = getComputedStyle(element);
        var align = getPropertyValue(style, "text-align");
        var isJustified = align == "justify";

        // skip whitespace
        var start = 0;
        var end = /\S\s*$/.exec(node.data).index + 1;

        function doChunk() {
            while (!/\S/.test(text.charAt(start))) {
                if (start >= end) {
                    return true;
                }
                start++;
            }
            range.setStart(node, start);
            var len = 0;
            while (++start <= end) {
                ++len;
                range.setEnd(node, start);

                // for justified text we must split at each space, as
                // space has variable width.  otherwise we can
                // optimize and split only at end of line (i.e. when a
                // new rectangle would be created).
                if (len > 1 && ((isJustified && /\s/.test(text.charAt(start - 1))) || range.getClientRects().length > 1)) {
                    //
                    // In IE, getClientRects for a <li> element will return an additional rectangle for the bullet, but
                    // *only* when only the first char in the LI is selected.  Checking if len > 1 above appears to be a
                    // good workaround.
                    //
                    //// DEBUG
                    // Array.prototype.slice.call(range.getClientRects()).concat([ range.getBoundingClientRect() ]).forEach(function(r){
                    //     $("<div>").css({
                    //         position  : "absolute",
                    //         left      : r.left + "px",
                    //         top       : r.top + "px",
                    //         width     : r.right - r.left + "px",
                    //         height    : r.bottom - r.top + "px",
                    //         boxSizing : "border-box",
                    //         border    : "1px solid red"
                    //     }).appendTo(document.body);
                    // });
                    range.setEnd(node, --start);
                    break;
                }
            }

            // another workaround for IE: if we rely on getBoundingClientRect() we'll overlap with the bullet for LI
            // elements.  Calling getClientRects() and using the *first* rect appears to give us the correct location.
            var box = range.getClientRects()[0];

            var str = range.toString().replace(/\s+$/, "");
            drawText(str, box);
        }

        var fontSize = getPropertyValue(style, "font-size");
        var lineHeight = getPropertyValue(style, "line-height");

        // simply getPropertyValue("font") doesn't work in Firefox :-\
        var font = [
            getPropertyValue(style, "font-style"),
            getPropertyValue(style, "font-variant"),
            getPropertyValue(style, "font-weight"),
            fontSize, // no need for line height here; it breaks layout in FF
            getPropertyValue(style, "font-family")
        ].join(" ");

        fontSize = parseFloat(fontSize);
        lineHeight = parseFloat(lineHeight);

        if (fontSize === 0) {
            return;
        }

        var color = getPropertyValue(style, "color");

        function drawText(str, box) {
            str = str.replace(/[\r\n ]+/g, " ");

            // In IE the box height will be approximately lineHeight, while in
            // other browsers it'll (correctly) be the height of the bounding
            // box for the current text/font.  Which is to say, IE sucks again.
            // The only good solution I can think of is to measure the text
            // ourselves and center the bounding box.
            if (kendo.support.browser.msie && !isNaN(lineHeight)) {
                var size = dataviz.util.measureText(str, { font: font });
                var top = (box.top + box.bottom - size.height) / 2;
                box = {
                    top    : top,
                    right  : box.right,
                    bottom : top + size.height,
                    left   : box.left,
                    height : size.height,
                    width  : box.right - box.left
                };
            }

            // var path = new drawing.Path({ stroke: { color: "red" }});
            // path.moveTo(box.left, box.top)
            //     .lineTo(box.right, box.top)
            //     .lineTo(box.right, box.bottom)
            //     .lineTo(box.left, box.bottom)
            //     .close();
            // group.append(path);

            var text = new drawing.Text(str, new geo.Point(box.left, box.top), {
                font: font,
                fill: { color: color }
            });
            group.append(text);
            decorate(box);
        }

        function decorate(box) {
            /*jshint -W069 */// aaaaargh!  JSHate.
            line(nodeInfo["underline"], box.bottom);
            line(nodeInfo["line-through"], box.bottom - box.height / 2.7);
            line(nodeInfo["overline"], box.top);
            function line(color, ypos) {
                if (color) {
                    var width = fontSize / 12;
                    var path = new drawing.Path({ stroke: {
                        width: width,
                        color: color
                    }});

                    ypos -= width;
                    path.moveTo(box.left, ypos)
                        .lineTo(box.right, ypos);
                    group.append(path);
                }
            }
        }

        while (!doChunk()) {}
    }

    function renderElement(element, container) {
        if (/^(style|script|link|meta|iframe|svg)$/i.test(element.tagName)) {
            return;
        }

        var style = getComputedStyle(element);
        var opacity = parseFloat(getPropertyValue(style, "opacity"));
        var visibility = getPropertyValue(style, "visibility");
        var display = getPropertyValue(style, "display");

        if (opacity === 0 || visibility == "hidden" || display == "none") {
            return;
        }

        var group = new drawing.Group();
        container.append(group);

        if (opacity < 1) {
            group.opacity(opacity);
        }

        var prevTransform, t = getTransform(style);
        if (t) {
            prevTransform = element.style.transform;
            element.style.transform = "none";

            // must translate to origin before applying the CSS
            // transformation, then translate back.
            var bbox = element.getBoundingClientRect();
            var x = bbox.left + t.origin[0];
            var y = bbox.top + t.origin[1];
            var m = [ 1, 0, 0, 1, -x, -y ];
            m = mmul(m, t.matrix);
            m = mmul(m, [ 1, 0, 0, 1, x, y ]);
            setTransform(group, m);
        }

        _renderElement(element, group);

        if (t) {
            element.style.transform = prevTransform;
        }
    }

    function mmul(a, b) {
        var a1 = a[0], b1 = a[1], c1 = a[2], d1 = a[3], e1 = a[4], f1 = a[5];
        var a2 = b[0], b2 = b[1], c2 = b[2], d2 = b[3], e2 = b[4], f2 = b[5];
        return [
            a1*a2 + b1*c2,          a1*b2 + b1*d2,
            c1*a2 + d1*c2,          c1*b2 + d1*d2,
            e1*a2 + f1*c2 + e2,     e1*b2 + f1*d2 + f2
        ];
    }

})(parseFloat, Math);

}, typeof define == 'function' && define.amd ? define : function(_, f){ f(); });
