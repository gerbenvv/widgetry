/**
 * @module columns/date-column
 */

import { Justification } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { getLocaleManager } from '../i18n/locale-manager.js';
import { ColumnChange } from './abstract-column.js';
import { DataColumn } from './data-column.js';

/**
 * Named date formats, as `Intl.DateTimeFormat` options.
 *
 * @type {Readonly<Record<string, Intl.DateTimeFormatOptions>>}
 */
export const DATE_FORMATS = Object.freeze({
    date: Object.freeze({ dateStyle: 'medium' }),
    'long-date': Object.freeze({
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }),
    'short-date': Object.freeze({ dateStyle: 'short' }),
    time: Object.freeze({ timeStyle: 'short' }),
    'date-time': Object.freeze({ dateStyle: 'medium', timeStyle: 'short' }),
});

/**
 * Converts a value to a date: `Date` objects, timestamps in milliseconds and date strings (such
 * as ISO 8601) are accepted. A date without a time (`'2013-09-19'`) is a local date.
 *
 * @param {unknown} value
 * @returns {Date | null} The date, or `null` if the value is not a valid date.
 */
export function toDate(value) {
    let date = null;

    if (value instanceof Date) {
        date = value;
    } else if (typeof value === 'number') {
        date = new Date(value);
    } else if (typeof value === 'string' && value.trim()) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
        date = match
            ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
            : new Date(value);
    }

    return date && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * A column that shows dates and times, formatted for the current locale with
 * `Intl.DateTimeFormat`. Values may be `Date` objects, timestamps in milliseconds or date strings;
 * other values show nothing.
 *
 * `format` is a name from {@link DATE_FORMATS} or `Intl.DateTimeFormat` options, such as
 * `{ year: 'numeric', month: 'long' }` or `{ dateStyle: 'full', timeZone: 'UTC' }`.
 *
 * @example
 * new DateColumn({ name: 'date', label: 'Date', format: 'long-date' });
 */
export class DateColumn extends DataColumn {
    _initialize() {
        super._initialize();

        /** @type {Intl.DateTimeFormat | null} */
        this._dateFormat = null;
        this._dateFormatLocale = null;
    }

    /**
     * The `Intl.DateTimeFormat` of the column for the current locale.
     *
     * @type {Intl.DateTimeFormat}
     */
    get dateFormat() {
        const locale = getLocaleManager().locale;

        if (!this._dateFormat || this._dateFormatLocale !== locale) {
            const options =
                typeof this._format === 'string' ? DATE_FORMATS[this._format] : this._format;

            this._dateFormat = new Intl.DateTimeFormat(locale, options);
            this._dateFormatLocale = locale;
        }

        return this._dateFormat;
    }

    _formatValue(value) {
        const date = toDate(value);

        return date ? this.dateFormat.format(date) : '';
    }

    _getTypeClassName() {
        return 'wy-table-date-cell';
    }
}

defineProperties(DateColumn, {
    alignment: { value: Justification.END },

    /**
     * The format: a name from {@link DATE_FORMATS} or `Intl.DateTimeFormat` options.
     */
    format: {
        value: 'date-time',
        coerce(format) {
            if (typeof format === 'string') {
                if (!(format in DATE_FORMATS)) {
                    throw new RangeError(`Unknown date format '${format}'.`);
                }
            } else if (format === null || typeof format !== 'object') {
                throw new TypeError('A date format must be a name or Intl.DateTimeFormat options.');
            }

            return format;
        },
        changed() {
            this._dateFormat = null;
            this._contentWidth = 0;
            this._invalidate(ColumnChange.CELLS);
            this._invalidate(ColumnChange.WIDTH);
        },
    },
});

registerType('date-column', DateColumn);
