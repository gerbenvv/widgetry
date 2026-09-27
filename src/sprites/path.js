/**
 * @module sprites/path
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { Sprite } from './sprite.js';

/**
 * A path, drawn from SVG path data (`'M 0 0 L 10 10 Z'`). The position translates the path.
 *
 * @example
 * new PathSprite({ path: 'M 0 10 L 10 0 L 20 10', strokeColor: '#5699d8', strokeWidth: 2 });
 */
export class PathSprite extends Sprite {
    _render() {
        return this._createShape('path', { class: 'wy-sprite-path' });
    }

    _applyShape() {
        if (this._path) {
            this.el.setAttribute('d', this._path);
        } else {
            this.el.removeAttribute('d');
        }
    }

    _applyPosition() {}

    _isPositionInTransform() {
        return true;
    }
}

defineProperties(PathSprite, {
    /**
     * The SVG path data.
     */
    path: {
        value: '',
        coerce(path) {
            return path === null || path === undefined ? '' : String(path);
        },
        changed() {
            this._applyShape();
        },
    },
});

registerType('path-sprite', PathSprite);
