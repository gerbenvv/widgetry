/**
 * @module core/screen
 */

import { defineProperties, Instance, lazySingleton } from './instance.js';

/**
 * The screen: the browser viewport, and the layer that windows, menus and tooltips float in.
 *
 * Signals: `size-change`.
 */
export class Screen extends Instance {
    _initialize() {
        super._initialize();

        this._layer = null;
        this._zIndex = 10;
        this._size = { width: 0, height: 0 };

        if (typeof window !== 'undefined') {
            this._size = this._measure();

            window.addEventListener('resize', () => {
                const size = this._measure();
                if (size.width === this._size.width && size.height === this._size.height) {
                    return;
                }

                this._size = size;
                this.emit('size-change', this);
            });
        }
    }

    /**
     * The element that top-level widgets float in. It covers the viewport and is created on first
     * use.
     *
     * @type {HTMLElement}
     */
    get layer() {
        if (!this._layer || !this._layer.isConnected) {
            this._layer = document.createElement('div');
            this._layer.className = 'wy-screen';

            document.body.append(this._layer);
        }

        return this._layer;
    }

    /**
     * Returns a z-index above everything returned before.
     *
     * @returns {number}
     */
    nextZIndex() {
        this._zIndex += 1;

        return this._zIndex;
    }

    _measure() {
        const root = document.documentElement;

        return {
            width: root.clientWidth || window.innerWidth,
            height: root.clientHeight || window.innerHeight,
        };
    }
}

defineProperties(Screen, {
    /**
     * The size of the viewport, as `{width, height}`.
     */
    size: {
        readOnly: true,
        get() {
            return { ...this._size };
        },
    },

    /**
     * The width of the viewport.
     */
    width: {
        readOnly: true,
        get() {
            return this._size.width;
        },
    },

    /**
     * The height of the viewport.
     */
    height: {
        readOnly: true,
        get() {
            return this._size.height;
        },
    },
});

/**
 * Returns the screen singleton.
 *
 * @type {() => Screen}
 */
export const getScreen = lazySingleton(() => new Screen());
