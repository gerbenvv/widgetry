/**
 * @module i18n/date-time-parser
 */
import { LocaleAware } from './locale-aware.js';
export type LocaleData = {
    /**
     * The order of day, month and year in short dates, e.g. `'dmy'`.
     */
    dateOrder: string;
    /**
     * Extra month names (as used in dates), per month.
     */
    monthNames: string[][];
    /**
     * The words of the locale's date formats, which are ignored.
     */
    fillers: Set<string>;
    /**
     * Words like `yesterday`.
     */
    relativeWords: Map<string, {
        unit: string;
        offset: number;
    }>;
    /**
     * E.g. `in 3 days`.
     */
    relativeTemplates: {
        regexp: RegExp;
        unit: string;
        sign: number;
    }[];
    /**
     * Words between a date and a time, like `at`.
     */
    connectors: string[];
    /**
     * The separators between hours and minutes, like `:`.
     */
    timeSeparators: string[];
};
/**
 * The date-time parser reads dates and times as typed by people, in the locale of the locale
 * manager (its month and day names, date order and AM/PM designators) and in English. It is
 * strict: the whole text must be understood and describe an existing date, or the result is
 * `null`.
 *
 * Understood dates:
 *
 * - Numeric dates in the locale's order (`10/8/2013` in Britain, `8/10/2013` in the US), with any
 *   of the separators `-`, `/`, `.` and `\`, and ISO dates (`2013-08-10`). A leading 4-digit year
 *   means year, month, day. Two-digit years (`13` or `'13`) are in the century up to
 *   `twoDigitYearMax`. Without a year, the current year is used.
 * - Dates with month names or prefixes of them (`August 10, 2013`, `10 aug 2013`, `10th of
 *   August`, `2013年8月10日`), optionally with a day name, which must then match.
 * - A year alone (`1990`, January 1), a month and year (`August 2013`, its first day) and a day
 *   alone (`15`, in the current month).
 * - Relative dates, from the original toolkit and from `Intl.RelativeTimeFormat` in the locale:
 *   `now`, `the day before yesterday`, `yesterday`, `today`, `tomorrow`, `the day after tomorrow`
 *   (`eergisteren` ... `overmorgen` in Dutch), `last/this/next day/week/month/year` (the first day
 *   of that week, month or year), `3 days ago`, `in 2 weeks` (`vor 3 Tagen` in German), day names
 *   (`friday`, `next friday`: the next one after today; `last friday`: the last one before
 *   today) and month names (`august`, `next august`, `past august`: the first day of it).
 *
 * Understood times: `14:05`, `14:05:09`, `14:05:09.042`, `2:05 PM`, `2 pm`, `14h05` (or `14 h 05`), the locale's
 * own separator (`14.05` in Finnish), `noon`, `midnight` and `now`.
 *
 * Dates are returned as `Date` objects at midnight in `timeZone` (the locale manager's by
 * default, which is UTC). {@link DateTimeParser#parseExact} parses a text in a `strftime` format
 * of the {@link DateTimeFormatter}.
 *
 * @example
 * const parser = new DateTimeParser({ locale: 'nl-NL' });
 * parser.parseDate('10 augustus 2013'); // 2013-08-10T00:00:00Z
 * parser.parseDate('10-8-13'); // 2013-08-10T00:00:00Z
 * parser.parseDateTime('morgen 14:30');
 * parser.parseTime('2:05 PM'); // 50700000, milliseconds since midnight
 */
export declare class DateTimeParser extends LocaleAware {
    /**
     * The time zone dates are in: `timeZone`, or else the locale manager's.
     *
     * @type {string}
     */
    get effectiveTimeZone(): string;
    /**
     * Parses a date.
     *
     * @param {string} input
     * @returns {Date | null} The date at midnight (or the current time for `now`), or `null` if the
     *     text is not a valid date.
     * @throws {TypeError} If the input is not a string.
     */
    parseDate(input: string): Date | null;
    /**
     * Parses a time of day.
     *
     * @param {string} input
     * @returns {number | null} The time as milliseconds since midnight, or `null` if the text is
     *     not a valid time.
     * @throws {TypeError} If the input is not a string.
     */
    parseTime(input: string): number | null;
    /**
     * Parses a date and a time, in either order (`10 aug 2013 14:05` or `2 pm tomorrow`), or only
     * one of them: a date alone is at midnight, and a time alone is today. ISO 8601 date-times
     * (`2013-08-10T14:05:09Z`) are understood too, including their time zone.
     *
     * @param {string} input
     * @returns {Date | null}
     * @throws {TypeError} If the input is not a string.
     */
    parseDateTime(input: string): Date | null;
    /**
     * Parses a text in a `strftime` format of the {@link DateTimeFormatter}, e.g. `'%d-%m-%Y'`.
     * Numbers may omit their padding, names may be abbreviated and whitespace may vary. Fields
     * missing from the format are taken from today (when the format has no date at all) or are
     * the first month and day. The preferred formats `%c`, `%x` and `%X` can only be used alone;
     * they parse like {@link DateTimeParser#parseDate}, {@link DateTimeParser#parseDateTime} and
     * a time today.
     *
     * @param {string} input
     * @param {string} format
     * @returns {Date | null}
     * @throws {TypeError} If the input or format is not a string.
     * @throws {Error} If the format uses `%c`, `%x` or `%X` with other specifiers.
     */
    parseExact(input: string, format: string): Date | null;
    _prepareInput(input: any): string;
    _isNow(text: any): boolean;
    _getNow(): any;
    _getToday(): {
        year: number;
        month: number;
        day: number;
        weekDay: number;
    };
    _toDate({ year, month, day }: {
        day: any;
        month: any;
        year: any;
    }, time: any): Date;
    _getRelativeWord(text: any): {
        unit: string;
        offset: number;
    };
    _parseIso(text: any): Date;
    _parseOffset(zone: any): number;
    _isValidDate({ year, month, day }: {
        day: any;
        month: any;
        year: any;
    }): boolean;
    /**
     * Parses a normalized date text to its fields.
     *
     * @param {string} text
     * @returns {{year: number, month: number, day: number} | null}
     */
    _parseDateText(text: string): {
        year: number;
        month: number;
        day: number;
    } | null;
    /**
     * Removes the spaces from the month and day names of more than one word in a text, such as
     * `יום שבת` (Hebrew) and `thu bay` (Vietnamese), so they are single words like their names in
     * {@link DateTimeParser#_getMonthNames} and {@link DateTimeParser#_getDayNames}.
     *
     * @param {string} text A normalized text.
     * @returns {string}
     */
    _joinNames(text: string): string;
    /**
     * Parses a relative date.
     *
     * @param {string} text
     * @returns {{year: number, month: number, day: number} | null | undefined} `undefined` if
     *     the text is not a relative date.
     */
    _parseRelativeDate(text: string): {
        year: number;
        month: number;
        day: number;
    } | null | undefined;
    /**
     * Parses a day or month name relative to today: the next one (`direction` 1 or 0) or the
     * last one (-1).
     */
    _parseNamedRelative(text: any, today: any, direction: any): {
        year: any;
        month: number;
        day: number;
    };
    _addDays({ year, month, day }: {
        day: any;
        month: any;
        year: any;
    }, days: any): {
        year: number;
        month: number;
        day: number;
    };
    _addUnits(date: any, unit: any, count: any): {
        year: number;
        month: number;
        day: number;
    };
    /**
     * Moves to the first day of the day, week, month or year some units from today, e.g. the
     * first day of the last month for `('month', -1)`.
     */
    _moveToUnit(today: any, unit: any, offset: any): any;
    _getMonthNames(): string[][];
    _getDayNames(): string[][];
    /**
     * Splits a word that is a month name, day name or marker with a filler word or marker attached
     * to it, such as `באוגוסט` (Hebrew, "in August"), `วันเสาร์ที่` (Thai, "Saturday the") and
     * `日土曜日` (Japanese, a day marker and "Saturday").
     *
     * @param {string} word
     * @param {Set<string>} fillers The filler words of the locale.
     * @param {string[][]} monthNames
     * @param {string[][]} dayNames
     * @returns {string[] | null} The two words, or `null` if the word cannot be split.
     */
    _splitWord(word: string, fillers: Set<string>, monthNames: string[][], dayNames: string[][]): string[] | null;
    _expandYear(value: any, digits: any): any;
    /**
     * Parses the tokens of an absolute date.
     *
     * @param {object[]} tokens
     * @returns {{year: number, month: number, day: number} | null}
     */
    _parseAbsoluteDate(tokens: object[]): {
        year: number;
        month: number;
        day: number;
    } | null;
    _assignNumbers(date: any, numbers: any, components: any): any;
    _getDesignatorRegExp(): {
        am: string;
        pm: string;
    };
    /**
     * Parses a normalized time text.
     *
     * @param {string} text
     * @param {boolean} alone Whether the text is only a time, which allows more separators.
     * @returns {number | null} Milliseconds since midnight.
     */
    _parseTimeText(text: string, alone: boolean): number | null;
    _compileFormat(format: any): {
        regexp: RegExp;
        fields: any[];
    };
    _literalPattern(text: any): string;
    _buildExact(specifiers: any, values: any): Date;
}
/**
 * Returns the date-time parser singleton, which follows the locale manager.
 *
 * @type {() => DateTimeParser}
 */
export declare const getDateTimeParser: () => DateTimeParser;
/**
 * Parses a date with the singleton.
 *
 * @param {string} input
 * @returns {Date | null}
 */
export declare function parseDate(input: string): Date | null;
/**
 * Parses a date and time with the singleton.
 *
 * @param {string} input
 * @returns {Date | null}
 */
export declare function parseDateTime(input: string): Date | null;
/**
 * Parses a time of day with the singleton.
 *
 * @param {string} input
 * @returns {number | null} Milliseconds since midnight.
 */
export declare function parseTime(input: string): number | null;

/** The declared properties of {@link DateTimeParser}. */
export interface DateTimeParser {
    /**
     * The time zone dates are parsed in (an IANA name, `'UTC'` or `'local'`), or `null` (the
     * default) for the time zone of the locale manager.
     */
    timeZone: any;
    /**
     * The largest two-digit year that is in this century: with 29, `'29` is 2029 and `'30` is
     * 1930.
     */
    twoDigitYearMax: number;
    /**
     * The time relative dates (`today`, `next week`) are relative to, as a timestamp, or `null`
     * (the default) for the current time.
     */
    referenceTime: any;
}
