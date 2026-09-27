/**
 * @module widgets/throbber
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Widget } from './widget.js';

/**
 * A busy indicator: a ring of spokes that spins while `active`, and is shown dimmed and still
 * otherwise. GTK calls it a spinner, so it is also exported as `Spinner`.
 */
export class Throbber extends Widget {
    _initialize() {
        super._initialize();

        // Apply the default.
        this._applyActive();
    }

    _render() {
        return createElement('<div class="wy-throbber" role="progressbar"></div>');
    }

    /**
     * Starts spinning. The same as setting `active` to `true`.
     */
    start() {
        this.active = true;
    }

    /**
     * Stops spinning. The same as setting `active` to `false`.
     */
    stop() {
        this.active = false;
    }

    _applyActive() {
        const active = this._active;

        this.el.classList.toggle('wy-active', active);
        this.el.setAttribute('aria-busy', String(active));

        // A still throbber conveys nothing.
        if (active) {
            this.el.removeAttribute('aria-hidden');
        } else {
            this.el.setAttribute('aria-hidden', 'true');
        }
    }
}

defineProperties(Throbber, {
    /**
     * Whether the throbber spins.
     */
    active: {
        value: false,
        coerce: Boolean,
        changed() {
            this._applyActive();
        },
    },

    /**
     * The size in pixels, or 0 for the default of 32 pixels.
     */
    pixelSize: {
        value: 0,
        coerce(size) {
            if (!Number.isFinite(size) || size < 0) {
                throw new Error(`Invalid pixel size ${size}.`);
            }

            return size;
        },
        changed(size) {
            this.el.style.setProperty('--wy-throbber-size', size > 0 ? `${size}px` : null);
        },
    },
});

/**
 * The GTK name of `Throbber`.
 */
export const Spinner = Throbber;

registerType('throbber', Throbber);
registerType('spinner', Throbber);
