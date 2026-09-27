/**
 * @module widgets/resizer
 */

import { getCursor } from '../core/cursor.js';
import { CursorShape, ResizeDirections } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Key } from '../events/constants.js';
import { Bin } from './bin.js';

/**
 * The cursor of each resize handle.
 *
 * @type {Readonly<Record<string, string>>}
 */
const CURSOR_SHAPES = Object.freeze({
    e: CursorShape.RESIZE_E,
    s: CursorShape.RESIZE_S,
    se: CursorShape.RESIZE_SE,
});

/**
 * How far the arrow keys resize, in pixels.
 *
 * @type {number}
 */
const KEY_STEP = 10;

/**
 * @typedef {object} Dimension
 * @property {number} width In pixels, or -1 for none.
 * @property {number} height In pixels, or -1 for none.
 */

function toDimension(value) {
    if (!value || typeof value !== 'object') {
        throw new TypeError('A size must be an object with a width and a height.');
    }

    const width = Number(value.width ?? -1);
    const height = Number(value.height ?? -1);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
        throw new TypeError(`Invalid size: ${JSON.stringify(value)}.`);
    }

    return Object.freeze({
        width: width < 0 ? -1 : Math.round(width),
        height: height < 0 ? -1 : Math.round(height),
    });
}

function clampComponent(value, minimum, maximum) {
    if (value < 0) {
        return value;
    }

    if (maximum >= 0) {
        value = Math.min(value, maximum);
    }

    return Math.max(value, minimum >= 0 ? minimum : 0);
}

function dimensionProperty(name, component) {
    return {
        signal: false,
        get() {
            return this[`_${name}`][component];
        },
        set(value) {
            this[name] = { ...this[`_${name}`], [component]: value };

            return false;
        },
    };
}

/**
 * A bin that lets the user resize its child by dragging its right edge, its bottom edge or the
 * grip in its bottom-right corner.
 *
 * The size of the child area is `size` (with `width` and `height`, -1 for the natural size),
 * limited by `minSize` and `maxSize` and by the child's own minimum size. With `keepRatio`,
 * resizing keeps the ratio of width to height: `ratio`, or the ratio of the child's natural size
 * when `useChildRatio` is set.
 *
 * When `canFocus` is set, the arrow keys resize as well.
 */
export class Resizer extends Bin {
    _initialize() {
        super._initialize();

        this._drag = null;

        for (const handle of this.el.querySelectorAll('[data-direction]')) {
            handle.addEventListener('pointerdown', (event) =>
                this._onPointerDown(event, handle.dataset.direction)
            );
        }

        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));

        this._syncDirections();
    }

    _render() {
        const element = createElement(`
            <div class="wy-resizer">
                <div class="wy-resizer-body"></div>
                <div class="wy-resizer-handle wy-resizer-e" data-direction="e"></div>
                <div class="wy-resizer-handle wy-resizer-s" data-direction="s"></div>
                <div class="wy-resizer-handle wy-resizer-se" data-direction="se"></div>
                <div class="wy-resizer-grip" data-direction="se"></div>
            </div>
        `);

        this._bodyEl = element.querySelector('.wy-resizer-body');
        this._handleEls = {
            e: element.querySelector('.wy-resizer-e'),
            s: element.querySelector('.wy-resizer-s'),
            se: element.querySelector('.wy-resizer-se'),
        };
        this._gripEl = element.querySelector('.wy-resizer-grip');

        return element;
    }

    /**
     * The handle that takes the keyboard focus: the corner handle when resizing in both
     * directions, otherwise the edge handle.
     *
     * @type {HTMLElement}
     */
    get focusElement() {
        const directions = this._resizeDirections;
        const horizontal = Boolean(directions & ResizeDirections.HORIZONTAL);
        const vertical = Boolean(directions & ResizeDirections.VERTICAL);

        if (horizontal && vertical) {
            return this._handleEls.se;
        }

        return vertical ? this._handleEls.s : this._handleEls.e;
    }

    destroy() {
        this._endDrag();

        super.destroy();
    }

    _applyLayoutStyle() {
        super._applyLayoutStyle();

        this._applySize();
    }

    _applySize() {
        const size = this._clampSize(this._size);
        const style = this._bodyEl.style;

        style.width = size.width >= 0 ? `${size.width}px` : '';
        style.height = size.height >= 0 ? `${size.height}px` : '';
        style.minWidth = this._minSize.width >= 0 ? `${this._minSize.width}px` : '';
        style.minHeight = this._minSize.height >= 0 ? `${this._minSize.height}px` : '';
        style.maxWidth = this._maxSize.width >= 0 ? `${this._maxSize.width}px` : '';
        style.maxHeight = this._maxSize.height >= 0 ? `${this._maxSize.height}px` : '';

        this.el.classList.toggle('wy-sized-width', size.width >= 0);
        this.el.classList.toggle('wy-sized-height', size.height >= 0);
    }

    _clampSize(size, childMinimum = null) {
        const minimumWidth = Math.max(this._minSize.width, childMinimum?.width ?? -1);
        const minimumHeight = Math.max(this._minSize.height, childMinimum?.height ?? -1);

        return {
            width: clampComponent(size.width, minimumWidth, this._maxSize.width),
            height: clampComponent(size.height, minimumHeight, this._maxSize.height),
        };
    }

    _syncDirections() {
        const directions = this._resizeDirections;
        const horizontal = Boolean(directions & ResizeDirections.HORIZONTAL);
        const vertical = Boolean(directions & ResizeDirections.VERTICAL);

        this._handleEls.e.hidden = !horizontal;
        this._handleEls.s.hidden = !vertical;
        this._handleEls.se.hidden = !(horizontal && vertical);
        this._gripEl.hidden = !(horizontal && vertical && this._hasGrip);

        // Move the focusability to the current focus element.
        for (const handle of Object.values(this._handleEls)) {
            handle.removeAttribute('tabindex');
        }

        this._updateTabIndex();
    }

    /**
     * Measures the size of the child area in some state of its CSS size, restoring it after.
     *
     * @param {string} width A CSS width, e.g. `'min-content'`.
     * @param {string} height A CSS height.
     * @returns {{width: number, height: number}}
     */
    _measureBody(width, height) {
        const style = this._bodyEl.style;
        const saved = [style.width, style.height, style.minWidth, style.minHeight];

        style.width = width;
        style.height = height;
        style.minWidth = style.minHeight = '';

        const rect = this._bodyEl.getBoundingClientRect();

        [style.width, style.height, style.minWidth, style.minHeight] = saved;

        return { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
    }

    _getRatio() {
        if (this._useChildRatio) {
            const natural = this._measureBody('max-content', 'max-content');
            if (natural.width > 0 && natural.height > 0) {
                return natural.width / natural.height;
            }
        }

        return this._ratio > 0 ? this._ratio : 1;
    }

    /**
     * Resizes as the user does: to the given size of the child area, limited by the minimum and
     * maximum sizes and the child's minimum size, keeping the ratio when asked.
     *
     * @param {{width: number, height: number}} size
     * @param {string} direction `'e'`, `'s'` or `'se'`.
     * @param {{width: number, height: number}} childMinimum
     * @param {number | null} ratio
     * @param {{width: number, height: number}} origin The size when resizing started.
     */
    _resizeTo(size, direction, childMinimum, ratio, origin) {
        const directions = this._resizeDirections;
        let width = direction.includes('e') && directions & ResizeDirections.HORIZONTAL;
        const height = direction.includes('s') && directions & ResizeDirections.VERTICAL;

        let result = {
            width: width ? size.width : this._size.width,
            height: height ? size.height : this._size.height,
        };

        if (ratio) {
            // Follow the direction that changed, or the larger change for the corner.
            if (width && height) {
                const byWidth = Math.abs(size.width - origin.width);
                const byHeight = Math.abs(size.height - origin.height) * ratio;

                width = byWidth >= byHeight;
            }

            result = width
                ? { width: size.width, height: Math.round(size.width / ratio) }
                : { width: Math.round(size.height * ratio), height: size.height };
        }

        result = this._clampSize(result, childMinimum);

        if (ratio) {
            // Keep the ratio within the limits, following the limited component.
            if (result.width !== Math.round(result.height * ratio)) {
                if (width) {
                    result.height = Math.round(result.width / ratio);
                } else {
                    result.width = Math.round(result.height * ratio);
                }
            }
        }

        this.size = result;
    }

    _onPointerDown(event, direction) {
        if (event.button !== 0 || !this.isSensitive || this._drag) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);

        const rect = this._bodyEl.getBoundingClientRect();
        const start = { width: Math.round(rect.width), height: Math.round(rect.height) };
        const childMinimum = this._measureBody('min-content', 'min-content');
        const ratio = this._keepRatio ? this._getRatio() : null;

        // Resizing starts from the rendered size.
        this._size = toDimension({
            width: this._resizeDirections & ResizeDirections.HORIZONTAL ? start.width : -1,
            height: this._resizeDirections & ResizeDirections.VERTICAL ? start.height : -1,
        });

        if (ratio) {
            this._size = toDimension(start);
        }

        const move = (moveEvent) => {
            this._resizeTo(
                {
                    width: start.width + moveEvent.clientX - event.clientX,
                    height: start.height + moveEvent.clientY - event.clientY,
                },
                direction,
                childMinimum,
                ratio,
                start
            );
        };

        const end = () => this._endDrag();

        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);

        this._drag = { target, move, end };
        this.el.classList.add('wy-resizing');

        getCursor().pushShape(CURSOR_SHAPES[direction], 'resizer');
    }

    _endDrag() {
        const drag = this._drag;
        if (!drag) {
            return;
        }

        this._drag = null;
        this.el.classList.remove('wy-resizing');

        drag.target.removeEventListener('pointermove', drag.move);
        drag.target.removeEventListener('pointerup', drag.end);
        drag.target.removeEventListener('pointercancel', drag.end);

        getCursor().popShape('resizer');
    }

    _onKeyDown(event) {
        if (event.target !== this.focusElement || event.ctrlKey || event.altKey) {
            return;
        }

        const deltas = {
            [Key.LEFT]: [-KEY_STEP, 0, 'e'],
            [Key.RIGHT]: [KEY_STEP, 0, 'e'],
            [Key.UP]: [0, -KEY_STEP, 's'],
            [Key.DOWN]: [0, KEY_STEP, 's'],
        };

        const delta = deltas[event.key];
        if (!delta) {
            return;
        }

        event.preventDefault();

        const rect = this._bodyEl.getBoundingClientRect();
        const childMinimum = this._measureBody('min-content', 'min-content');
        const ratio = this._keepRatio ? this._getRatio() : null;

        this._size = toDimension({
            width: this._size.width >= 0 || delta[0] ? Math.round(rect.width) : -1,
            height: this._size.height >= 0 || delta[1] ? Math.round(rect.height) : -1,
        });

        this._resizeTo(
            { width: rect.width + delta[0], height: rect.height + delta[1] },
            delta[2],
            childMinimum,
            ratio,
            { width: rect.width, height: rect.height }
        );
    }
}

defineProperties(Resizer, {
    /**
     * The size of the child area, as `{width, height}`; a component of -1 means the natural
     * size. The user changes it by dragging.
     */
    size: {
        value: Object.freeze({ width: -1, height: -1 }),
        coerce: toDimension,
        set(size) {
            const old = this._size;
            if (old.width === size.width && old.height === size.height) {
                return false;
            }

            this._size = size;
            this._applySize();
        },
    },

    /**
     * The width of the child area, or -1 for the natural width. The same as `size.width`.
     */
    width: { value: undefined, ...dimensionProperty('size', 'width') },

    /**
     * The height of the child area, or -1 for the natural height. The same as `size.height`.
     */
    height: { value: undefined, ...dimensionProperty('size', 'height') },

    /**
     * The minimum size of the child area; a component of -1 means no minimum.
     */
    minSize: {
        value: Object.freeze({ width: -1, height: -1 }),
        coerce: toDimension,
        changed() {
            this._applySize();
        },
    },

    /**
     * The minimum width of the child area, or -1 for none.
     */
    minWidth: dimensionProperty('minSize', 'width'),

    /**
     * The minimum height of the child area, or -1 for none.
     */
    minHeight: dimensionProperty('minSize', 'height'),

    /**
     * The maximum size of the child area; a component of -1 means no maximum.
     */
    maxSize: {
        value: Object.freeze({ width: -1, height: -1 }),
        coerce: toDimension,
        changed() {
            this._applySize();
        },
    },

    /**
     * The maximum width of the child area, or -1 for none.
     */
    maxWidth: dimensionProperty('maxSize', 'width'),

    /**
     * The maximum height of the child area, or -1 for none.
     */
    maxHeight: dimensionProperty('maxSize', 'height'),

    /**
     * The directions the user can resize in: a mask of `ResizeDirections`.
     */
    resizeDirections: {
        value: ResizeDirections.ALL,
        coerce(directions) {
            const value = Number(directions);
            if (!Number.isInteger(value)) {
                throw new TypeError(`Invalid resize directions: ${directions}.`);
            }

            return value & ResizeDirections.ALL;
        },
        changed() {
            this._syncDirections();
        },
    },

    /**
     * The original toolkit's name of `resizeDirections`.
     */
    directions: {
        signal: false,
        get() {
            return this._resizeDirections;
        },
        set(directions) {
            this.resizeDirections = directions;

            return false;
        },
    },

    /**
     * Whether the corner shows a resize grip, when resizing in both directions.
     */
    hasGrip: {
        value: true,
        changed() {
            this._syncDirections();
        },
    },

    /**
     * Whether resizing keeps the ratio of width to height.
     */
    keepRatio: { value: false },

    /**
     * The ratio of width to height that `keepRatio` keeps, unless `useChildRatio` is set.
     */
    ratio: {
        value: 1,
        coerce(ratio) {
            const value = Number(ratio);
            if (!Number.isFinite(value) || value <= 0) {
                throw new TypeError(`Invalid ratio: ${ratio}.`);
            }

            return value;
        },
    },

    /**
     * Whether `keepRatio` keeps the ratio of the child's natural size instead of `ratio`.
     */
    useChildRatio: { value: true },
});

registerType('resizer', Resizer);
