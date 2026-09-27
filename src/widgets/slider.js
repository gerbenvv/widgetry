/**
 * @module widgets/slider
 */

import { Position } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { clamp, createElement } from '../core/util.js';
import { getLocaleManager } from '../i18n/locale-manager.js';
import { AbstractSlider } from './abstract-slider.js';

/**
 * The number of decimals shown for `digits` -1 (no rounding).
 *
 * @type {number}
 */
const UNROUNDED_DIGITS = 6;

/**
 * @typedef {object} SliderMark
 * @property {number} value
 * @property {string} position One of `Position`: `TOP` or `BOTTOM` for horizontal sliders, `LEFT`
 *     or `RIGHT` for vertical ones.
 * @property {string | null} label
 */

function toMark(value, position, label) {
    const mark = {
        value: Number(value),
        position: checkPosition(position),
        label: label === null || label === undefined ? null : String(label),
    };

    if (!Number.isFinite(mark.value)) {
        throw new RangeError(`Invalid mark value ${value}.`);
    }

    return mark;
}

function checkPosition(position) {
    if (!Object.values(Position).includes(position)) {
        throw new RangeError(`Invalid position '${position}'.`);
    }

    return position;
}

/**
 * A slider (a scale in GTK) for choosing a value from a range by dragging a thumb along a trough.
 *
 * The part of the trough from the lower end to the thumb is filled with the accent color
 * (`hasOrigin`). The value is shown next to the thumb (`drawValue`, `valuePos`) with `digits`
 * decimals, and values set by the user are rounded to those decimals. Marks with optional labels
 * can be added along the trough.
 *
 * Keyboard: the arrow keys step (with Ctrl, by a page), Page Up and Page Down page, Home and End
 * go to the bounds. Pressing the trough moves the thumb there, or pages with Shift.
 *
 * Signals: `value-change`.
 */
export class Slider extends AbstractSlider {
    _initialize() {
        super._initialize();

        /** @type {SliderMark[]} */
        this._marks = [];
        this._formatter = null;
        this._wheelRemainder = 0;

        this._localeDisconnect = getLocaleManager().connect('locale-change', () => {
            this._formatter = null;
            this._update();
        });

        this._updateValuePosition();
    }

    _render() {
        const element = createElement(`
            <div class="wy-slider" role="slider" tabindex="0">
                <div class="wy-slider-value-area" aria-hidden="true">
                    <span class="wy-slider-sizer"></span>
                    <span class="wy-slider-sizer"></span>
                    <span class="wy-slider-value"></span>
                </div>
                <div class="wy-slider-marks wy-before" aria-hidden="true"></div>
                <div class="wy-slider-trough">
                    <div class="wy-slider-track"></div>
                    <div class="wy-slider-fill"></div>
                    <div class="wy-slider-thumb"></div>
                </div>
                <div class="wy-slider-marks wy-after" aria-hidden="true"></div>
            </div>
        `);

        this._valueAreaEl = element.querySelector('.wy-slider-value-area');
        this._sizerEls = [...element.querySelectorAll('.wy-slider-sizer')];
        this._valueEl = element.querySelector('.wy-slider-value');
        this._marksEls = {
            before: element.querySelector('.wy-slider-marks.wy-before'),
            after: element.querySelector('.wy-slider-marks.wy-after'),
        };
        this._troughEl = element.querySelector('.wy-slider-trough');
        this._thumbEl = element.querySelector('.wy-slider-thumb');

        return element;
    }

    /**
     * Adds a mark along the trough.
     *
     * @param {number} value
     * @param {string} [position] One of `Position`: where the mark is drawn. `TOP` and `LEFT` are
     *     before the trough, `BOTTOM` and `RIGHT` after it. Defaults to `BOTTOM`.
     * @param {string | null} [label] Text shown at the mark.
     */
    addMark(value, position = Position.BOTTOM, label = null) {
        this._marks = [...this._marks, toMark(value, position, label)];
        this._renderMarks();

        this.emit('marks-change', this);
    }

    /**
     * Removes all marks.
     */
    clearMarks() {
        this.marks = [];
    }

    /**
     * Formats a value for display. Override to show values differently.
     *
     * @param {number} value
     * @returns {string}
     */
    formatValue(value) {
        if (!this._formatter) {
            const digits = this._digits < 0 ? UNROUNDED_DIGITS : this._digits;

            this._formatter = new Intl.NumberFormat(getLocaleManager().locale, {
                minimumFractionDigits: this._digits < 0 ? 0 : digits,
                maximumFractionDigits: digits,
                useGrouping: false,
            });
        }

        return this._formatter.format(value);
    }

    destroy() {
        this._localeDisconnect();

        super.destroy();
    }

    _setValueFromUser(value) {
        if (this._digits >= 0) {
            const factor = 10 ** this._digits;
            value = Math.round(value * factor) / factor;
        }

        super._setValueFromUser(value);
    }

    _applyWheel(notches) {
        // A slider steps by whole notches, so small touchpad movements add up.
        this._wheelRemainder += notches;

        const whole = Math.trunc(this._wheelRemainder);
        if (!whole) {
            return;
        }

        this._wheelRemainder -= whole;

        super._applyWheel(whole);
    }

    _update() {
        super._update();

        const adjustment = this._adjustment;
        const text = this.formatValue(adjustment.value);

        this._valueEl.textContent = text;
        this.el.setAttribute('aria-valuetext', text);

        // The value area is as large as the widest value, so the layout does not change.
        this._sizerEls[0].textContent = this.formatValue(adjustment.lower);
        this._sizerEls[1].textContent = this.formatValue(adjustment.maximum);

        this._updateMarkPositions();
    }

    _getMarkFraction(value) {
        const adjustment = this._adjustment;
        const range = adjustment.maximum - adjustment.lower;
        const fraction = range > 0 ? clamp((value - adjustment.lower) / range, 0, 1) : 0;

        return this._isReversed() ? 1 - fraction : fraction;
    }

    _renderMarks() {
        const marks = this._marks || [];

        for (const [side, element] of Object.entries(this._marksEls)) {
            element.textContent = '';

            const sideMarks = marks.filter((x) => {
                const before = x.position === Position.TOP || x.position === Position.LEFT;

                return (side === 'before') === before;
            });

            let hasLabels = false;
            for (const mark of sideMarks) {
                const markEl = document.createElement('span');
                markEl.className = 'wy-slider-mark';
                markEl.dataset.value = String(mark.value);

                if (mark.label) {
                    hasLabels = true;

                    const label = document.createElement('span');
                    label.className = 'wy-slider-mark-label';
                    label.textContent = mark.label;
                    markEl.append(label);

                    // An invisible copy reserves room for the label.
                    const sizer = document.createElement('span');
                    sizer.className = 'wy-slider-mark-sizer';
                    sizer.textContent = mark.label;
                    element.append(sizer);
                }

                element.append(markEl);
            }

            element.classList.toggle('wy-has-marks', sideMarks.length > 0);
            element.classList.toggle('wy-has-labels', hasLabels);
        }

        this._updateMarkPositions();
    }

    _updateMarkPositions() {
        if (!this._marksEls) {
            return;
        }

        for (const element of Object.values(this._marksEls)) {
            for (const mark of element.querySelectorAll('.wy-slider-mark')) {
                const fraction = this._getMarkFraction(Number(mark.dataset.value));

                mark.style.setProperty('--wy-mark-fraction', String(fraction));
            }
        }
    }

    _updateValuePosition() {
        this.el.dataset.valuePos = this._valuePos;
        this.el.classList.toggle('wy-draw-value', this._drawValue);
        this._valueAreaEl.hidden = !this._drawValue;
    }
}

defineProperties(Slider, {
    canFocus: { value: true },

    /**
     * The number of decimals of the value shown. Values set by the user are rounded to it. Use -1
     * to not round.
     */
    digits: {
        value: 1,
        coerce(digits) {
            const value = Math.floor(Number(digits));
            if (!(value >= -1 && value <= 20)) {
                throw new RangeError(`Invalid number of digits ${digits}.`);
            }

            return value;
        },
        changed() {
            this._formatter = null;
            this._update();
        },
    },

    /**
     * Whether the value is shown next to the thumb.
     */
    drawValue: {
        value: true,
        coerce: Boolean,
        changed() {
            this._updateValuePosition();
        },
    },

    /**
     * Where the value is shown: one of `Position`. On the sides along the trough it follows the
     * thumb.
     */
    valuePos: {
        value: Position.TOP,
        coerce: checkPosition,
        changed() {
            this._updateValuePosition();
        },
    },

    /**
     * Whether the trough is filled from the lower end up to the thumb.
     */
    hasOrigin: {
        value: true,
        coerce: Boolean,
        changed(hasOrigin) {
            this.el.classList.toggle('wy-no-origin', !hasOrigin);
        },
    },

    /**
     * The marks, as objects with `value`, `position` and `label`. See `addMark()`.
     */
    marks: {
        get() {
            return this._marks.map((x) => ({ ...x }));
        },
        set(marks) {
            if (!Array.isArray(marks)) {
                throw new TypeError('The marks of a slider must be an array.');
            }

            this._marks = marks.map((x) => toMark(x.value, x.position ?? Position.BOTTOM, x.label));
            this._renderMarks();
        },
    },
});

registerType('slider', Slider);
