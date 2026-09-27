/**
 * @module widgets/progress-bar
 */

import { EllipsizeMode, Orientation } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { clamp, createElement } from '../core/util.js';
import { getLocaleManager } from '../i18n/locale-manager.js';
import { Widget } from './widget.js';

/**
 * The size of the moving block in activity mode, as a fraction of the bar.
 *
 * @type {number}
 */
const PULSE_BLOCK_SIZE = 0.2;

/**
 * Shows the progress of a long operation: a bar that fills up as `fraction` goes from 0 to 1.
 *
 * When the amount of work is unknown, call `pulse()` now and then instead: the bar switches to
 * activity mode, in which a block bounces back and forth by `pulseStep` per call. Setting
 * `fraction` switches back.
 *
 * With `showText`, the bar shows `text` or, if it is empty, the percentage done. The text is
 * dark over the empty part and light over the filled part. A horizontal bar fills from left to
 * right and a vertical bar from bottom to top; `inverted` reverses that.
 */
export class ProgressBar extends Widget {
    _initialize() {
        super._initialize();

        this._pulsing = false;
        this._pulsePosition = 0;
        this._pulseDirection = 1;

        // Apply the defaults.
        this._applyOrientation();
        this._update();
    }

    _render() {
        const element = createElement(`
            <div class="wy-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100">
                <div class="wy-progress-fill"></div>
                <div class="wy-progress-text"></div>
                <div class="wy-progress-text wy-progress-text-filled" aria-hidden="true"></div>
            </div>
        `);

        this._fillEl = element.querySelector('.wy-progress-fill');
        this._textEl = element.querySelector('.wy-progress-text');
        this._filledTextEl = element.querySelector('.wy-progress-text-filled');

        return element;
    }

    /**
     * Whether the bar is in activity mode, after `pulse()`.
     *
     * @type {boolean}
     */
    get isPulsing() {
        return this._pulsing;
    }

    /**
     * Moves the block of activity mode by `pulseStep`, switching to activity mode first. Call it
     * regularly while the operation makes progress of an unknown amount.
     */
    pulse() {
        if (!this._pulsing) {
            this._pulsing = true;
            this._pulsePosition = 0;
            this._pulseDirection = 1;
        } else {
            let position = this._pulsePosition + this._pulseStep * this._pulseDirection;

            // Bounce back at the ends.
            if (position >= 1) {
                position = 2 - position;
                this._pulseDirection = -1;
            } else if (position <= 0) {
                position = -position;
                this._pulseDirection = 1;
            }

            this._pulsePosition = clamp(position, 0, 1);
        }

        this._update();
    }

    _applyOrientation() {
        const horizontal = this._orientation === Orientation.HORIZONTAL;

        this.el.classList.toggle('wy-horizontal', horizontal);
        this.el.classList.toggle('wy-vertical', !horizontal);
        this.el.classList.toggle('wy-inverted', this._inverted);
        this.el.setAttribute('aria-orientation', this._orientation);
    }

    _getText() {
        if (!this._showText) {
            return '';
        }

        if (this._text || this._pulsing) {
            return this._text;
        }

        const format = new Intl.NumberFormat(getLocaleManager().locale, {
            style: 'percent',
            maximumFractionDigits: 0,
        });

        return format.format(this._fraction);
    }

    _update() {
        // The filled range from the start of the bar, as fractions.
        let start = 0;
        let end = this._fraction;

        if (this._pulsing) {
            start = this._pulsePosition * (1 - PULSE_BLOCK_SIZE);
            end = start + PULSE_BLOCK_SIZE;
        }

        // Horizontal bars start at the left and vertical bars at the bottom, unless inverted.
        const fromEnd =
            this._orientation === Orientation.VERTICAL ? !this._inverted : this._inverted;
        const before = `${((fromEnd ? 1 - end : start) * 100).toFixed(3)}%`;
        const after = `${((fromEnd ? start : 1 - end) * 100).toFixed(3)}%`;

        const inset =
            this._orientation === Orientation.HORIZONTAL
                ? `0 ${after} 0 ${before}`
                : `${before} 0 ${after} 0`;

        this._fillEl.style.inset = inset;
        this._filledTextEl.style.clipPath = `inset(${inset})`;

        this.el.classList.toggle('wy-empty', end - start <= 0);
        this.el.classList.toggle('wy-pulsing', this._pulsing);

        const text = this._getText();
        this._textEl.textContent = text;
        this._filledTextEl.textContent = text;

        if (this._pulsing) {
            this.el.removeAttribute('aria-valuenow');
        } else {
            this.el.setAttribute('aria-valuenow', String(Math.round(this._fraction * 100)));
        }

        if (this._text) {
            this.el.setAttribute('aria-valuetext', this._text);
        } else {
            this.el.removeAttribute('aria-valuetext');
        }
    }
}

defineProperties(ProgressBar, {
    /**
     * The fraction of the work that is done, between 0 and 1. Setting it leaves activity mode.
     */
    fraction: {
        value: 0,
        coerce(fraction) {
            if (typeof fraction !== 'number' || Number.isNaN(fraction)) {
                throw new TypeError(`Invalid progress fraction ${fraction}.`);
            }

            // Setting any fraction leaves activity mode, also when the value stays the same.
            if (this._pulsing) {
                this._pulsing = false;
                this._update();
            }

            return clamp(fraction, 0, 1);
        },
        changed() {
            this._update();
        },
    },

    /**
     * The fraction of the bar the block of activity mode moves per `pulse()`.
     */
    pulseStep: {
        value: 0.1,
        coerce(step) {
            if (typeof step !== 'number' || !(step > 0 && step <= 1)) {
                throw new Error(`Invalid pulse step ${step}.`);
            }

            return step;
        },
    },

    /**
     * The text shown with `showText`. Newlines are shown as spaces. When empty, the percentage is
     * shown instead (except in activity mode).
     */
    text: {
        value: '',
        coerce(text) {
            return text === null || text === undefined ? '' : String(text).replace(/\n/g, ' ');
        },
        changed() {
            this._update();
        },
    },

    /**
     * Whether the text (or the percentage) is shown on the bar.
     */
    showText: {
        value: false,
        coerce: Boolean,
        changed() {
            this._update();
        },
    },

    /**
     * How the text is shortened when it does not fit: one of `EllipsizeMode`. Without
     * ellipsizing, the bar is at least as wide as its text. Middle ellipsizing is done at the
     * end.
     */
    ellipsize: {
        value: EllipsizeMode.NONE,
        coerce(mode) {
            if (!Object.values(EllipsizeMode).includes(mode)) {
                throw new Error(`Invalid ellipsize mode '${mode}'.`);
            }

            return mode;
        },
        changed(mode) {
            this.el.classList.toggle('wy-ellipsize', mode !== EllipsizeMode.NONE);
            this.el.classList.toggle('wy-ellipsize-start', mode === EllipsizeMode.START);
        },
    },

    /**
     * The direction of the bar: one of `Orientation`.
     */
    orientation: {
        value: Orientation.HORIZONTAL,
        coerce(orientation) {
            if (!Object.values(Orientation).includes(orientation)) {
                throw new Error(`Invalid orientation '${orientation}'.`);
            }

            return orientation;
        },
        changed() {
            this._applyOrientation();
            this._update();
        },
    },

    /**
     * Whether the bar fills in the opposite direction: from right to left, or from top to
     * bottom.
     */
    inverted: {
        value: false,
        coerce: Boolean,
        changed() {
            this._applyOrientation();
            this._update();
        },
    },
});

registerType('progress-bar', ProgressBar);
