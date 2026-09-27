/**
 * @module widgets/fixed
 */

import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Container } from './container.js';

function checkCoordinate(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        throw new TypeError(`Invalid ${name} coordinate: ${value}.`);
    }

    return Math.round(number);
}

/**
 * Places its children at fixed positions, in pixels from its top-left corner. Children get their
 * natural size (or their requested `width` and `height`), and the fixed container is as large
 * as needed to show all of them.
 *
 * Fixed positioning does not adapt to fonts, translations or themes; prefer the other
 * containers where possible.
 *
 * @example
 * const fixed = new Fixed();
 * fixed.addChild(new Button({ label: 'Here' }), 40, 20);
 */
export class Fixed extends Container {
    _initialize() {
        super._initialize();

        /** @type {Map<import('./widget.js').Widget, {x: number, y: number}>} */
        this._positions = new Map();

        // The position of the child being added by `addChild()`.
        this._pendingPosition = null;
    }

    _render() {
        return createElement('<div class="wy-fixed"></div>');
    }

    /**
     * Adds a child at a position.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {number} [x]
     * @param {number} [y]
     * @returns {import('./widget.js').Widget} The widget.
     */
    addChild(widget, x = 0, y = 0) {
        this._pendingPosition = { x: checkCoordinate(x, 'x'), y: checkCoordinate(y, 'y') };
        try {
            return super.addChild(widget);
        } finally {
            this._pendingPosition = null;
        }
    }

    /**
     * Adds a child at a position. The same as `addChild()`, with the name GTK uses.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {number} x
     * @param {number} y
     * @returns {import('./widget.js').Widget}
     */
    put(widget, x, y) {
        return this.addChild(widget, x, y);
    }

    insertChild(widget, index) {
        const position = this._pendingPosition || { x: 0, y: 0 };

        const result = super.insertChild(widget, index);
        this._positions.set(widget, position);

        return result;
    }

    removeChild(widget) {
        const index = super.removeChild(widget);

        this._positions.delete(widget);

        for (const name of ['gridArea', 'margin', 'justifySelf', 'alignSelf']) {
            widget._setLayoutStyle(name, '');
        }

        widget._applyLayoutStyle();

        return index;
    }

    /**
     * Moves a child to another position.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {number} x
     * @param {number} y
     * @throws {Error} If the widget is not a child.
     */
    move(widget, x, y) {
        if (!this._positions.has(widget)) {
            throw new Error('The widget is not a child of this fixed container.');
        }

        this._positions.set(widget, { x: checkCoordinate(x, 'x'), y: checkCoordinate(y, 'y') });
        this._queueLayout();
    }

    /**
     * Returns the position of a child.
     *
     * @param {import('./widget.js').Widget} widget
     * @returns {{x: number, y: number}}
     * @throws {Error} If the widget is not a child.
     */
    getChildPosition(widget) {
        const position = this._positions.get(widget);
        if (!position) {
            throw new Error('The widget is not a child of this fixed container.');
        }

        return { ...position };
    }

    _updateLayout() {
        // All children share the single cell; their position is a margin from its corner, so the
        // container grows to contain them.
        for (const child of this._children) {
            const position = this._positions.get(child);
            const margin = child.margin;

            child._setLayoutStyle('gridArea', '1 / 1');
            child._setLayoutStyle('justifySelf', 'start');
            child._setLayoutStyle('alignSelf', 'start');
            child._setLayoutStyle(
                'margin',
                `${position.y + margin.top}px ${margin.right}px ${margin.bottom}px ` +
                    `${position.x + margin.left}px`
            );
        }
    }
}

Fixed.builderProperties = {
    /**
     * Builds the children, each an object with the widget's own properties plus `x` and `y`.
     *
     * @param {object} builder
     * @param {Fixed} fixed
     * @param {object[]} children
     */
    children(builder, fixed, children) {
        if (!Array.isArray(children)) {
            throw new Error('Fixed children must be an array.');
        }

        for (const child of children) {
            const { x, y, ...spec } = child;

            fixed.addChild(builder.build(spec)[0], x ?? 0, y ?? 0);
        }
    },
};

registerType('fixed', Fixed);
