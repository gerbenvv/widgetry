/**
 * @module i18n/date-time-parser
 */

import { defineProperties, lazySingleton } from '../core/instance.js';
import {
    fromZonedFields,
    getDateTimeFormat,
    getDaysInMonth,
    getRelativeTimeFormat,
    getZonedFields,
    MINUTE,
    utcTimestamp,
} from './intl-util.js';
import { LocaleAware } from './locale-aware.js';
import { toLatinDigits } from './number-parser.js';

/**
 * The English month names, which are always understood.
 *
 * @type {string[]}
 */
const ENGLISH_MONTH_NAMES = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
];

/**
 * The English day names, Sunday first, which are always understood.
 *
 * @type {string[]}
 */
const ENGLISH_DAY_NAMES = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
];

/**
 * The shortest prefix of a month name that is understood, e.g. `'aug'`.
 *
 * @type {number}
 */
const MONTH_PREFIX_LENGTH = 3;

/**
 * The shortest prefix of a day name that is understood, e.g. `'fr'`.
 *
 * @type {number}
 */
const DAY_PREFIX_LENGTH = 2;

/**
 * Ordinal suffixes that may directly follow a day number: English (`10th`), French (`1er`) and
 * Dutch (`1ste`, `2de`) ones.
 *
 * @type {Set<string>}
 */
const ORDINAL_SUFFIXES = new Set(['st', 'nd', 'rd', 'th', 'er', 'e', 'ste', 'de']);

/**
 * Words that mark the number before them as a year, month or day, as in `2013年8月10日`
 * (Chinese and Japanese), `2013년 8월 10일` (Korean), `2013 г.` (Russian) and `2013 р.`
 * (Ukrainian).
 *
 * @type {Record<string, 'y' | 'm' | 'd'>}
 */
const MARKERS = { 年: 'y', 月: 'm', 日: 'd', 년: 'y', 월: 'm', 일: 'd', г: 'y', р: 'y' };

/**
 * Words that are ignored between the parts of a date, as in `10th of August` or `10 de agosto`.
 *
 * @type {Set<string>}
 */
const FILLER_WORDS = new Set(['of', 'the', 'de', 'del', 'den', 'der', 'le']);

/**
 * The units of relative dates.
 *
 * @type {string[]}
 */
const UNITS = ['day', 'week', 'month', 'year'];

/**
 * English relative days from the original toolkit, with their offsets from today.
 *
 * @type {[RegExp, number][]}
 */
const ENGLISH_RELATIVE_DAYS = [
    [/^(the )?day before (y(ester)?day|(the )?(past|last) day)$/, -2],
    [/^(y(ester)?day|(the )?(past|prev(ious)?|last) day)$/, -1],
    [/^(today|(the )?(present|current) day)$/, 0],
    [/^(tom+or+ow|(the )?(next|coming) day)$/, 1],
    [/^(the )?day after (tom+or+ow|(the )?(next|coming) day)$/, 2],
];

/**
 * English words for the past and the future, followed by a unit, a day name or a month name.
 *
 * @type {[RegExp, number][]}
 */
const ENGLISH_DIRECTIONS = [
    [/^(the )?(past|prev(ious)?|last) (.+)$/, -1],
    [/^(the )?(next|coming) (.+)$/, 1],
    [/^(this|the (present|current)) (.+)$/, 0],
];

/**
 * English relative dates with a count, e.g. `3 days ago` and `in 2 weeks`.
 *
 * @type {[RegExp, number][]}
 */
const ENGLISH_COUNTED = [
    [/^(\d+) (day|week|month|year)s? ago$/, -1],
    [/^in (\d+) (day|week|month|year)s?$/, 1],
    [/^(\d+) (day|week|month|year)s? from now$/, 1],
];

/**
 * English names of times of day.
 *
 * @type {Record<string, number>}
 */
const ENGLISH_TIMES = { noon: 12 * 60, midday: 12 * 60, midnight: 0 };

/**
 * An ISO 8601 date and time, e.g. `2013-08-10T14:05:09.042Z`.
 *
 * @type {RegExp}
 */
const ISO_REGEXP =
    /^(\d{4})-(\d{2})-(\d{2})(?:[t ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(z|[+-]\d{2}(?::?\d{2})?)?)?$/;

/**
 * Splits a normalized input into numbers, short years (`'90`), words (with abbreviation periods,
 * hyphens and apostrophes), separators and whitespace.
 *
 * @type {RegExp}
 */
const TOKEN_REGEXP =
    /(\d+)|('\d{2})|([\p{L}\p{M}]+(?:(?:[-'’]|[.\u05f3\u0970]+)[\p{L}\p{M}]+)*[.\u05f3\u0970]?)|([-/.\\:])|(\s+)|(.)/gu;

/**
 * Matches the characters that are removed from words: the periods and signs of abbreviations
 * (`aug.`, the Hebrew geresh and the Devanagari abbreviation sign), and the hyphens and
 * apostrophes inside words (`quinta-feira`, `d’agost`).
 *
 * @type {RegExp}
 */
const WORD_PUNCTUATION_REGEXP = /[-.'’\u05f3\u0970]/g;

/**
 * The cached data of locales that does not depend on the locale manager's overridable names.
 *
 * @type {Map<string, LocaleData>}
 */
const LOCALE_DATA = new Map();

/**
 * @typedef {object} LocaleData
 * @property {string} dateOrder The order of day, month and year in short dates, e.g. `'dmy'`.
 * @property {string[][]} monthNames Extra month names (as used in dates), per month.
 * @property {Set<string>} fillers The words of the locale's date formats, which are ignored.
 * @property {Map<string, {unit: string, offset: number}>} relativeWords Words like `yesterday`.
 * @property {{regexp: RegExp, unit: string, sign: number}[]} relativeTemplates E.g. `in 3 days`.
 * @property {string[]} connectors Words between a date and a time, like `at`.
 * @property {string[]} timeSeparators The separators between hours and minutes, like `:`.
 */

/**
 * Normalizes text for matching: lowercase, with Latin digits, without accents and bidirectional
 * marks, and with commas and whitespace collapsed to single spaces.
 *
 * @param {string} text
 * @param {string} locale
 * @returns {string}
 */
function normalizeText(text, locale) {
    return normalizeFragment(text, locale).trim();
}

/**
 * Normalizes part of a text like {@link normalizeText}, but keeps leading and trailing spaces.
 *
 * @param {string} text
 * @param {string} locale
 * @returns {string}
 */
function normalizeFragment(text, locale) {
    // Only the combining diacritical marks (accents) and the Arabic hamza above (the Persian
    // ezafe, as in `فوریهٔ`) are removed: other marks, such as the vowels of Thai and Devanagari,
    // are part of the letters.
    return toLatinDigits(text)
        .toLocaleLowerCase(locale)
        .normalize('NFD')
        .replace(/[\u0300-\u036f\u0654]/g, '')
        .normalize('NFC')
        .replace(/[\u200e\u200f\u061c]/g, '')
        .replace(/[,\u060c\s]+/gu, ' ');
}

/**
 * Escapes text for literal use in a regular expression with the `u` flag, where escaping
 * characters without a special meaning (like `-`) is an error.
 *
 * @param {string} text
 * @returns {string}
 */
function escapePattern(text) {
    return text.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
}

function normalizeName(name, locale) {
    return normalizeText(name, locale).replace(WORD_PUNCTUATION_REGEXP, '');
}

function getLocaleData(locale) {
    let data = LOCALE_DATA.get(locale);
    if (data) {
        return data;
    }

    const sample = utcTimestamp(2013, 7, 10, 14, 5, 9);
    const options = { timeZone: 'UTC', calendar: 'gregory', numberingSystem: 'latn' };

    // The date order, from the short date format.
    const dateOrder = getDateTimeFormat(locale, { ...options, dateStyle: 'short' })
        .formatToParts(sample)
        .map((part) => ({ day: 'd', month: 'm', year: 'y' })[part.type])
        .filter(Boolean)
        .join('');

    // Month names as used in dates, which differ from the stand-alone names in some languages.
    const monthNames = Array.from({ length: 12 }, () => []);
    for (const month of ['long', 'short']) {
        const format = getDateTimeFormat(locale, { ...options, day: 'numeric', month });

        for (let i = 0; i < 12; i++) {
            const part = format
                .formatToParts(utcTimestamp(2013, i, 10))
                .find((x) => x.type === 'month');

            if (part && !/\d/.test(part.value)) {
                monthNames[i].push(normalizeName(part.value, locale));
            }
        }
    }

    // The words of month names with a number, such as the Vietnamese `tháng 9` (month 9), mark the
    // number as the month like `月` does, and are ignored like the filler words.
    const monthWords = new Set();
    for (const month of ['long', 'short']) {
        const format = getDateTimeFormat(locale, { ...options, day: 'numeric', month });
        const part = format.formatToParts(sample).find((x) => x.type === 'month');

        if (part && /\d/.test(part.value)) {
            for (const word of normalizeName(part.value, locale).split(' ')) {
                if (/^[\p{L}\p{M}]+$/u.test(word)) {
                    monthWords.add(word);
                }
            }
        }
    }

    // The words of the locale's own date formats, such as `de` in Portuguese, `del` in Catalan and
    // the era in Thai, which are ignored like the filler words.
    const fillers = new Set(monthWords);
    for (const dateStyle of ['medium', 'long', 'full']) {
        const parts = getDateTimeFormat(locale, { ...options, dateStyle }).formatToParts(sample);

        for (const part of parts) {
            if (part.type !== 'literal' && part.type !== 'era') {
                continue;
            }

            for (const word of normalizeName(part.value, locale).split(' ')) {
                if (/^[\p{L}\p{M}]+$/u.test(word)) {
                    fillers.add(word);
                }
            }
        }
    }

    data = {
        dateOrder: dateOrder.length === 3 ? dateOrder : 'mdy',
        monthNames,
        fillers,
        ...getRelativeData(locale),
        ...getTimeData(locale, sample, options),
    };

    LOCALE_DATA.set(locale, data);

    return data;
}

function getRelativeData(locale) {
    const relativeWords = new Map();

    const automatic = getRelativeTimeFormat(locale, { numeric: 'auto' });
    relativeWords.set(normalizeText(automatic.format(0, 'second'), locale), {
        unit: 'now',
        offset: 0,
    });

    for (const unit of UNITS) {
        for (const offset of unit === 'day' ? [-2, -1, 0, 1, 2] : [-1, 0, 1]) {
            const phrase = normalizeText(automatic.format(offset, unit), locale);

            // Numeric phrases like "in 2 days" are covered by the templates.
            if (!/\d/.test(phrase) && !relativeWords.has(phrase)) {
                relativeWords.set(phrase, { unit, offset });
            }
        }
    }

    // Build patterns from phrases with numbers, for each plural form.
    const relativeTemplates = [];
    const sources = new Set();
    const numeric = getRelativeTimeFormat(locale, { numeric: 'always' });
    for (const unit of UNITS) {
        for (const sign of [-1, 1]) {
            for (const count of [1, 2, 3, 5, 11, 21, 22, 100, 101]) {
                const pattern = numeric
                    .formatToParts(sign * count, unit)
                    .map((part) =>
                        part.type === 'integer'
                            ? '(\\d+)'
                            : escapePattern(normalizeFragment(part.value, locale))
                    )
                    .join('');

                const source = `^${pattern.trim().replace(/ /g, '\\s?')}$`;
                if (!sources.has(source)) {
                    sources.add(source);
                    relativeTemplates.push({ regexp: new RegExp(source, 'u'), unit, sign });
                }
            }
        }
    }

    return { relativeWords, relativeTemplates };
}

function getTimeData(locale, sample, options) {
    // The literal between the hours and the minutes.
    const timeParts = getDateTimeFormat(locale, { ...options, timeStyle: 'short' }).formatToParts(
        sample
    );
    const hourIndex = timeParts.findIndex((x) => x.type === 'hour');
    const separator = timeParts[hourIndex + 1]?.value.trim();

    const timeSeparators = [':'];
    if (separator && separator.length === 1 && separator !== ':') {
        timeSeparators.push(separator);
    }

    // The words between a date and a time, like "at" in English.
    const connectors = ['at'];
    const dateTimeParts = getDateTimeFormat(locale, {
        ...options,
        dateStyle: 'long',
        timeStyle: 'short',
    }).formatToParts(sample);

    for (const part of dateTimeParts) {
        const word = normalizeName(part.value, locale);
        if (
            part.type === 'literal' &&
            /^[\p{L}\p{M}]+$/u.test(word) &&
            !connectors.includes(word)
        ) {
            connectors.push(word);
        }
    }

    return { timeSeparators, connectors };
}

/**
 * Finds the index of a name in lists of names, also by an unambiguous prefix.
 *
 * @param {string} word A normalized word.
 * @param {string[][]} names Per index, the normalized names.
 * @param {number} prefixLength The shortest prefix that is understood.
 * @returns {number} The index, or -1.
 */
function matchName(word, names, prefixLength) {
    const exact = names.findIndex((list) => list.includes(word));
    if (exact >= 0 || word.length < prefixLength) {
        return exact;
    }

    const matches = new Set();
    names.forEach((list, index) => {
        if (list.some((name) => name.startsWith(word))) {
            matches.add(index);
        }
    });

    return matches.size === 1 ? [...matches][0] : -1;
}

function tokenize(text) {
    const tokens = [];

    for (const match of text.matchAll(TOKEN_REGEXP)) {
        const [value, number, shortYear, word, separator, space] = match;

        if (number !== undefined) {
            tokens.push({ type: 'number', value: Number(number), digits: number.length });
        } else if (shortYear !== undefined) {
            tokens.push({ type: 'short-year', value: Number(shortYear.slice(1)) });
        } else if (word !== undefined) {
            tokens.push({ type: 'word', text: word.replace(WORD_PUNCTUATION_REGEXP, '') });
        } else if (separator !== undefined) {
            tokens.push({ type: 'separator', text: separator });
        } else if (space !== undefined) {
            tokens.push({ type: 'space' });
        } else {
            tokens.push({ type: 'other', text: value });
        }
    }

    return tokens;
}

/**
 * The words a locale uses for the morning and the afternoon (`Intl`'s flexible day periods at 10:00
 * and 15:00), or `null` when it has none. Cached per locale.
 *
 * @type {Map<string, [string | null, string | null]>}
 */
const FLEXIBLE_DAY_PERIODS = new Map();

function getFlexibleDayPeriods(locale) {
    let periods = FLEXIBLE_DAY_PERIODS.get(locale);
    if (!periods) {
        const format = new Intl.DateTimeFormat(locale, {
            hour: 'numeric',
            dayPeriod: 'short',
            timeZone: 'UTC',
        });

        periods = [10, 15].map(
            (hour) =>
                format.formatToParts(Date.UTC(2021, 0, 1, hour)).find((x) => x.type === 'dayPeriod')
                    ?.value || null
        );

        FLEXIBLE_DAY_PERIODS.set(locale, periods);
    }

    return periods;
}

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
export class DateTimeParser extends LocaleAware {
    /**
     * The time zone dates are in: `timeZone`, or else the locale manager's.
     *
     * @type {string}
     */
    get effectiveTimeZone() {
        return this._timeZone || this._getDefaultTimeZone();
    }

    /**
     * Parses a date.
     *
     * @param {string} input
     * @returns {Date | null} The date at midnight (or the current time for `now`), or `null` if the
     *     text is not a valid date.
     * @throws {TypeError} If the input is not a string.
     */
    parseDate(input) {
        const text = this._prepareInput(input);
        if (this._isNow(text)) {
            return new Date(this._getNow());
        }

        const date = this._parseDateText(text);

        return date ? this._toDate(date, 0) : null;
    }

    /**
     * Parses a time of day.
     *
     * @param {string} input
     * @returns {number | null} The time as milliseconds since midnight, or `null` if the text is
     *     not a valid time.
     * @throws {TypeError} If the input is not a string.
     */
    parseTime(input) {
        const text = this._prepareInput(input);
        if (this._isNow(text)) {
            const fields = getZonedFields(this._getNow(), this.effectiveTimeZone);

            return (
                ((fields.hours * 60 + fields.minutes) * 60 + fields.seconds) * 1000 +
                fields.milliseconds
            );
        }

        return this._parseTimeText(text, true);
    }

    /**
     * Parses a date and a time, in either order (`10 aug 2013 14:05` or `2 pm tomorrow`), or only
     * one of them: a date alone is at midnight, and a time alone is today. ISO 8601 date-times
     * (`2013-08-10T14:05:09Z`) are understood too, including their time zone.
     *
     * @param {string} input
     * @returns {Date | null}
     * @throws {TypeError} If the input is not a string.
     */
    parseDateTime(input) {
        const text = this._prepareInput(input);
        if (this._isNow(text)) {
            return new Date(this._getNow());
        }

        const iso = this._parseIso(text);
        if (iso !== undefined) {
            return iso;
        }

        const data = getLocaleData(this.effectiveLocale);
        const words = text.split(' ');

        // Try every split into a date and a time part, with the time at the end or the start.
        for (let count = 1; count <= Math.min(words.length, 3); count++) {
            for (const timeAtEnd of [true, false]) {
                const timeWords = timeAtEnd ? words.slice(-count) : words.slice(0, count);
                const dateWords = timeAtEnd ? words.slice(0, -count) : words.slice(count);

                const time = this._parseTimeText(timeWords.join(' '), false);
                if (time === null) {
                    continue;
                }

                // Remove a connecting word, like "at".
                const connectorIndex = timeAtEnd ? dateWords.length - 1 : 0;
                if (data.connectors.includes(dateWords[connectorIndex]?.replace(/\./g, ''))) {
                    dateWords.splice(connectorIndex, 1);
                }

                const date = dateWords.length
                    ? this._parseDateText(dateWords.join(' '))
                    : this._getToday();

                if (date) {
                    return this._toDate(date, time);
                }
            }
        }

        const date = this._parseDateText(text);

        return date ? this._toDate(date, 0) : null;
    }

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
    parseExact(input, format) {
        if (typeof format !== 'string') {
            throw new TypeError('The format must be a string.');
        }

        const text = this._prepareInput(input);

        if (format === '%c') {
            return this.parseDate(input);
        }

        if (format === '%x') {
            return this.parseDateTime(input);
        }

        if (format === '%X') {
            const time = this.parseTime(input);

            return time === null ? null : this._toDate(this._getToday(), time);
        }

        const { regexp, fields } = this._compileFormat(format);
        const matches = regexp.exec(text);
        if (!matches) {
            return null;
        }

        return this._buildExact(fields, matches.slice(1));
    }

    _prepareInput(input) {
        if (typeof input !== 'string') {
            throw new TypeError('The input must be a string.');
        }

        return normalizeText(input, this.effectiveLocale);
    }

    _isNow(text) {
        return text === 'now' || this._getRelativeWord(text)?.unit === 'now';
    }

    _getNow() {
        return this._referenceTime ?? Date.now();
    }

    _getToday() {
        const { year, month, day, weekDay } = getZonedFields(
            this._getNow(),
            this.effectiveTimeZone
        );

        return { year, month, day, weekDay };
    }

    _toDate({ year, month, day }, time) {
        const timestamp = fromZonedFields({ year, month, day }, this.effectiveTimeZone);

        // Add the time as wall-clock time, so it is right on days with a daylight saving change.
        if (!time) {
            return new Date(timestamp);
        }

        const minutes = Math.floor(time / MINUTE);

        return new Date(
            fromZonedFields(
                {
                    year,
                    month,
                    day,
                    hours: Math.floor(minutes / 60),
                    minutes: minutes % 60,
                    seconds: Math.floor((time % MINUTE) / 1000),
                    milliseconds: time % 1000,
                },
                this.effectiveTimeZone
            )
        );
    }

    _getRelativeWord(text) {
        return getLocaleData(this.effectiveLocale).relativeWords.get(text) || null;
    }

    _parseIso(text) {
        const matches = ISO_REGEXP.exec(text);
        if (!matches) {
            return undefined;
        }

        const [, year, month, day, hours, minutes, seconds, fraction, zone] = matches;

        const fields = {
            year: Number(year),
            month: Number(month) - 1,
            day: Number(day),
            hours: Number(hours || 0),
            minutes: Number(minutes || 0),
            seconds: Number(seconds || 0),
            milliseconds: fraction ? Math.floor(Number(`0.${fraction}`) * 1000) : 0,
        };

        if (
            !this._isValidDate(fields) ||
            fields.hours > 23 ||
            fields.minutes > 59 ||
            fields.seconds > 59
        ) {
            return null;
        }

        if (!zone) {
            return new Date(fromZonedFields(fields, this.effectiveTimeZone));
        }

        const wallClock = utcTimestamp(
            fields.year,
            fields.month,
            fields.day,
            fields.hours,
            fields.minutes,
            fields.seconds,
            fields.milliseconds
        );

        return new Date(wallClock - this._parseOffset(zone) * MINUTE);
    }

    _parseOffset(zone) {
        if (zone === 'z' || zone === 'utc' || zone === 'gmt') {
            return 0;
        }

        const matches = /^([+-])(\d{2}):?(\d{2})?$/.exec(zone);
        if (!matches) {
            return null;
        }

        const offset = Number(matches[2]) * 60 + Number(matches[3] || 0);

        return matches[1] === '-' ? -offset : offset;
    }

    _isValidDate({ year, month, day }) {
        return (
            Number.isInteger(year) &&
            year >= 1 &&
            year <= 9999 &&
            month >= 0 &&
            month <= 11 &&
            day >= 1 &&
            day <= getDaysInMonth(year, month)
        );
    }

    /**
     * Parses a normalized date text to its fields.
     *
     * @param {string} text
     * @returns {{year: number, month: number, day: number} | null}
     */
    _parseDateText(text) {
        if (!text) {
            return null;
        }

        const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
        if (iso) {
            const date = { year: Number(iso[1]), month: Number(iso[2]) - 1, day: Number(iso[3]) };

            return this._isValidDate(date) ? date : null;
        }

        const relative = this._parseRelativeDate(text);
        if (relative !== undefined) {
            return relative;
        }

        return this._parseAbsoluteDate(tokenize(this._joinNames(text)));
    }

    /**
     * Removes the spaces from the month and day names of more than one word in a text, such as
     * `יום שבת` (Hebrew) and `thu bay` (Vietnamese), so they are single words like their names in
     * {@link DateTimeParser#_getMonthNames} and {@link DateTimeParser#_getDayNames}.
     *
     * @param {string} text A normalized text.
     * @returns {string}
     */
    _joinNames(text) {
        const manager = this.effectiveLocaleManager;
        const names = [
            ...manager.longMonthNames,
            ...manager.shortMonthNames,
            ...manager.longDayNames,
            ...manager.shortDayNames,
            ...getLocaleData(manager.locale).monthNames.flat(),
        ]
            .map((x) => normalizeText(x, manager.locale))
            .filter((x) => x.includes(' '))
            .sort((a, b) => b.length - a.length);

        for (const name of names) {
            const pattern = escapePattern(name).replace(/ /g, '\\s');
            text = text.replace(
                new RegExp(`(?<!\\p{L})${pattern}(?!\\p{L})`, 'gu'),
                name.replace(/ /g, '')
            );
        }

        return text;
    }

    /**
     * Parses a relative date.
     *
     * @param {string} text
     * @returns {{year: number, month: number, day: number} | null | undefined} `undefined` if
     *     the text is not a relative date.
     */
    _parseRelativeDate(text) {
        const today = this._getToday();
        const data = getLocaleData(this.effectiveLocale);

        for (const [regexp, offset] of ENGLISH_RELATIVE_DAYS) {
            if (regexp.test(text)) {
                return this._addDays(today, offset);
            }
        }

        const word = this._getRelativeWord(text);
        if (word) {
            return this._moveToUnit(today, word.unit, word.offset);
        }

        for (const [regexp, sign] of ENGLISH_COUNTED) {
            const matches = regexp.exec(text);
            if (matches) {
                return this._addUnits(today, matches[2], sign * Number(matches[1]));
            }
        }

        for (const { regexp, unit, sign } of data.relativeTemplates) {
            const matches = regexp.exec(text);
            if (matches) {
                return this._addUnits(today, unit, sign * Number(matches[1]));
            }
        }

        for (const [regexp, direction] of ENGLISH_DIRECTIONS) {
            const matches = regexp.exec(text);
            if (!matches) {
                continue;
            }

            const rest = matches[matches.length - 1];
            if (UNITS.includes(rest)) {
                return this._moveToUnit(today, rest, direction);
            }

            const named = this._parseNamedRelative(rest, today, direction);

            return named === undefined ? null : named;
        }

        return this._parseNamedRelative(text, today, 1);
    }

    /**
     * Parses a day or month name relative to today: the next one (`direction` 1 or 0) or the
     * last one (-1).
     */
    _parseNamedRelative(text, today, direction) {
        if (!/^\p{L}+\.?$/u.test(text)) {
            return undefined;
        }

        const word = text.replace(/\./g, '');
        const past = direction < 0;

        const weekDay = matchName(word, this._getDayNames(), DAY_PREFIX_LENGTH);
        if (weekDay >= 0) {
            let offset = weekDay - today.weekDay;
            if (past ? offset >= 0 : offset <= 0) {
                offset += past ? -7 : 7;
            }

            return this._addDays(today, offset);
        }

        const month = matchName(word, this._getMonthNames(), MONTH_PREFIX_LENGTH);
        if (month >= 0) {
            let year = today.year;
            if (past ? month >= today.month : month <= today.month) {
                year += past ? -1 : 1;
            }

            return { year, month, day: 1 };
        }

        return undefined;
    }

    _addDays({ year, month, day }, days) {
        const date = new Date(utcTimestamp(year, month, day + days));

        return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
    }

    _addUnits(date, unit, count) {
        if (unit === 'day') {
            return this._addDays(date, count);
        }

        if (unit === 'week') {
            return this._addDays(date, 7 * count);
        }

        // Move by months or years, keeping the day within the month.
        const months = date.year * 12 + date.month + (unit === 'year' ? 12 * count : count);
        const year = Math.floor(months / 12);
        const month = months - year * 12;

        return { year, month, day: Math.min(date.day, getDaysInMonth(year, month)) };
    }

    /**
     * Moves to the first day of the day, week, month or year some units from today, e.g. the
     * first day of the last month for `('month', -1)`.
     */
    _moveToUnit(today, unit, offset) {
        if (unit === 'now') {
            return today;
        }

        if (unit === 'day') {
            return this._addDays(today, offset);
        }

        if (unit === 'week') {
            const firstDay = this.effectiveLocaleManager.firstDayOfWeek;
            const start = -((today.weekDay - firstDay + 7) % 7);

            return this._addDays(today, start + 7 * offset);
        }

        if (unit === 'month') {
            return this._addUnits({ ...today, day: 1 }, 'month', offset);
        }

        return { year: today.year + offset, month: 0, day: 1 };
    }

    _getMonthNames() {
        const manager = this.effectiveLocaleManager;
        const locale = manager.locale;
        const data = getLocaleData(locale);

        return ENGLISH_MONTH_NAMES.map((name, i) =>
            [
                normalizeName(manager.longMonthNames[i], locale),
                normalizeName(manager.shortMonthNames[i], locale),
                ...data.monthNames[i],
                name,
                name.slice(0, 3),
            ].map((x) => x.replace(/ /g, ''))
        );
    }

    _getDayNames() {
        const manager = this.effectiveLocaleManager;
        const locale = manager.locale;

        return ENGLISH_DAY_NAMES.map((name, i) =>
            [
                normalizeName(manager.longDayNames[i], locale),
                normalizeName(manager.shortDayNames[i], locale),
                name,
            ].map((x) => x.replace(/ /g, ''))
        );
    }

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
    _splitWord(word, fillers, monthNames, dayNames) {
        const isKnown = (x) =>
            Object.hasOwn(MARKERS, x) ||
            matchName(x, monthNames, MONTH_PREFIX_LENGTH) >= 0 ||
            matchName(x, dayNames, DAY_PREFIX_LENGTH) >= 0;

        for (const affix of [...Object.keys(MARKERS), ...FILLER_WORDS, ...fillers]) {
            if (affix.length >= word.length) {
                continue;
            }

            if (word.startsWith(affix) && isKnown(word.slice(affix.length))) {
                return [affix, word.slice(affix.length)];
            }

            if (word.endsWith(affix) && isKnown(word.slice(0, -affix.length))) {
                return [word.slice(0, -affix.length), affix];
            }
        }

        return null;
    }

    _expandYear(value, digits) {
        if (digits > 2) {
            return value;
        }

        return value > this._twoDigitYearMax ? 1900 + value : 2000 + value;
    }

    /**
     * Parses the tokens of an absolute date.
     *
     * @param {object[]} tokens
     * @returns {{year: number, month: number, day: number} | null}
     */
    _parseAbsoluteDate(tokens) {
        // The loop splits words, so it works on its own copy.
        tokens = [...tokens];

        const date = { year: null, month: null, day: null };
        let weekDay = null;

        const numbers = [];
        const components = [];
        const monthNames = this._getMonthNames();
        const dayNames = this._getDayNames();
        const { fillers } = getLocaleData(this.effectiveLocale);

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const previous = tokens[i - 1];

            if (token.type === 'space' || token.type === 'separator') {
                continue;
            }

            if (token.type === 'other') {
                return null;
            }

            if (token.type === 'number') {
                if (token.digits > 4) {
                    return null;
                }

                const number = { ...token, role: null };
                numbers.push(number);
                components.push(number);
                continue;
            }

            if (token.type === 'short-year') {
                if (date.year !== null) {
                    return null;
                }

                date.year = this._expandYear(token.value, 2);
                components.push({ role: 'y', digits: 2 });
                continue;
            }

            const word = token.text;
            const previousNumber = previous?.type === 'number' ? numbers[numbers.length - 1] : null;

            if (previousNumber && !previousNumber.role && ORDINAL_SUFFIXES.has(word)) {
                previousNumber.role = 'd';
                continue;
            }

            const marker = MARKERS[word];
            if (marker) {
                // The marker may follow the number with a space, as in Korean and Russian.
                const number =
                    previousNumber ||
                    (previous?.type === 'space' && tokens[i - 2]?.type === 'number'
                        ? numbers[numbers.length - 1]
                        : null);

                if (!number || number.role) {
                    return null;
                }

                number.role = marker;
                continue;
            }

            if (FILLER_WORDS.has(word)) {
                continue;
            }

            const month = matchName(word, monthNames, MONTH_PREFIX_LENGTH);
            if (month >= 0) {
                if (date.month !== null) {
                    return null;
                }

                date.month = month;
                components.push({ role: 'm' });
                continue;
            }

            const day = matchName(word, dayNames, DAY_PREFIX_LENGTH);
            if (day >= 0 && weekDay === null) {
                weekDay = day;
                continue;
            }

            if (fillers.has(word)) {
                continue;
            }

            // Split a name with a word attached to it, and read both parts.
            const split = this._splitWord(word, fillers, monthNames, dayNames);
            if (split) {
                tokens = [
                    ...tokens.slice(0, i),
                    ...split.map((text) => ({ type: 'word', text })),
                    ...tokens.slice(i + 1),
                ];
                i -= 1;
                continue;
            }

            return null;
        }

        if (!this._assignNumbers(date, numbers, components)) {
            return null;
        }

        const today = this._getToday();

        if (date.day === null && date.month === null) {
            // A year alone is its first day; nothing at all is no date.
            if (date.year === null) {
                return null;
            }

            date.month = 0;
            date.day = 1;
        } else if (date.day === null) {
            // A month alone is handled as a relative date, so this is a month and year.
            if (date.year === null) {
                return null;
            }

            date.day = 1;
        }

        if (date.month === null) {
            date.month = today.month;
        }

        if (date.year === null) {
            date.year = today.year;
        }

        if (!this._isValidDate(date)) {
            return null;
        }

        if (
            weekDay !== null &&
            new Date(utcTimestamp(date.year, date.month, date.day)).getUTCDay() !== weekDay
        ) {
            return null;
        }

        return date;
    }

    _assignNumbers(date, numbers, components) {
        const assign = (role, number) => {
            const key = { y: 'year', m: 'month', d: 'day' }[role];
            if (date[key] !== null) {
                return false;
            }

            if (role === 'y') {
                date.year = this._expandYear(number.value, number.digits);
            } else {
                date[key] = role === 'm' ? number.value - 1 : number.value;
            }

            return true;
        };

        for (const number of numbers) {
            if (number.role && !assign(number.role, number)) {
                return false;
            }
        }

        // Numbers that cannot be a day or month are the year.
        let unassigned = numbers.filter((x) => !x.role);
        for (const number of unassigned) {
            if (number.digits > 2 || number.value > 31) {
                number.role = 'y';
                if (!assign('y', number)) {
                    return false;
                }
            }
        }

        unassigned = unassigned.filter((x) => !x.role);
        if (!unassigned.length) {
            return true;
        }

        // A leading long year means year, month, day, like ISO dates; otherwise use the locale.
        const first = components[0];
        let order = getLocaleData(this.effectiveLocale).dateOrder;
        if (first?.role === 'y' && first.digits > 2) {
            order = 'ymd';
        }

        let missing = [...order].filter((role) => {
            return date[{ y: 'year', m: 'month', d: 'day' }[role]] === null;
        });

        if (unassigned.length < missing.length && missing.includes('y')) {
            missing = missing.filter((role) => role !== 'y');
        }

        if (unassigned.length === 1 && date.day === null && missing.length > 1) {
            missing = ['d'];
        }

        if (unassigned.length !== missing.length) {
            return false;
        }

        return unassigned.every((number, i) => assign(missing[i], number));
    }

    _getDesignatorRegExp() {
        const manager = this.effectiveLocaleManager;
        const locale = manager.locale;

        // Periods are optional, as in `ip.` (Finnish) and `μ.μ.` (Greek).
        const toPattern = (designator) =>
            escapePattern(normalizeText(designator, locale))
                .replace(/\\\./g, '\\.?')
                .replace(/ /g, '\\s?');

        // Also accept the words for morning and afternoon, which some locales use as day periods
        // in other versions of the locale data (for example 오전 and 오후 in Korean).
        const [morning, afternoon] = getFlexibleDayPeriods(locale);
        const alternatives = (designator, word) =>
            word && word !== designator ? `|${toPattern(word)}` : '';

        return {
            am: `(?:${toPattern(manager.amDesignator)}${alternatives(manager.amDesignator, morning)}|a\\.?\\s?m\\.?)`,
            pm: `(?:${toPattern(manager.pmDesignator)}${alternatives(manager.pmDesignator, afternoon)}|p\\.?\\s?m\\.?)`,
        };
    }

    /**
     * Parses a normalized time text.
     *
     * @param {string} text
     * @param {boolean} alone Whether the text is only a time, which allows more separators.
     * @returns {number | null} Milliseconds since midnight.
     */
    _parseTimeText(text, alone) {
        if (Object.hasOwn(ENGLISH_TIMES, text)) {
            return ENGLISH_TIMES[text] * MINUTE;
        }

        const data = getLocaleData(this.effectiveLocale);
        const separators = alone ? [':', '.', ...data.timeSeparators] : data.timeSeparators;
        const separator = `(?:${separators.map(escapePattern).join('|')})`;
        const { am, pm } = this._getDesignatorRegExp();
        const designator = `(${am}|${pm})`;

        const clock =
            `(\\d{1,2})(?:(?:${separator}|\\s?h\\s?)(\\d{2})(?:${separator}(\\d{2})(?:[.,](\\d{1,3}))?)?)?` +
            '(h)?';
        const regexp = new RegExp(`^(?:${designator}\\s?)?${clock}(?:\\s?${designator})?$`, 'u');

        const matches = regexp.exec(text);
        if (!matches) {
            return null;
        }

        const [, before, hoursText, minutesText, secondsText, fraction, hourMark, after] = matches;
        if ((before && after) || (hourMark && minutesText !== undefined)) {
            return null;
        }

        const period = before || after;

        // A bare number is not a time, but "3 pm" and "14h" are.
        if (minutesText === undefined && !period && !hourMark) {
            return null;
        }

        let hours = Number(hoursText);
        const minutes = Number(minutesText || 0);
        const seconds = Number(secondsText || 0);
        const milliseconds = fraction ? Number(fraction.padEnd(3, '0')) : 0;

        if (minutes > 59 || seconds > 59) {
            return null;
        }

        if (period) {
            if (hours < 1 || hours > 12) {
                return null;
            }

            const isPm = new RegExp(`^${pm}$`, 'u').test(period);
            hours = (hours % 12) + (isPm ? 12 : 0);
        } else if (hours > 23) {
            return null;
        }

        return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
    }

    _compileFormat(format) {
        const fields = [];
        let source = '';

        const expanded = format.replace(/%([-_0^]*)([rRTDF])/g, (_match, _flags, character) => {
            return {
                r: '%I:%M:%S %p',
                R: '%H:%M',
                T: '%H:%M:%S',
                D: '%m/%d/%y',
                F: '%Y-%m-%d',
            }[character];
        });

        const { am, pm } = this._getDesignatorRegExp();
        const word = "([\\p{L}\\p{M}][\\p{L}\\p{M}.'’\\-\\u05f3\\u0970]*)";
        const patterns = {
            a: word,
            A: word,
            b: word,
            B: word,
            h: word,
            d: '(\\d{1,2})',
            e: '(\\d{1,2})',
            j: '(\\d{1,3})',
            u: '(\\d)',
            w: '(\\d)',
            U: '(\\d{1,2})',
            V: '(\\d{1,2})',
            W: '(\\d{1,2})',
            m: '(\\d{1,2})',
            C: '(\\d{1,2})',
            g: '(\\d{2})',
            G: '(\\d{4})',
            y: '(\\d{2})',
            Y: '(\\d{4})',
            H: '(\\d{1,2})',
            k: '(\\d{1,2})',
            I: '(\\d{1,2})',
            l: '(\\d{1,2})',
            M: '(\\d{2})',
            S: '(\\d{2})',
            L: '(\\d{3})',
            p: `(${am}|${pm})`,
            P: `(${am}|${pm})`,
            z: '(z|[+-]\\d{2}:?\\d{2})',
            Z: '([\\p{L}\\d+\\-:/_]+)',
            s: '(-?\\d+)',
        };

        let position = 0;
        for (const match of expanded.matchAll(/%[-_0^]*([a-zA-Z%])/g)) {
            source += this._literalPattern(expanded.slice(position, match.index));
            position = match.index + match[0].length;

            const character = match[1];
            if (character === '%') {
                source += '%';
            } else if (character === 'n' || character === 't') {
                source += '\\s*';
            } else if (patterns[character]) {
                source += (/[eklIH]/.test(character) ? '\\s?' : '') + patterns[character];
                fields.push(character);
            } else if ('cxX'.includes(character)) {
                throw new Error(`'%${character}' can only be used alone in a format to parse.`);
            } else {
                source += escapePattern('%' + match[1]);
            }
        }

        source += this._literalPattern(expanded.slice(position));

        return { regexp: new RegExp(`^${source}$`, 'u'), fields };
    }

    _literalPattern(text) {
        // Whitespace and commas were collapsed in the input, so they match any whitespace.
        return normalizeFragment(text, this.effectiveLocale)
            .split(' ')
            .map((x) => escapePattern(x))
            .join('\\s*');
    }

    _buildExact(specifiers, values) {
        const fields = { year: null, month: null, day: null };
        let hours = 0;
        let minutes = 0;
        let seconds = 0;
        let milliseconds = 0;
        let period = null;
        let hour12 = false;
        let weekDay = null;
        let offset = null;
        let dayOfYear = null;

        const { pm } = this._getDesignatorRegExp();

        for (let i = 0; i < specifiers.length; i++) {
            const character = specifiers[i];
            const value = values[i];
            const number = Number(value);

            switch (character) {
                case 'a':
                case 'A': {
                    weekDay = matchName(
                        value.replace(WORD_PUNCTUATION_REGEXP, ''),
                        this._getDayNames(),
                        2
                    );
                    if (weekDay < 0) {
                        return null;
                    }
                    break;
                }

                case 'b':
                case 'B':
                case 'h': {
                    const month = matchName(
                        value.replace(WORD_PUNCTUATION_REGEXP, ''),
                        this._getMonthNames(),
                        3
                    );
                    if (month < 0) {
                        return null;
                    }

                    fields.month = month;
                    break;
                }

                case 'd':
                case 'e':
                    fields.day = number;
                    break;

                case 'j':
                    dayOfYear = number;
                    break;

                case 'u':
                    weekDay = number % 7;
                    break;

                case 'w':
                    weekDay = number;
                    break;

                case 'm':
                    fields.month = number - 1;
                    break;

                case 'y':
                    fields.year = this._expandYear(number, 2);
                    break;

                case 'Y':
                    fields.year = number;
                    break;

                case 'H':
                case 'k':
                    hours = number;
                    break;

                case 'I':
                case 'l':
                    hours = number;
                    hour12 = true;
                    break;

                case 'M':
                    minutes = number;
                    break;

                case 'S':
                    seconds = number;
                    break;

                case 'L':
                    milliseconds = number;
                    break;

                case 'p':
                case 'P':
                    period = new RegExp(`^${pm}$`, 'u').test(value) ? 'pm' : 'am';
                    break;

                case 'z':
                    offset = this._parseOffset(value);
                    break;

                case 'Z':
                    if (value === 'utc' || value === 'gmt' || value === 'z') {
                        offset = 0;
                    }
                    break;

                case 's':
                    return new Date(number * 1000);

                // The week-based fields are checked by the other fields.
                default:
                    break;
            }
        }

        if (period !== null || hour12) {
            if (hours < 1 || hours > 12) {
                return null;
            }

            hours = (hours % 12) + (period === 'pm' ? 12 : 0);
        }

        if (hours > 23 || minutes > 59 || seconds > 59) {
            return null;
        }

        // Fill in missing date fields.
        const today = this._getToday();
        if (
            fields.year === null &&
            fields.month === null &&
            fields.day === null &&
            dayOfYear === null
        ) {
            Object.assign(fields, { year: today.year, month: today.month, day: today.day });
        }

        fields.year ??= today.year;

        if (dayOfYear !== null && fields.month === null && fields.day === null) {
            const date = new Date(utcTimestamp(fields.year, 0, dayOfYear));
            if (date.getUTCFullYear() !== fields.year || dayOfYear < 1) {
                return null;
            }

            fields.month = date.getUTCMonth();
            fields.day = date.getUTCDate();
        }

        fields.month ??= 0;
        fields.day ??= 1;

        if (!this._isValidDate(fields)) {
            return null;
        }

        if (
            weekDay !== null &&
            new Date(utcTimestamp(fields.year, fields.month, fields.day)).getUTCDay() !== weekDay
        ) {
            return null;
        }

        const all = { ...fields, hours, minutes, seconds, milliseconds };
        if (offset !== null) {
            const wallClock = utcTimestamp(
                all.year,
                all.month,
                all.day,
                hours,
                minutes,
                seconds,
                milliseconds
            );

            return new Date(wallClock - offset * MINUTE);
        }

        return new Date(fromZonedFields(all, this.effectiveTimeZone));
    }
}

defineProperties(DateTimeParser, {
    /**
     * The time zone dates are parsed in (an IANA name, `'UTC'` or `'local'`), or `null` (the
     * default) for the time zone of the locale manager.
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
     * The largest two-digit year that is in this century: with 29, `'29` is 2029 and `'30` is
     * 1930.
     */
    twoDigitYearMax: {
        value: 29,
        coerce(year) {
            if (!Number.isInteger(year) || year < 0 || year > 99) {
                throw new RangeError('The two-digit year maximum must be an integer from 0 to 99.');
            }

            return year;
        },
    },

    /**
     * The time relative dates (`today`, `next week`) are relative to, as a timestamp, or `null`
     * (the default) for the current time.
     */
    referenceTime: {
        value: null,
        coerce(time) {
            if (time instanceof Date) {
                time = time.getTime();
            }

            if (time !== null && !Number.isFinite(time)) {
                throw new TypeError('The reference time must be a timestamp, a Date or null.');
            }

            return time;
        },
    },
});

/**
 * Returns the date-time parser singleton, which follows the locale manager.
 *
 * @type {() => DateTimeParser}
 */
export const getDateTimeParser = lazySingleton(() => new DateTimeParser());

/**
 * Parses a date with the singleton.
 *
 * @param {string} input
 * @returns {Date | null}
 */
export function parseDate(input) {
    return getDateTimeParser().parseDate(input);
}

/**
 * Parses a date and time with the singleton.
 *
 * @param {string} input
 * @returns {Date | null}
 */
export function parseDateTime(input) {
    return getDateTimeParser().parseDateTime(input);
}

/**
 * Parses a time of day with the singleton.
 *
 * @param {string} input
 * @returns {number | null} Milliseconds since midnight.
 */
export function parseTime(input) {
    return getDateTimeParser().parseTime(input);
}
