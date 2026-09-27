/**
 * @module i18n/date-time-formatter
 */
import { LocaleAware } from './locale-aware.js';
/**
 * The length of preferred date and time formats, as in `Intl.DateTimeFormat`'s `dateStyle` and
 * `timeStyle`.
 *
 * @enum {string}
 */
export declare const DateTimeStyle: Readonly<{
    SHORT: "short";
    MEDIUM: "medium";
    LONG: "long";
    FULL: "full";
}>;
/**
 * Returns the ISO 8601 week and week-based year of a date. Weeks start on Monday, and week 1 is
 * the week with the first Thursday of the year.
 *
 * @param {number | Date} timestamp A timestamp; only its UTC date is used.
 * @returns {{year: number, week: number}}
 */
export declare function getIsoWeek(timestamp: number | Date): {
    year: number;
    week: number;
};
/**
 * The date-time formatter formats timestamps like C's `strftime`, in the locale (for names and
 * preferred formats) and time zone of the locale manager.
 *
 * Specifiers:
 *
 * - Day: `%a` (short name), `%A` (long name), `%d` (01-31), `%e` (1-31, padded with a space),
 *   `%j` (day of the year, 001-366), `%u` (day of the week, 1-7 from Monday) and `%w` (0-6 from
 *   Sunday).
 * - Week: `%U` (week of the year with weeks starting on Sunday, 00-53), `%W` (the same with weeks
 *   starting on Monday) and `%V` (ISO 8601 week, 01-53).
 * - Month: `%b` or `%h` (short name), `%B` (long name) and `%m` (01-12).
 * - Year: `%C` (century), `%g` and `%G` (the 2- and 4-digit ISO 8601 week-based year), `%y`
 *   (2 digits) and `%Y`.
 * - Time: `%H` (00-23), `%k` (0-23, padded with a space), `%I` (01-12), `%l` (1-12, padded with a
 *   space), `%M`, `%S`, `%L` (milliseconds, 000-999), `%p` (the locale's AM or PM), `%P` (the
 *   same in lowercase), `%z` (the offset from UTC, e.g. `+0200`) and `%Z` (the time zone name,
 *   e.g. `UTC` or `CEST`).
 * - Stamps: `%s` (seconds since the Unix epoch), and the composites `%r` (`%I:%M:%S %p`), `%R`
 *   (`%H:%M`), `%T` (`%H:%M:%S`), `%D` (`%m/%d/%y`) and `%F` (`%Y-%m-%d`).
 * - Preferred formats of the locale, as in the original toolkit: `%c` (the date, in `dateStyle`),
 *   `%x` (the date and time) and `%X` (the time, in `timeStyle`). Note that C swaps `%c` and `%x`.
 * - `%n` (newline), `%t` (tab) and `%%` (a percent sign).
 *
 * The glibc flags `-` (no padding), `_` (pad with spaces), `0` (pad with zeros) and `^`
 * (uppercase) may follow the `%`, e.g. `%-d` for the day without padding. A `%` that does not
 * start a valid specifier is copied as is.
 *
 * @example
 * const formatter = new DateTimeFormatter({ locale: 'en-US' });
 * formatter.format('%A, %B %-d %Y', Date.UTC(2013, 7, 10)); // 'Saturday, August 10 2013'
 * formatter.formatDate(Date.UTC(2013, 7, 10), DateTimeStyle.SHORT); // '8/10/13'
 */
export declare class DateTimeFormatter extends LocaleAware {
    /**
     * The time zone used for formatting: `timeZone`, or else the locale manager's.
     *
     * @type {string}
     */
    get effectiveTimeZone(): string;
    /**
     * Formats a date-time with a format.
     *
     * @param {string} format
     * @param {number | string | Date} timestamp Milliseconds since the Unix epoch, or a `Date`.
     * @returns {string}
     * @throws {TypeError} If the format is not a string or the timestamp is not a time.
     */
    format(format: string, timestamp: number | string | Date): string;
    /**
     * Formats the date of a timestamp in a preferred format of the locale.
     *
     * @param {number | string | Date} timestamp
     * @param {string} [style] Defaults to `dateStyle`.
     * @returns {string}
     */
    formatDate(timestamp: number | string | Date, style?: string): string;
    /**
     * Formats the time of a timestamp in a preferred format of the locale.
     *
     * @param {number | string | Date} timestamp
     * @param {string} [style] Defaults to `timeStyle`.
     * @returns {string}
     */
    formatTime(timestamp: number | string | Date, style?: string): string;
    /**
     * Formats the date and time of a timestamp in a preferred format of the locale.
     *
     * @param {number | string | Date} timestamp
     * @param {string} [dateStyle] Defaults to the `dateStyle` property.
     * @param {string} [timeStyle] Defaults to the `timeStyle` property.
     * @returns {string}
     */
    formatDateTime(timestamp: number | string | Date, dateStyle?: string, timeStyle?: string): string;
    _formatIntl(timestamp: any, options: any): string;
    _formatSpecifier(character: any, flags: any, time: any, fields: any, timeZone: any): string;
    _pad(value: any, [width, character]: [any, any], flags: any): string;
    _getTimeZoneName(time: any, timeZone: any): string;
}
/**
 * Returns the date-time formatter singleton, which follows the locale manager.
 *
 * @type {() => DateTimeFormatter}
 */
export declare const getDateTimeFormatter: () => DateTimeFormatter;
/**
 * Formats a timestamp with a `strftime` format, using the singleton.
 *
 * @param {string} format
 * @param {number | string | Date} timestamp
 * @returns {string}
 */
export declare function formatDateTimePattern(format: string, timestamp: number | string | Date): string;
/**
 * Formats the date of a timestamp in a preferred format of the current locale.
 *
 * @param {number | string | Date} timestamp
 * @param {string} [style]
 * @returns {string}
 */
export declare function formatDate(timestamp: number | string | Date, style?: string): string;
/**
 * Formats the time of a timestamp in a preferred format of the current locale.
 *
 * @param {number | string | Date} timestamp
 * @param {string} [style]
 * @returns {string}
 */
export declare function formatTime(timestamp: number | string | Date, style?: string): string;
/**
 * Formats the date and time of a timestamp in a preferred format of the current locale.
 *
 * @param {number | string | Date} timestamp
 * @param {string} [dateStyle]
 * @param {string} [timeStyle]
 * @returns {string}
 */
export declare function formatDateTime(timestamp: number | string | Date, dateStyle?: string, timeStyle?: string): string;

/** The declared properties of {@link DateTimeFormatter}. */
export interface DateTimeFormatter {
    /**
     * The time zone to format in (an IANA name, `'UTC'` or `'local'`), or `null` (the default) for
     * the time zone of the locale manager.
     */
    timeZone: any;
    /**
     * The style of preferred date formats: of `%c`, `%x` and {@link DateTimeFormatter#formatDate}.
     */
    dateStyle: any;
    /**
     * The style of preferred time formats: of `%X`, `%x` and {@link DateTimeFormatter#formatTime}.
     */
    timeStyle: any;
}
