/**
 * @module sprites/image
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { Sprite } from './sprite.js';

/**
 * The picture shown when an image cannot be loaded: a frame with a cross, like a broken image.
 *
 * @type {string}
 */
export const MISSING_IMAGE =
    'data:image/svg+xml,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
            '<rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#f7f5f1" stroke="#a9a08e"/>' +
            '<path d="M5 5l6 6M11 5l-6 6" stroke="#c01c28" stroke-width="1.6" stroke-linecap="round"/>' +
            '</svg>'
    );

/**
 * The size of the missing image picture when the sprite has no size.
 *
 * @type {number}
 */
const MISSING_SIZE = 16;

function toDimension(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        throw new TypeError('An image size must be a number.');
    }

    return number < 0 ? -1 : number;
}

/**
 * An image loaded from a URL. The position is its top left corner. A size component of -1 (the
 * default) uses the natural size of the image. When the image cannot be loaded, a placeholder is
 * shown.
 *
 * Signals: `load`, `error` (`sprite`).
 */
export class ImageSprite extends Sprite {
    _initialize() {
        /** @type {HTMLImageElement | null} */
        this._image = null;
        this._failed = false;

        super._initialize();
    }

    /**
     * The natural size of the loaded image, or zero.
     *
     * @type {{width: number, height: number}}
     */
    get naturalSize() {
        const image = this._image;

        return image && !this._failed
            ? { width: image.naturalWidth, height: image.naturalHeight }
            : { width: 0, height: 0 };
    }

    /**
     * Whether the image could not be loaded.
     *
     * @type {boolean}
     */
    get failed() {
        return this._failed;
    }

    _render() {
        return this._createShape('image', {
            class: 'wy-sprite-image',
            preserveAspectRatio: 'none',
        });
    }

    _applyShape() {
        const natural = this._failed
            ? { width: MISSING_SIZE, height: MISSING_SIZE }
            : this.naturalSize;
        const width = this._size.width >= 0 ? this._size.width : natural.width;
        const height = this._size.height >= 0 ? this._size.height : natural.height;

        this.el.setAttribute('width', String(width));
        this.el.setAttribute('height', String(height));
    }

    _load(source) {
        if (this._image) {
            this._image.onload = null;
            this._image.onerror = null;
        }

        this._failed = false;
        this.el.classList.remove('wy-image-missing');

        if (!source) {
            this._image = null;
            this.el.removeAttribute('href');
            this._applyShape();

            return;
        }

        const image = new window.Image();
        this._image = image;

        image.onload = () => {
            if (this._image !== image || this.destroyed) {
                return;
            }

            this.el.setAttribute('href', source);
            this._applyShape();
            this.emit('load', this);
        };

        image.onerror = () => {
            if (this._image !== image || this.destroyed) {
                return;
            }

            // Show a placeholder instead of nothing.
            this._failed = true;
            this.el.setAttribute('href', MISSING_IMAGE);
            this.el.classList.add('wy-image-missing');
            this._applyShape();
            this.emit('error', this);
        };

        image.src = source;
    }
}

defineProperties(ImageSprite, {
    /**
     * The URL of the image.
     */
    source: {
        value: '',
        coerce(source) {
            return source === null || source === undefined ? '' : String(source);
        },
        changed(source) {
            this._load(source);
        },
    },

    /**
     * The size, as `{width, height}`. A component of -1 uses the natural size.
     */
    size: {
        value: Object.freeze({ width: -1, height: -1 }),
        coerce(size) {
            if (!size || typeof size !== 'object') {
                throw new TypeError('A size must be an object with width and height.');
            }

            return Object.freeze({
                width: toDimension(size.width ?? -1),
                height: toDimension(size.height ?? -1),
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
     * The width, or -1 for the natural width.
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
     * The height, or -1 for the natural height.
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

    fill: { value: '' },

    strokeWidth: { value: 0 },
});

registerType('image-sprite', ImageSprite);
