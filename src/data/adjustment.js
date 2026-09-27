/**
 * @module data/adjustment
 */

import { defineProperties, Instance } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { clamp } from '../core/util.js';

/**
 * A bounded value with step and page increments and a page size, shared by scroll bars,
 * sliders, spin buttons and scroll areas.
 *
 * The value is kept between `lower` and `upper - pageSize`. Besides the property change signals,
 * the adjustment emits `change` whenever any of its values changed (once for `set()`), and
 * `value-change` when the value changed.
 *
 * @example
 * const adjustment = new Adjustment({ lower: 0, upper: 100, value: 75 });
 * const slider = new Slider({ adjustment });
 */
export class Adjustment extends Instance {
    _initialize() {
        super._initialize();

        this._batch = 0;
        this._batchChanged = false;
    }

    /**
     * Sets several values at once, emitting `change` once.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties) {
        this._batch += 1;

        let changed;
        try {
            // Set the bounds before the value, so the value is not clamped to old bounds.
            const { value, ...rest } = properties;
            changed = super.set(rest);

            if (value !== undefined && this.setProperty('value', value)) {
                changed = true;
            }
        } finally {
            this._batch -= 1;
        }

        if (!this._batch && this._batchChanged) {
            this._batchChanged = false;
            this.emit('change', this);
        }

        return changed;
    }

    /**
     * The largest value the adjustment can have: `upper - pageSize`, but at least `lower`.
     *
     * @type {number}
     */
    get maximum() {
        return Math.max(this._lower, this._upper - this._pageSize);
    }

    /**
     * Increases the value by `stepIncrement`.
     */
    increment() {
        this.value = this._value + this._stepIncrement;
    }

    /**
     * Decreases the value by `stepIncrement`.
     */
    decrement() {
        this.value = this._value - this._stepIncrement;
    }

    /**
     * Increases the value by `pageIncrement`.
     */
    incrementPage() {
        this.value = this._value + this._pageIncrement;
    }

    /**
     * Decreases the value by `pageIncrement`.
     */
    decrementPage() {
        this.value = this._value - this._pageIncrement;
    }

    /**
     * Changes the value as little as possible so that the range [`lower`, `upper`] is visible,
     * as far as it fits in the page. Used to scroll something into view.
     *
     * @param {number} lower
     * @param {number} upper
     */
    clampPage(lower, upper) {
        let value = this._value;

        if (upper > value + this._pageSize) {
            value = upper - this._pageSize;
        }

        if (lower < value) {
            value = lower;
        }

        this.value = value;
    }

    _changed() {
        if (this._batch) {
            this._batchChanged = true;
        } else {
            this.emit('change', this);
        }
    }

    _clampValue() {
        const value = clamp(this._value, this._lower, this.maximum);
        if (value !== this._value) {
            this._value = value;

            this.emit('value-change', this);
        }
    }
}

function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

defineProperties(Adjustment, {
    /**
     * The value, clamped to [`lower`, `upper - pageSize`].
     */
    value: {
        value: 0,
        coerce(value) {
            return clamp(Number(value) || 0, this._lower, this.maximum);
        },
        changed() {
            this._changed();
        },
    },

    /**
     * The value as a fraction from 0 (at `lower`) to 1 (at `upper - pageSize`).
     */
    fraction: {
        signal: false,
        get() {
            const range = this.maximum - this._lower;

            return range === 0 ? 0 : (this._value - this._lower) / range;
        },
        set(fraction) {
            this.value = this._lower + clamp(fraction, 0, 1) * (this.maximum - this._lower);

            return false;
        },
    },

    /**
     * The minimum value.
     */
    lower: {
        value: 0,
        coerce: Number,
        changed(lower) {
            if (lower > this._upper) {
                this._upper = lower;
                this.emit('upper-change', this);
            }

            this._clampValue();
            this._changed();
        },
    },

    /**
     * The maximum value. The value itself is at most `upper - pageSize`.
     */
    upper: {
        value: 0,
        coerce: Number,
        changed(upper) {
            if (upper < this._lower) {
                this._lower = upper;
                this.emit('lower-change', this);
            }

            this._clampValue();
            this._changed();
        },
    },

    /**
     * The small step, e.g. for arrow keys and scroll bar steppers.
     */
    stepIncrement: {
        value: 1,
        coerce: nonNegative,
        changed() {
            this._changed();
        },
    },

    /**
     * The large step, e.g. for Page Up and Page Down.
     */
    pageIncrement: {
        value: 10,
        coerce: nonNegative,
        changed() {
            this._changed();
        },
    },

    /**
     * The size of the visible page, for scrolling. Use 0 for plain values, such as in a slider.
     */
    pageSize: {
        value: 0,
        coerce: nonNegative,
        changed() {
            this._clampValue();
            this._changed();
        },
    },
});

registerType('adjustment', Adjustment);
