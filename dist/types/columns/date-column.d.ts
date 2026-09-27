/**
 * @module columns/date-column
 */
import { DataColumn } from './data-column.js';
/**
 * Named date formats, as `Intl.DateTimeFormat` options.
 *
 * @type {Readonly<Record<string, Intl.DateTimeFormatOptions>>}
 */
export declare const DATE_FORMATS: Readonly<Record<string, Intl.DateTimeFormatOptions>>;
/**
 * Converts a value to a date: `Date` objects, timestamps in milliseconds and date strings (such
 * as ISO 8601) are accepted. A date without a time (`'2013-09-19'`) is a local date.
 *
 * @param {unknown} value
 * @returns {Date | null} The date, or `null` if the value is not a valid date.
 */
export declare function toDate(value: unknown): Date | null;
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
export declare class DateColumn extends DataColumn {
    /** @type {Intl.DateTimeFormat | null} */
    _dateFormat: Intl.DateTimeFormat | null;
    _dateFormatLocale: any;
    _initialize(): void;
    /**
     * The `Intl.DateTimeFormat` of the column for the current locale.
     *
     * @type {Intl.DateTimeFormat}
     */
    get dateFormat(): Intl.DateTimeFormat;
    _formatValue(value: any): string;
    _getTypeClassName(): string;
}

/** The declared properties of {@link DateColumn}. */
export interface DateColumn {
    alignment: any;
    /**
     * The format: a name from {@link DATE_FORMATS} or `Intl.DateTimeFormat` options.
     */
    format: string;
}
