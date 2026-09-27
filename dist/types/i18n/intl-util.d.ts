/**
 * Cached `Intl` objects and time zone arithmetic shared by the formatters and parsers.
 *
 * @module i18n/intl-util
 */
/**
 * The number of milliseconds in a minute.
 *
 * @type {number}
 */
export declare const MINUTE: number;
/**
 * The number of milliseconds in a day.
 *
 * @type {number}
 */
export declare const DAY: number;
/**
 * Returns a cached `Intl.DateTimeFormat`.
 *
 * @param {string} locale
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {Intl.DateTimeFormat}
 */
export declare function getDateTimeFormat(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat;
/**
 * Returns a cached `Intl.NumberFormat`.
 *
 * @param {string} locale
 * @param {Intl.NumberFormatOptions} [options]
 * @returns {Intl.NumberFormat}
 */
export declare function getNumberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat;
/**
 * Returns a cached `Intl.PluralRules`.
 *
 * @param {string} locale
 * @param {Intl.PluralRulesOptions} [options]
 * @returns {Intl.PluralRules}
 */
export declare function getPluralRules(locale: string, options?: Intl.PluralRulesOptions): Intl.PluralRules;
/**
 * Returns a cached `Intl.RelativeTimeFormat`.
 *
 * @param {string} locale
 * @param {Intl.RelativeTimeFormatOptions} [options]
 * @returns {Intl.RelativeTimeFormat}
 */
export declare function getRelativeTimeFormat(locale: string, options?: Intl.RelativeTimeFormatOptions): Intl.RelativeTimeFormat;
/**
 * Converts a toolkit time zone (`'local'` or an IANA name) to the `timeZone` option of `Intl`.
 *
 * @param {string} timeZone
 * @returns {string | undefined}
 */
export declare function toIntlTimeZone(timeZone: string): string | undefined;
/**
 * Creates a UTC timestamp from date and time fields. Unlike `Date.UTC`, years 0 to 99 are not
 * mapped to the twentieth century, and months and days may overflow.
 *
 * @param {number} year
 * @param {number} month The month, 0 for January.
 * @param {number} day The day of the month, from 1.
 * @param {number} [hours]
 * @param {number} [minutes]
 * @param {number} [seconds]
 * @param {number} [milliseconds]
 * @returns {number}
 */
export declare function utcTimestamp(year: number, month: number, day: number, hours?: number, minutes?: number, seconds?: number, milliseconds?: number): number;
/**
 * Returns the number of days in a month.
 *
 * @param {number} year
 * @param {number} month The month, 0 for January.
 * @returns {number}
 */
export declare function getDaysInMonth(year: number, month: number): number;
export type ZonedFields = {
    /**
     * The year, negative (or zero) for years before the common era.
     */
    year: number;
    /**
     * The month, 0 for January.
     */
    month: number;
    /**
     * The day of the month, from 1.
     */
    day: number;
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
    /**
     * The day of the week, 0 for Sunday.
     */
    weekDay: number;
    /**
     * The offset of the time zone from UTC in minutes, e.g. 120 for UTC+2.
     */
    offset: number;
};
/**
 * @typedef {object} ZonedFields
 * @property {number} year The year, negative (or zero) for years before the common era.
 * @property {number} month The month, 0 for January.
 * @property {number} day The day of the month, from 1.
 * @property {number} hours
 * @property {number} minutes
 * @property {number} seconds
 * @property {number} milliseconds
 * @property {number} weekDay The day of the week, 0 for Sunday.
 * @property {number} offset The offset of the time zone from UTC in minutes, e.g. 120 for UTC+2.
 */
/**
 * Splits a timestamp into its date and time fields in a time zone.
 *
 * @param {number} timestamp Milliseconds since the Unix epoch.
 * @param {string} timeZone `'UTC'`, `'local'` or an IANA time zone name.
 * @returns {ZonedFields}
 */
export declare function getZonedFields(timestamp: number, timeZone: string): ZonedFields;
/**
 * Returns the offset of a time zone from UTC at a moment, in minutes.
 *
 * @param {number} timestamp
 * @param {string} timeZone
 * @returns {number}
 */
export declare function getTimeZoneOffset(timestamp: number, timeZone: string): number;
/**
 * Converts date and time fields in a time zone to a timestamp. For a wall-clock time that occurs
 * twice (when clocks are turned back) the first is used; for one that does not exist (when clocks
 * are turned forward) the time is moved forward by the gap.
 *
 * @param {Partial<ZonedFields> & {year: number, month: number, day: number}} fields
 * @param {string} timeZone
 * @returns {number}
 */
export declare function fromZonedFields(fields: Partial<ZonedFields> & {
    year: number;
    month: number;
    day: number;
}, timeZone: string): number;
