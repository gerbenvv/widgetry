/**
 * @module widgets/date-edit
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement, uniqueId } from '../core/util.js';
import { Key } from '../events/constants.js';
import { getLocaleManager } from '../i18n/locale-manager.js';
import { Calendar, compareDays, getDaysInMonth, makeDate, startOfDay } from './calendar.js';
import { LineEdit } from './line-edit.js';
import { Popover, PopoverCloseReason } from './popover.js';

/**
 * The default format of a date edit: the locale's medium date style, e.g. "Sep 27, 2026".
 *
 * @type {Intl.DateTimeFormatOptions}
 */
export const DEFAULT_DATE_FORMAT = Object.freeze({ dateStyle: 'medium' });

/**
 * Returns the order of the day, month and year fields in a locale's numeric dates, e.g.
 * `['month', 'day', 'year']` for `en-US`.
 *
 * @param {string} locale
 * @returns {string[]}
 */
export function getDateFieldOrder(locale) {
    const format = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'UTC',
    });

    return format
        .formatToParts(Date.UTC(2006, 10, 22))
        .map((x) => x.type)
        .filter((x) => x === 'day' || x === 'month' || x === 'year');
}

function toFullYear(year, digits, referenceYear) {
    if (digits > 2) {
        return year;
    }

    // Two-digit years are taken within 50 years of the reference year.
    let result = Math.floor(referenceYear / 100) * 100 + year;
    if (result > referenceYear + 50) {
        result -= 100;
    } else if (result <= referenceYear - 50) {
        result += 100;
    }

    return result;
}

function findMonth(word, locale) {
    const manager = getLocaleManager();
    const normalize = (text) =>
        text
            .toLocaleLowerCase(locale)
            .normalize('NFD')
            .replace(/[\u0300-\u036f.]/g, '');

    const target = normalize(word);
    if (!target) {
        return -1;
    }

    const names = [manager.longMonthNames, manager.shortMonthNames];
    if (locale !== manager.locale) {
        const format = (month) =>
            Array.from({ length: 12 }, (_x, i) =>
                new Intl.DateTimeFormat(locale, { month, timeZone: 'UTC' }).format(
                    Date.UTC(2021, i, 1)
                )
            );

        names.splice(0, 2, format('long'), format('short'));
    }

    for (const list of names) {
        const index = list.findIndex((x) => normalize(x) === target);
        if (index >= 0) {
            return index;
        }
    }

    // Accept unambiguous prefixes of at least three letters, e.g. "sept" or "janu".
    if (target.length >= 3) {
        const matches = names[0]
            .map((x, i) => (normalize(x).startsWith(target) ? i : -1))
            .filter((x) => x >= 0);

        if (matches.length === 1) {
            return matches[0];
        }
    }

    return -1;
}

/**
 * Parses a date typed in a locale: numeric dates in the locale's field order (e.g. 9/27/2026 in
 * `en-US`, 27-9-2026 in `nl-NL`), ISO dates (2026-09-27), and dates with a month name (Sep 27,
 * 2026 or 27 september 2026). A missing year is the reference year, and two-digit years are taken
 * within 50 years of it.
 *
 * @param {string} text
 * @param {string} [locale] Defaults to the current locale.
 * @param {Date} [reference] The date that gives the default year. Defaults to today.
 * @returns {Date | null} The date at local midnight, or `null` if the text is not a valid date.
 */
export function parseLocaleDate(text, locale, reference) {
    locale = locale || getLocaleManager().locale;
    const referenceYear = (reference || new Date()).getFullYear();

    const trimmed = String(text).trim();
    if (!trimmed) {
        return null;
    }

    const tokens = trimmed.match(/\p{L}+|\d+/gu) || [];
    const numbers = [];
    let month = -1;

    for (const token of tokens) {
        if (/^\d+$/.test(token)) {
            numbers.push({ value: Number(token), digits: token.length });
        } else if (month < 0) {
            month = findMonth(token, locale);
        }
    }

    let fields;
    const order = getDateFieldOrder(locale);

    if (month >= 0) {
        const rest = order.filter((x) => x !== 'month');
        if (numbers.length < 1 || numbers.length > 2) {
            return null;
        }

        fields = { month: month + 1 };

        // Assign the numbers in the locale's order; a four-digit number is always the year.
        const yearIndex = numbers.findIndex((x) => x.digits >= 3);
        if (numbers.length === 2 && yearIndex >= 0) {
            fields.year = numbers[yearIndex];
            fields.day = numbers[1 - yearIndex];
        } else if (numbers.length === 2) {
            rest.forEach((name, i) => (fields[name] = numbers[i]));
        } else {
            fields.day = numbers[0];
        }
    } else if (numbers.length === 3) {
        // A leading four-digit number means year, month, day, as in ISO dates.
        const names = numbers[0].digits >= 3 ? ['year', 'month', 'day'] : order;
        fields = {};
        names.forEach((name, i) => (fields[name] = numbers[i]));
    } else if (numbers.length === 2) {
        const names = order.filter((x) => x !== 'year');
        fields = {};
        names.forEach((name, i) => (fields[name] = numbers[i]));
    } else {
        return null;
    }

    const day = typeof fields.day === 'object' ? fields.day.value : fields.day;
    const monthNumber = typeof fields.month === 'object' ? fields.month.value : fields.month;
    const year = fields.year
        ? toFullYear(fields.year.value, fields.year.digits, referenceYear)
        : referenceYear;

    if (!(monthNumber >= 1 && monthNumber <= 12)) {
        return null;
    }

    if (!(day >= 1 && day <= getDaysInMonth(year, monthNumber - 1))) {
        return null;
    }

    return makeDate(year, monthNumber - 1, day);
}

function checkDate(date) {
    if (date === null || date === undefined || date === '') {
        return null;
    }

    if (typeof date === 'string') {
        const match = /^(\d{4,})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
        const parsed = match
            ? makeDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
            : null;

        if (!parsed || parsed.getDate() !== Number(match[3])) {
            throw new TypeError(`Invalid ISO date '${date}'.`);
        }

        return parsed;
    }

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new TypeError('Expected a valid Date, an ISO date string or null.');
    }

    return startOfDay(date);
}

function sameDay(first, second) {
    if (!first || !second) {
        return first === second;
    }

    return compareDays(first, second) === 0;
}

/**
 * A line edit for dates, with a button that opens a calendar.
 *
 * The date is shown in the current locale with the `format` options of `Intl.DateTimeFormat`.
 * Typed dates are accepted in the locale's numeric order, as ISO dates (yyyy-mm-dd) and with month
 * names (see `parseLocaleDate`); the text is shown in the invalid state while it is not a date in
 * the range from `minDate` to `maxDate`. Once the date edit is activated or loses the focus, a
 * valid text is shown in the format again.
 *
 * Keyboard: Alt+Down or F4 opens the calendar. While it is open, the arrow keys, Home, End, Page
 * Up and Page Down move through the days, Enter chooses one and Escape closes the calendar. The
 * focus stays in the entry.
 *
 * Signals: `change` (the date changed), `activate`, and those of a line edit (`text-change` and so
 * on).
 */
export class DateEdit extends LineEdit {
    _initialize() {
        super._initialize();

        this._calendar = null;
        this._popover = null;
        this._formatter = null;
        this._updatingText = false;

        this._inputEl.setAttribute('aria-haspopup', 'grid');
        this._inputEl.setAttribute('aria-expanded', 'false');

        this._buttonEl.addEventListener('pointerdown', (event) => this._onButtonPointerDown(event));
        this._buttonEl.addEventListener('mousedown', (event) => event.preventDefault());
        this.el.addEventListener('focusout', (event) => this._onFocusOut(event));

        this._localeDisconnect = getLocaleManager().connect('locale-change', () => {
            this._formatter = null;
            this._updateText();
        });
    }

    _render() {
        const element = super._render();

        this._buttonEl = createElement(`
            <span class="wy-date-edit-button" role="button" aria-label="Choose date"></span>
        `);

        element.classList.add('wy-date-edit');
        element.append(this._buttonEl);

        return element;
    }

    /**
     * The calendar shown in the popup. It is created on first use.
     *
     * @type {Calendar}
     */
    get calendar() {
        if (!this._calendar) {
            this._calendar = new Calendar({ activateOnClick: true });
            this._calendar.connect('day-activate', () => this._onCalendarActivate());

            this._popover = new Popover({ owner: this, align: 'end' });
            this._popover.addStyleClass('wy-date-edit-popover');
            this._popover.child = this._calendar;
            this._popover.connect('close', () => this._onPopoverClose());

            this._calendar.focusElement.id = uniqueId('wy-date-edit-calendar');
        }

        return this._calendar;
    }

    /**
     * Sets several properties, applying the date range before the date so that the date is checked
     * against the new range.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties) {
        const { date, value, ...rest } = properties;

        let changed = super.set(rest);
        for (const [name, dateValue] of [
            ['date', date],
            ['value', value],
        ]) {
            if (dateValue !== undefined && this.setProperty(name, dateValue)) {
                changed = true;
            }
        }

        return changed;
    }

    /**
     * Opens the calendar.
     */
    openPopup() {
        this.popupOpen = true;
    }

    /**
     * Closes the calendar.
     */
    closePopup() {
        this.popupOpen = false;
    }

    /**
     * Opens the calendar if it is closed, and closes it otherwise.
     */
    togglePopup() {
        this.popupOpen = !this._popupOpen;
    }

    /**
     * Formats a date as the date edit shows it.
     *
     * @param {Date} date
     * @returns {string}
     */
    formatDate(date) {
        if (!this._formatter) {
            this._formatter = new Intl.DateTimeFormat(getLocaleManager().locale, this._format);
        }

        return this._formatter.format(date);
    }

    /**
     * Parses a typed date. Override to accept other notations.
     *
     * @param {string} text
     * @returns {Date | null}
     */
    parseDate(text) {
        return parseLocaleDate(text, getLocaleManager().locale, this._date || new Date());
    }

    activate() {
        this._normalizeText();

        super.activate();
    }

    destroy() {
        this._localeDisconnect();
        this._popover?.destroy();

        super.destroy();
    }

    _validate(text) {
        if (!super._validate(text)) {
            return false;
        }

        if (!text.trim()) {
            return true;
        }

        const date = this.parseDate(text);

        return Boolean(date) && this._isInRange(date);
    }

    _isInRange(date) {
        return (
            (!this._minDate || compareDays(date, this._minDate) >= 0) &&
            (!this._maxDate || compareDays(date, this._maxDate) <= 0)
        );
    }

    _onTextChange(text) {
        // The `change` signal of a date edit is about the date, not the text.
        if (this._updatingText) {
            return;
        }

        // A typed date that is valid becomes the date right away; an empty text clears it.
        if (!text.trim()) {
            this._setDate(null);
        } else if (this._isValid) {
            this._setDate(this.parseDate(text));
        }
    }

    _setDate(date) {
        if (sameDay(date, this._date)) {
            return;
        }

        this._date = date;

        if (this._calendar) {
            this._calendar.date = date;
        }

        this.emit('date-change', this);
        this.emit('value-change', this);
        this.emit('change', this);
    }

    _updateText() {
        this._updatingText = true;

        try {
            this.text = this._date ? this.formatDate(this._date) : '';
        } finally {
            this._updatingText = false;
        }
    }

    _normalizeText() {
        if (this._isValid) {
            this._updateText();
        }
    }

    _showPopup() {
        if (this._popupOpen || !this.isSensitive || !this.isVisible) {
            return;
        }

        const calendar = this.calendar;

        this._popupOpen = true;

        calendar.minDate = this._minDate;
        calendar.maxDate = this._maxDate;
        calendar.date = this._date;
        calendar.cursor = this._date || startOfDay(new Date());

        this.el.classList.add('wy-active');
        this._inputEl.setAttribute('aria-expanded', 'true');
        this._inputEl.setAttribute('aria-controls', calendar.focusElement.id);

        this._popover.popup(this.el);

        this.emit('popup-open-change', this);
    }

    _onPopoverClose() {
        if (!this._popupOpen) {
            return;
        }

        this._popupOpen = false;

        this.el.classList.remove('wy-active');
        this._inputEl.setAttribute('aria-expanded', 'false');
        this._inputEl.removeAttribute('aria-controls');
        this._inputEl.removeAttribute('aria-activedescendant');

        this.emit('popup-open-change', this);
    }

    _onCalendarActivate() {
        const date = this._calendar.date;

        this._setDate(date);
        this._updateText();
        this._popover.popdown();

        this.focus();
    }

    _onButtonPointerDown(event) {
        if (event.button !== 0 || !this.isSensitive) {
            return;
        }

        event.preventDefault();

        this.focus();
        this.togglePopup();
    }

    _onFocusOut(event) {
        if (this._popupOpen && !this.el.contains(event.relatedTarget)) {
            this._popover.popdown(PopoverCloseReason.BLUR);
        }
    }

    _onInputKeyDown(event) {
        if ((event.altKey && event.key === Key.DOWN) || event.key === Key.F4) {
            event.preventDefault();
            this.togglePopup();

            return;
        }

        if (this._popupOpen) {
            if (event.altKey && event.key === Key.UP) {
                event.preventDefault();
                this._popover.popdown();

                return;
            }

            // The calendar handles the navigation keys, while the entry keeps the focus.
            const calendar = this._calendar;
            if (event.key !== Key.SPACE && calendar.handleKey(event)) {
                event.preventDefault();

                const cursor = calendar.focusElement.getAttribute('aria-activedescendant');
                this._inputEl.setAttribute('aria-activedescendant', cursor || '');

                return;
            }
        }

        super._onInputKeyDown(event);
    }

    _onInputBlur() {
        super._onInputBlur();

        this._normalizeText();
    }
}

defineProperties(DateEdit, {
    /**
     * The date, or `null` if none (or no valid date) was entered. Set a `Date`, an ISO date string
     * (yyyy-mm-dd) or `null`. Dates are days: the time is ignored.
     */
    date: {
        value: null,
        signal: false,
        coerce: checkDate,
        set(date) {
            if (date && !this._isInRange(date)) {
                throw new RangeError('The date is outside the range of the date edit.');
            }

            this._setDate(date);
            this._updateText();

            return false;
        },
    },

    /**
     * The same as `date`.
     */
    value: {
        signal: false,
        get() {
            return this._date;
        },
        set(value) {
            this.date = value;

            return false;
        },
    },

    /**
     * The earliest date that can be entered, or `null`.
     */
    minDate: {
        value: null,
        coerce: checkDate,
        set(date) {
            if (sameDay(date, this._minDate)) {
                return false;
            }

            this._minDate = date;
            this._revalidate();

            if (this._calendar) {
                this._calendar.minDate = date;
            }
        },
    },

    /**
     * The latest date that can be entered, or `null`.
     */
    maxDate: {
        value: null,
        coerce: checkDate,
        set(date) {
            if (sameDay(date, this._maxDate)) {
                return false;
            }

            this._maxDate = date;
            this._revalidate();

            if (this._calendar) {
                this._calendar.maxDate = date;
            }
        },
    },

    /**
     * How dates are shown: options of `Intl.DateTimeFormat`, such as `{dateStyle: 'short'}` or
     * `{year: 'numeric', month: 'long', day: 'numeric'}`.
     */
    format: {
        value: DEFAULT_DATE_FORMAT,
        coerce(format) {
            if (!format || typeof format !== 'object') {
                throw new TypeError('The format of a date edit must be an object of options.');
            }

            // Validate the options.
            new Intl.DateTimeFormat(getLocaleManager().locale, format);

            return Object.freeze({ ...format });
        },
        changed() {
            this._formatter = null;
            this._normalizeText();
        },
    },

    /**
     * Whether the calendar is open.
     */
    popupOpen: {
        value: false,
        signal: false,
        set(open) {
            if (open) {
                this._showPopup();
            } else {
                this._popover?.popdown();
            }

            return false;
        },
    },
});

registerType('date-edit', DateEdit);
