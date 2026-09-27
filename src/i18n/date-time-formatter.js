/**
 * @module i18n/date-time-formatter
 */

import { defineProperties, lazySingleton } from '../core/instance.js';
import {
    DAY,
    getDateTimeFormat,
    getZonedFields,
    toIntlTimeZone,
    utcTimestamp,
} from './intl-util.js';
import { LocaleAware } from './locale-aware.js';

/**
 * The length of preferred date and time formats, as in `Intl.DateTimeFormat`'s `dateStyle` and
 * `timeStyle`.
 *
 * @enum {string}
 */
export const DateTimeStyle = Object.freeze({
    SHORT: 'short', // 8/10/13, 2:05 PM.
    MEDIUM: 'medium', // Aug 10, 2013, 2:05:09 PM.
    LONG: 'long', // August 10, 2013, 2:05:09 PM UTC.
    FULL: 'full', // Saturday, August 10, 2013, 2:05:09 PM Coordinated Universal Time.
});

/**
 * The composite specifiers and what they stand for, as in C.
 *
 * @type {Record<string, string>}
 */
const COMPOSITES = {
    r: '%I:%M:%S %p',
    R: '%H:%M',
    T: '%H:%M:%S',
    D: '%m/%d/%y',
    F: '%Y-%m-%d',
};

/**
 * Matches a specifier after its `%`: optional glibc flags and the specifier character.
 *
 * @type {RegExp}
 */
const SPECIFIER_REGEXP = /([-_0^]*)([aAdejuwUVWbBhmCgGyYHkIlMLpPSzZsntcxXrRTDF%])/y;

/**
 * The padding of the numeric specifiers: their width and padding character.
 *
 * @type {Record<string, [number, string]>}
 */
const PADDING = {
    d: [2, '0'],
    e: [2, ' '],
    j: [3, '0'],
    U: [2, '0'],
    V: [2, '0'],
    W: [2, '0'],
    m: [2, '0'],
    C: [2, '0'],
    g: [2, '0'],
    G: [4, '0'],
    y: [2, '0'],
    Y: [4, '0'],
    H: [2, '0'],
    k: [2, ' '],
    I: [2, '0'],
    l: [2, ' '],
    M: [2, '0'],
    S: [2, '0'],
    L: [3, '0'],
};

function checkStyle(style) {
    if (!Object.values(DateTimeStyle).includes(style)) {
        throw new RangeError(`Invalid date-time style '${style}'.`);
    }
}

/**
 * Converts a timestamp argument to milliseconds since the Unix epoch.
 *
 * @param {number | string | Date} timestamp
 * @returns {number}
 */
function toTimestamp(timestamp) {
    let value;
    if (timestamp instanceof Date) {
        value = timestamp.getTime();
    } else if (typeof timestamp === 'number') {
        value = timestamp;
    } else if (typeof timestamp === 'string' && /^\s*[-+]?\d+\s*$/.test(timestamp)) {
        value = Number(timestamp);
    } else {
        throw new TypeError('The timestamp must be a number, a numeric string or a Date.');
    }

    if (!Number.isFinite(value)) {
        throw new RangeError('The timestamp must be finite.');
    }

    return Math.trunc(value);
}

/**
 * Returns the day of the year, 1 for January 1.
 *
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {number}
 */
function getDayOfYear(year, month, day) {
    return Math.round((utcTimestamp(year, month, day) - utcTimestamp(year, 0, 1)) / DAY) + 1;
}

/**
 * Returns the ISO 8601 week and week-based year of a date. Weeks start on Monday, and week 1 is
 * the week with the first Thursday of the year.
 *
 * @param {number | Date} timestamp A timestamp; only its UTC date is used.
 * @returns {{year: number, week: number}}
 */
export function getIsoWeek(timestamp) {
    const date = new Date(toTimestamp(timestamp));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    return getIsoWeekOfDate(year, month, day, date.getUTCDay());
}

function getIsoWeekOfDate(year, month, day, weekDay) {
    // The Thursday of the same week decides the year.
    const thursday = new Date(utcTimestamp(year, month, day + 4 - (weekDay || 7)));
    const thursdayYear = thursday.getUTCFullYear();

    const dayOfYear = getDayOfYear(thursdayYear, thursday.getUTCMonth(), thursday.getUTCDate());

    return { year: thursdayYear, week: Math.ceil(dayOfYear / 7) };
}

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
export class DateTimeFormatter extends LocaleAware {
    /**
     * The time zone used for formatting: `timeZone`, or else the locale manager's.
     *
     * @type {string}
     */
    get effectiveTimeZone() {
        return this._timeZone || this._getDefaultTimeZone();
    }

    /**
     * Formats a date-time with a format.
     *
     * @param {string} format
     * @param {number | string | Date} timestamp Milliseconds since the Unix epoch, or a `Date`.
     * @returns {string}
     * @throws {TypeError} If the format is not a string or the timestamp is not a time.
     */
    format(format, timestamp) {
        if (typeof format !== 'string') {
            throw new TypeError('The format must be a string.');
        }

        const time = toTimestamp(timestamp);
        const timeZone = this.effectiveTimeZone;
        const fields = getZonedFields(time, timeZone);

        const output = [];

        let position = 0;
        while (position < format.length) {
            const percent = format.indexOf('%', position);
            if (percent < 0) {
                output.push(format.slice(position));
                break;
            }

            output.push(format.slice(position, percent));

            SPECIFIER_REGEXP.lastIndex = percent + 1;
            const matches = SPECIFIER_REGEXP.exec(format);
            if (!matches) {
                output.push('%');
                position = percent + 1;
                continue;
            }

            const [specifier, flags, character] = matches;
            output.push(this._formatSpecifier(character, flags, time, fields, timeZone));

            position = percent + 1 + specifier.length;
        }

        return output.join('');
    }

    /**
     * Formats the date of a timestamp in a preferred format of the locale.
     *
     * @param {number | string | Date} timestamp
     * @param {string} [style] Defaults to `dateStyle`.
     * @returns {string}
     */
    formatDate(timestamp, style = this._dateStyle) {
        checkStyle(style);

        return this._formatIntl(timestamp, { dateStyle: style });
    }

    /**
     * Formats the time of a timestamp in a preferred format of the locale.
     *
     * @param {number | string | Date} timestamp
     * @param {string} [style] Defaults to `timeStyle`.
     * @returns {string}
     */
    formatTime(timestamp, style = this._timeStyle) {
        checkStyle(style);

        return this._formatIntl(timestamp, { timeStyle: style });
    }

    /**
     * Formats the date and time of a timestamp in a preferred format of the locale.
     *
     * @param {number | string | Date} timestamp
     * @param {string} [dateStyle] Defaults to the `dateStyle` property.
     * @param {string} [timeStyle] Defaults to the `timeStyle` property.
     * @returns {string}
     */
    formatDateTime(timestamp, dateStyle = this._dateStyle, timeStyle = this._timeStyle) {
        checkStyle(dateStyle);
        checkStyle(timeStyle);

        return this._formatIntl(timestamp, { dateStyle, timeStyle });
    }

    _formatIntl(timestamp, options) {
        const format = getDateTimeFormat(this.effectiveLocale, {
            ...options,
            timeZone: toIntlTimeZone(this.effectiveTimeZone),
            calendar: 'gregory',
        });

        return format.format(toTimestamp(timestamp));
    }

    _formatSpecifier(character, flags, time, fields, timeZone) {
        if (COMPOSITES[character]) {
            return this.format(COMPOSITES[character], time);
        }

        const manager = this.effectiveLocaleManager;
        const { year, month, day, hours, weekDay } = fields;

        let value;
        switch (character) {
            case 'a':
                value = manager.shortDayNames[weekDay];
                break;

            case 'A':
                value = manager.longDayNames[weekDay];
                break;

            case 'd':
            case 'e':
                value = day;
                break;

            case 'j':
                value = getDayOfYear(year, month, day);
                break;

            case 'u':
                value = weekDay || 7;
                break;

            case 'w':
                value = weekDay;
                break;

            case 'U':
                value = Math.floor((getDayOfYear(year, month, day) - 1 + 7 - weekDay) / 7);
                break;

            case 'W':
                value = Math.floor(
                    (getDayOfYear(year, month, day) - 1 + 7 - ((weekDay + 6) % 7)) / 7
                );
                break;

            case 'V':
                value = getIsoWeekOfDate(year, month, day, weekDay).week;
                break;

            case 'b':
            case 'h':
                value = manager.shortMonthNames[month];
                break;

            case 'B':
                value = manager.longMonthNames[month];
                break;

            case 'm':
                value = month + 1;
                break;

            case 'C':
                value = Math.floor(year / 100);
                break;

            case 'g':
                value = getIsoWeekOfDate(year, month, day, weekDay).year % 100;
                break;

            case 'G':
                value = getIsoWeekOfDate(year, month, day, weekDay).year;
                break;

            case 'y':
                value = ((year % 100) + 100) % 100;
                break;

            case 'Y':
                value = year;
                break;

            case 'H':
            case 'k':
                value = hours;
                break;

            case 'I':
            case 'l':
                value = hours % 12 || 12;
                break;

            case 'M':
                value = fields.minutes;
                break;

            case 'S':
                value = fields.seconds;
                break;

            case 'L':
                value = fields.milliseconds;
                break;

            case 'p':
                value = hours < 12 ? manager.amDesignator : manager.pmDesignator;
                break;

            case 'P':
                value = (hours < 12 ? manager.amDesignator : manager.pmDesignator).toLowerCase();
                break;

            case 'z': {
                const offset = Math.abs(fields.offset);
                const sign = fields.offset < 0 ? '-' : '+';

                value =
                    sign +
                    String(Math.floor(offset / 60)).padStart(2, '0') +
                    String(offset % 60).padStart(2, '0');
                break;
            }

            case 'Z':
                value = this._getTimeZoneName(time, timeZone);
                break;

            case 's':
                value = Math.floor(time / 1000);
                break;

            case 'c':
                value = this.formatDate(time);
                break;

            case 'x':
                value = this.formatDateTime(time);
                break;

            case 'X':
                value = this.formatTime(time);
                break;

            case 'n':
                value = '\n';
                break;

            case 't':
                value = '\t';
                break;

            case '%':
                value = '%';
                break;
        }

        let text = PADDING[character] ? this._pad(value, PADDING[character], flags) : String(value);

        if (flags.includes('^')) {
            text = text.toLocaleUpperCase(manager.locale);
        }

        return text;
    }

    _pad(value, [width, character], flags) {
        // The last padding flag wins.
        for (const flag of flags) {
            if (flag === '-') {
                width = 0;
            } else if (flag === '_') {
                character = ' ';
            } else if (flag === '0') {
                character = '0';
            }
        }

        const digits = String(Math.abs(value)).padStart(width - (value < 0 ? 1 : 0), character);

        return value < 0 ? '-' + digits : digits;
    }

    _getTimeZoneName(time, timeZone) {
        if (timeZone === 'UTC') {
            return 'UTC';
        }

        const format = getDateTimeFormat(this.effectiveLocale, {
            timeZone: toIntlTimeZone(timeZone),
            timeZoneName: 'short',
        });

        return format.formatToParts(time).find((x) => x.type === 'timeZoneName')?.value || '';
    }
}

defineProperties(DateTimeFormatter, {
    /**
     * The time zone to format in (an IANA name, `'UTC'` or `'local'`), or `null` (the default) for
     * the time zone of the locale manager.
     */
    timeZone: {
        value: null,
        coerce(timeZone) {
            if (timeZone === null || timeZone === undefined || timeZone === 'local') {
                return timeZone ?? null;
            }

            // Validate the name; this throws a RangeError for unknown time zones.
            return new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
        },
    },

    /**
     * The style of preferred date formats: of `%c`, `%x` and {@link DateTimeFormatter#formatDate}.
     */
    dateStyle: {
        value: DateTimeStyle.MEDIUM,
        coerce(style) {
            checkStyle(style);

            return style;
        },
    },

    /**
     * The style of preferred time formats: of `%X`, `%x` and {@link DateTimeFormatter#formatTime}.
     */
    timeStyle: {
        value: DateTimeStyle.MEDIUM,
        coerce(style) {
            checkStyle(style);

            return style;
        },
    },
});

/**
 * Returns the date-time formatter singleton, which follows the locale manager.
 *
 * @type {() => DateTimeFormatter}
 */
export const getDateTimeFormatter = lazySingleton(() => new DateTimeFormatter());

/**
 * Formats a timestamp with a `strftime` format, using the singleton.
 *
 * @param {string} format
 * @param {number | string | Date} timestamp
 * @returns {string}
 */
export function formatDateTimePattern(format, timestamp) {
    return getDateTimeFormatter().format(format, timestamp);
}

/**
 * Formats the date of a timestamp in a preferred format of the current locale.
 *
 * @param {number | string | Date} timestamp
 * @param {string} [style]
 * @returns {string}
 */
export function formatDate(timestamp, style) {
    return getDateTimeFormatter().formatDate(timestamp, style);
}

/**
 * Formats the time of a timestamp in a preferred format of the current locale.
 *
 * @param {number | string | Date} timestamp
 * @param {string} [style]
 * @returns {string}
 */
export function formatTime(timestamp, style) {
    return getDateTimeFormatter().formatTime(timestamp, style);
}

/**
 * Formats the date and time of a timestamp in a preferred format of the current locale.
 *
 * @param {number | string | Date} timestamp
 * @param {string} [dateStyle]
 * @param {string} [timeStyle]
 * @returns {string}
 */
export function formatDateTime(timestamp, dateStyle, timeStyle) {
    return getDateTimeFormatter().formatDateTime(timestamp, dateStyle, timeStyle);
}
