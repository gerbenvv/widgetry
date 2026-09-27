/**
 * @module sprites/circle
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { Sprite } from './sprite.js';

/**
 * A circle. The position is its center.
 *
 * @example
 * new Circle({ position: { x: 50, y: 50 }, radius: 10, fill: '#5699d8' });
 */
export class Circle extends Sprite {
    _render() {
        return this._createShape('circle', { class: 'wy-sprite-circle' });
    }

    _applyShape() {
        this.el.setAttribute('r', String(this._radius));
    }

    _applyPosition() {
        // The original toolkit set x and y, which circles do not have.
        this.el.setAttribute('cx', String(this._position.x));
        this.el.setAttribute('cy', String(this._position.y));
    }
}

defineProperties(Circle, {
    /**
     * The radius.
     */
    radius: {
        value: 0,
        coerce(radius) {
            const number = Number(radius);
            if (!Number.isFinite(number) || number < 0) {
                throw new RangeError('A radius must be a non-negative number.');
            }

            return number;
        },
        changed() {
            this._applyShape();
        },
    },
});

registerType('circle-sprite', Circle);
