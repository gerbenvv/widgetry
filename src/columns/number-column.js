/**
 * @module columns/number-column
 */

import { Justification } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { getLocaleManager } from '../i18n/locale-manager.js';
import { ColumnChange } from './abstract-column.js';
import { DataColumn } from './data-column.js';

/**
 * The number styles of `Intl.NumberFormat`.
 *
 * @type {ReadonlyArray<string>}
 */
const NUMBER_STYLES = Object.freeze(['decimal', 'percent', 'currency', 'unit']);

function fractionDigits(value) {
    const digits = Number(value);
    if (!Number.isInteger(digits) || digits < 0 || digits > 20) {
        throw new RangeError('Fraction digits must be an integer from 0 to 20.');
    }

    return digits;
}

/**
 * A column that shows numbers, formatted for the current locale with `Intl.NumberFormat` and
 * aligned to the right. Values may be numbers or numeric strings; other values show nothing.
 *
 * With `style: 'percent'`, 0.25 shows as 25%. With `style: 'currency'`, set `currency` (an ISO
 * 4217 code such as `'EUR'`). `formatOptions` passes any other `Intl.NumberFormat` option.
 *
 * @example
 * new NumberColumn({ name: 'price', label: 'Price', style: 'currency', currency: 'EUR' });
 */
export class NumberColumn extends DataColumn {
    _initialize() {
        super._initialize();

        /** @type {Intl.NumberFormat | null} */
        this._numberFormat = null;
        this._numberFormatLocale = null;
    }

    /**
     * The `Intl.NumberFormat` of the column for the current locale.
     *
     * @type {Intl.NumberFormat}
     */
    get numberFormat() {
        const locale = getLocaleManager().locale;

        if (!this._numberFormat || this._numberFormatLocale !== locale) {
            const options = {
                style: this._style,
                useGrouping: this._useGrouping,
                minimumFractionDigits: this._minimumFractionDigits,
                maximumFractionDigits: Math.max(
                    this._minimumFractionDigits,
                    this._maximumFractionDigits
                ),
            };

            if (this._style === 'currency') {
                options.currency = this._currency;
            }

            this._numberFormat = new Intl.NumberFormat(locale, {
                ...options,
                ...this._formatOptions,
            });
            this._numberFormatLocale = locale;
        }

        return this._numberFormat;
    }

    _formatValue(value) {
        const number =
            typeof value === 'number'
                ? value
                : typeof value === 'string' && value.trim()
                  ? Number(value)
                  : NaN;

        return Number.isFinite(number) ? this.numberFormat.format(number) : '';
    }

    _getTypeClassName() {
        return 'wy-table-number-cell';
    }

    _onFormatChange() {
        this._numberFormat = null;
        this._contentWidth = 0;
        this._invalidate(ColumnChange.CELLS);
        this._invalidate(ColumnChange.WIDTH);
    }
}

defineProperties(NumberColumn, {
    alignment: { value: Justification.END },

    /**
     * The number of fraction digits, setting both the minimum and the maximum. Reading returns
     * the maximum.
     */
    digits: {
        signal: false,
        get() {
            return this._maximumFractionDigits;
        },
        set(digits) {
            this.set({ minimumFractionDigits: digits, maximumFractionDigits: digits });

            return false;
        },
    },

    /**
     * The minimum number of fraction digits.
     */
    minimumFractionDigits: {
        value: 2,
        coerce: fractionDigits,
        changed() {
            this._onFormatChange();
        },
    },

    /**
     * The maximum number of fraction digits. It is at least the minimum.
     */
    maximumFractionDigits: {
        value: 2,
        coerce: fractionDigits,
        changed() {
            this._onFormatChange();
        },
    },

    /**
     * The number style: `'decimal'`, `'percent'`, `'currency'` or `'unit'` (with a `unit` in
     * `formatOptions`).
     */
    style: {
        value: 'decimal',
        coerce(style) {
            if (!NUMBER_STYLES.includes(style)) {
                throw new RangeError(`Invalid number style '${style}'.`);
            }

            return style;
        },
        changed() {
            this._onFormatChange();
        },
    },

    /**
     * The currency of the `'currency'` style, as an ISO 4217 code.
     */
    currency: {
        value: 'EUR',
        changed() {
            this._onFormatChange();
        },
    },

    /**
     * Whether digits are grouped, e.g. `1,234,567`.
     */
    useGrouping: {
        value: true,
        changed() {
            this._onFormatChange();
        },
    },

    /**
     * More `Intl.NumberFormat` options, which override the other properties, or `null`.
     */
    formatOptions: {
        value: null,
        changed() {
            this._onFormatChange();
        },
    },
});

registerType('number-column', NumberColumn);
