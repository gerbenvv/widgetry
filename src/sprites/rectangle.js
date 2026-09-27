/**
 * @module sprites/rectangle
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { Sprite } from './sprite.js';

/**
 * Converts a length (a size or corner radius) to a non-negative number.
 *
 * @param {unknown} value
 * @returns {number}
 * @throws {RangeError} If it is not a non-negative number.
 */
function toLength(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
        throw new RangeError('A length must be a non-negative number.');
    }

    return number;
}

/**
 * A rectangle, optionally with rounded corners. The position is its top left corner.
 *
 * @example
 * new RectangleSprite({
 *     position: { x: 10, y: 10 },
 *     size: { width: 40, height: 20 },
 *     fill: '#5699d8',
 * });
 */
export class RectangleSprite extends Sprite {
    _render() {
        return this._createShape('rect', { class: 'wy-sprite-rectangle' });
    }

    _applyShape() {
        this.el.setAttribute('width', String(this._size.width));
        this.el.setAttribute('height', String(this._size.height));
        this.el.setAttribute('rx', String(this._cornerRadius));
        this.el.setAttribute('ry', String(this._cornerRadius));
    }
}

defineProperties(RectangleSprite, {
    /**
     * The size, as `{width, height}`.
     */
    size: {
        value: Object.freeze({ width: 0, height: 0 }),
        coerce(size) {
            if (!size || typeof size !== 'object') {
                throw new TypeError('A size must be an object with width and height.');
            }

            return Object.freeze({
                width: toLength(size.width ?? 0),
                height: toLength(size.height ?? 0),
            });
        },
        set(size) {
            if (size.width === this._size.width && size.height === this._size.height) {
                return false;
            }

            this._size = size;
            this._applyShape();
        },
    },

    /**
     * The width.
     */
    width: {
        signal: false,
        get() {
            return this._size.width;
        },
        set(width) {
            this.size = { width, height: this._size.height };

            return false;
        },
    },

    /**
     * The height.
     */
    height: {
        signal: false,
        get() {
            return this._size.height;
        },
        set(height) {
            this.size = { width: this._size.width, height };

            return false;
        },
    },

    /**
     * The radius of the corners.
     */
    cornerRadius: {
        value: 0,
        coerce: toLength,
        changed() {
            this._applyShape();
        },
    },
});

registerType('rectangle-sprite', RectangleSprite);
