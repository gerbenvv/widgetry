/**
 * @module widgets/spin-button
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Adjustment } from '../data/adjustment.js';
import { Key } from '../events/constants.js';
import { parseDouble } from '../i18n/double-parser.js';
import { getLocaleManager } from '../i18n/locale-manager.js';
import { attachPressRepeat } from './auto-repeat.js';
import { LineEdit } from './line-edit.js';

/**
 * The number of repeats of a held stepper after which the step grows by the climb rate.
 *
 * @type {number}
 */
const CLIMB_REPEATS = 5;

/**
 * A numeric entry with steppers to increase and decrease its value.
 *
 * The value is kept in an `Adjustment`, which gives its bounds and increments. The text shows the
 * value with `digits` decimals and the locale's decimal separator, and typed text is read with the
 * double parser of the locale (see `parseValue`). Typed text is applied when Enter is pressed,
 * when the spin button loses the focus or when it steps; text that is not a number is then
 * replaced by the current value again.
 *
 * Keyboard: Up and Down step, Page Up and Page Down step by a page. The wheel steps as well.
 * Holding a stepper repeats, faster over time with `climbRate`.
 *
 * Signals: `value-change`, `activate`, `change` (the text changed), `wrapped` (the value wrapped
 * around with `wrap`).
 */
export class SpinButton extends LineEdit {
    _initialize() {
        super._initialize();

        this._adjustmentDisconnects = [];
        this._formatter = null;
        this._climbStep = 0;

        this._inputEl.setAttribute('role', 'spinbutton');
        this._inputEl.inputMode = 'decimal';

        this._inputEl.addEventListener('beforeinput', (event) => this._onBeforeInput(event));
        this.el.addEventListener('wheel', (event) => this._onWheel(event), { passive: false });

        this._stepperDetaches = [];

        for (const [element, direction] of [
            [this._upEl, 1],
            [this._downEl, -1],
        ]) {
            const detach = attachPressRepeat(element, {
                canStart: () => this.isSensitive,
                onStep: (count) => this._onStepperStep(direction, count),
            });
            this._stepperDetaches.push(detach);

            // Clicking a stepper focuses the entry, without selecting its text with the pointer.
            element.addEventListener('mousedown', (event) => {
                event.preventDefault();
                this.focus();
            });
        }

        this._localeDisconnect = getLocaleManager().connect('locale-change', () => {
            this._formatter = null;
            this._updateText();
        });

        this.adjustment = new Adjustment({
            lower: 0,
            upper: 100,
            stepIncrement: 1,
            pageIncrement: 10,
        });
    }

    _render() {
        const element = super._render();

        const steppers = createElement(`
            <span class="wy-spin-button-steppers" aria-hidden="true">
                <span class="wy-spin-button-stepper wy-up"></span>
                <span class="wy-spin-button-stepper wy-down"></span>
            </span>
        `);

        this._upEl = steppers.querySelector('.wy-up');
        this._downEl = steppers.querySelector('.wy-down');

        element.classList.add('wy-spin-button');
        element.append(steppers);

        return element;
    }

    /**
     * Sets several properties, applying the bounds before the value so that it is not clamped to
     * the old bounds.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties) {
        const { value, ...rest } = properties;

        let changed = super.set(rest);
        if (value !== undefined && this.setProperty('value', value)) {
            changed = true;
        }

        return changed;
    }

    /**
     * Increases the value by `stepIncrement`, or by `pageIncrement` with `page`.
     *
     * @param {boolean} [page]
     */
    stepUp(page = false) {
        this.spin(page ? this._adjustment.pageIncrement : this._adjustment.stepIncrement);
    }

    /**
     * Decreases the value by `stepIncrement`, or by `pageIncrement` with `page`.
     *
     * @param {boolean} [page]
     */
    stepDown(page = false) {
        this.spin(-(page ? this._adjustment.pageIncrement : this._adjustment.stepIncrement));
    }

    /**
     * Changes the value by an amount, applying typed text first, and wrapping around at the bounds
     * with `wrap`.
     *
     * @param {number} delta
     */
    spin(delta) {
        this.update();

        const adjustment = this._adjustment;
        const lower = adjustment.lower;
        const upper = adjustment.maximum;
        const value = adjustment.value;

        let result = value + delta;

        if (this._wrap && delta > 0 && result > upper) {
            result = Math.abs(value - upper) < 1e-10 ? lower : upper;
        } else if (this._wrap && delta < 0 && result < lower) {
            result = Math.abs(value - lower) < 1e-10 ? upper : lower;
        }

        const wrapped = this._wrap && Math.sign(result - value) === -Math.sign(delta);

        this._setValueFromUser(result);

        if (wrapped) {
            this.emit('wrapped', this);
        }
    }

    /**
     * Applies typed text to the value. Text that is not a number is replaced by the current value.
     * The text that shows the current value leaves it alone, so a value with more decimals than
     * `digits` is not rounded unless the user typed another one.
     */
    update() {
        if (this._text !== this.formatValue(this._adjustment.value)) {
            const value = this.parseValue(this._text);

            if (value !== null) {
                this._setValueFromUser(value);
            }
        }

        this._updateText();
    }

    activate() {
        this.update();

        super.activate();
    }

    /**
     * Formats a value for display. Override to show values differently; `parseValue` must then
     * accept the result.
     *
     * @param {number} value
     * @returns {string}
     */
    formatValue(value) {
        if (!this._formatter) {
            this._formatter = new Intl.NumberFormat(getLocaleManager().locale, {
                minimumFractionDigits: this._digits,
                maximumFractionDigits: this._digits,
                useGrouping: false,
            });
        }

        return this._formatter.format(value);
    }

    /**
     * Parses typed text to a value with the double parser (`parseDouble`), which follows the
     * locale manager: with the locale's separators (or swapped ones), in any digit set and with any
     * minus sign. Override to accept other notations; it must accept what `formatValue` returns.
     *
     * @param {string} text
     * @returns {number | null} The value, or `null` if the text is not a number.
     */
    parseValue(text) {
        return parseDouble(text);
    }

    destroy() {
        for (const detach of this._stepperDetaches) {
            detach();
        }

        this._localeDisconnect();
        this._connectAdjustment(null);

        super.destroy();
    }

    _validate(text) {
        return super._validate(text) && (text.trim() === '' || this.parseValue(text) !== null);
    }

    _setValueFromUser(value) {
        const adjustment = this._adjustment;

        if (this._snapToTicks && adjustment.stepIncrement > 0) {
            const steps = Math.round((value - adjustment.lower) / adjustment.stepIncrement);
            value = adjustment.lower + steps * adjustment.stepIncrement;
        }

        const factor = 10 ** this._digits;
        adjustment.value = Math.round(value * factor) / factor;

        // The value may be unchanged while the text was not, e.g. after typing a value out of
        // bounds.
        this._updateText();
    }

    _updateText() {
        if (this._adjustment) {
            this.text = this.formatValue(this._adjustment.value);
        }
    }

    _updateAria() {
        const adjustment = this._adjustment;
        const input = this._inputEl;

        input.setAttribute('aria-valuenow', String(adjustment.value));
        input.setAttribute('aria-valuemin', String(adjustment.lower));
        input.setAttribute('aria-valuemax', String(adjustment.maximum));
        input.setAttribute('aria-valuetext', this.formatValue(adjustment.value));

        this._upEl.classList.toggle(
            'wy-disabled',
            !this._wrap && adjustment.value >= adjustment.maximum
        );
        this._downEl.classList.toggle(
            'wy-disabled',
            !this._wrap && adjustment.value <= adjustment.lower
        );
    }

    _connectAdjustment(adjustment) {
        for (const disconnect of this._adjustmentDisconnects) {
            disconnect();
        }

        this._adjustmentDisconnects = [];

        if (!adjustment) {
            return;
        }

        this._adjustmentDisconnects = [
            adjustment.connect('value-change', () => this.emit('value-change', this)),
            adjustment.connect('lower-change', () => this.emit('lower-change', this)),
            adjustment.connect('upper-change', () => this.emit('upper-change', this)),
            adjustment.connect('change', () => {
                this._updateText();
                this._updateAria();
            }),
        ];
    }

    _onStepperStep(direction, count) {
        if (!this.isSensitive) {
            return false;
        }

        const adjustment = this._adjustment;

        // The step grows by the climb rate every few repeats, up to the page increment.
        if (count === 0) {
            this._climbStep = adjustment.stepIncrement;
        } else if (
            this._climbRate > 0 &&
            count % CLIMB_REPEATS === 0 &&
            this._climbStep < adjustment.pageIncrement
        ) {
            this._climbStep = Math.min(
                this._climbStep + this._climbRate,
                Math.max(adjustment.pageIncrement, adjustment.stepIncrement)
            );
        }

        const before = adjustment.value;
        this.spin(direction * this._climbStep);

        // Stop repeating at a bound.
        return this._wrap || adjustment.value !== before;
    }

    _onInputKeyDown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) {
            super._onInputKeyDown(event);

            return;
        }

        switch (event.key) {
            case Key.UP:
                this.stepUp();
                break;

            case Key.DOWN:
                this.stepDown();
                break;

            case Key.PAGE_UP:
                this.stepUp(true);
                break;

            case Key.PAGE_DOWN:
                this.stepDown(true);
                break;

            default:
                super._onInputKeyDown(event);

                return;
        }

        event.preventDefault();
    }

    _onInputBlur() {
        this.update();

        super._onInputBlur();
    }

    _onBeforeInput(event) {
        if (!this._numeric || event.data === null || !event.inputType.startsWith('insert')) {
            return;
        }

        // Only digits, signs and separators can be typed in a numeric spin button.
        const manager = getLocaleManager();
        const allowed = new Set(['-', '+', '.', manager.decimalSeparator, '\u2212']);

        for (const character of event.data) {
            if (!/\p{Nd}/u.test(character) && !allowed.has(character)) {
                event.preventDefault();

                return;
            }
        }
    }

    _onWheel(event) {
        if (!this.isSensitive || !event.deltaY) {
            return;
        }

        event.preventDefault();

        if (event.deltaY < 0) {
            this.stepUp();
        } else {
            this.stepDown();
        }
    }
}

function adjustmentProperty(name) {
    return {
        signal: false,
        get() {
            return this._adjustment[name];
        },
        set(value) {
            this._adjustment[name] = value;

            return false;
        },
    };
}

defineProperties(SpinButton, {
    xAlign: { value: 1 },

    /**
     * The `Adjustment` holding the value and its bounds and increments.
     */
    adjustment: {
        value: null,
        coerce(adjustment) {
            if (!(adjustment instanceof Adjustment)) {
                throw new TypeError('The adjustment of a spin button must be an Adjustment.');
            }

            return adjustment;
        },
        changed(adjustment, old) {
            this._connectAdjustment(adjustment);
            this._updateText();
            this._updateAria();

            if (old && old.value !== adjustment.value) {
                this.emit('value-change', this);
            }
        },
    },

    /**
     * The value, forwarded to the adjustment. Setting it also shows it, replacing typed text.
     */
    value: {
        ...adjustmentProperty('value'),
        set(value) {
            this._adjustment.value = value;
            this._updateText();

            return false;
        },
    },

    /**
     * The minimum value, forwarded to the adjustment.
     */
    lower: adjustmentProperty('lower'),

    /**
     * The maximum value, forwarded to the adjustment.
     */
    upper: adjustmentProperty('upper'),

    /**
     * The step of the steppers and arrow keys, forwarded to the adjustment.
     */
    stepIncrement: adjustmentProperty('stepIncrement'),

    /**
     * The step of Page Up and Page Down, forwarded to the adjustment.
     */
    pageIncrement: adjustmentProperty('pageIncrement'),

    /**
     * The number of decimals shown. Values set by the user are rounded to it.
     */
    digits: {
        value: 0,
        coerce(digits) {
            const value = Math.floor(Number(digits));
            if (!(value >= 0 && value <= 20)) {
                throw new RangeError(`Invalid number of digits ${digits}.`);
            }

            return value;
        },
        changed() {
            this._formatter = null;
            this._updateText();
            this._updateAria();
        },
    },

    /**
     * Whether only numeric characters can be typed.
     */
    numeric: { value: false, coerce: Boolean },

    /**
     * Whether stepping past a bound wraps around to the other bound.
     */
    wrap: {
        value: false,
        coerce: Boolean,
        changed() {
            this._updateAria();
        },
    },

    /**
     * Whether values set by the user are rounded to the nearest step increment.
     */
    snapToTicks: { value: false, coerce: Boolean },

    /**
     * How much the step grows while a stepper is held, or 0 to always step by the step
     * increment.
     */
    climbRate: {
        value: 0,
        coerce(rate) {
            return Math.max(0, Number(rate) || 0);
        },
    },
});

registerType('spin-button', SpinButton);
