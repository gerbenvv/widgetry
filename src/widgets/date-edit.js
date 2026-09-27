/**
 * @module widgets/date-edit
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement, uniqueId } from '../core/util.js';
import { Key } from '../events/constants.js';
import { DateTimeParser } from '../i18n/date-time-parser.js';
import { getLocaleManager } from '../i18n/locale-manager.js';
import { Calendar, compareDays, makeDate, startOfDay } from './calendar.js';
import { LineEdit } from './line-edit.js';
import { Popover, PopoverCloseReason } from './popover.js';

/**
 * The default format of a date edit: the locale's medium date style, e.g. "Sep 27, 2026".
 *
 * @type {Intl.DateTimeFormatOptions}
 */
export const DEFAULT_DATE_FORMAT = Object.freeze({ dateStyle: 'medium' });

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
 * Typed dates are read with the date parser of the locale (`DateTimeParser`, in local time): in the
 * locale's numeric order, as ISO dates (yyyy-mm-dd), with month names and as relative dates such
 * as "tomorrow" (see `parseDate`). The text is shown in the invalid state while it is not a date
 * in the range from `minDate` to `maxDate`. Once the date edit is activated or loses the focus, a
 * valid text is shown in the format again.
 *
 * Keyboard: Alt+Down or F4 opens the calendar. While it is open, the arrow keys, Home, End, Page
 * Up and Page Down move through the days, Enter chooses one and Escape closes the calendar. The
 * focus stays in the entry.
 *
 * Signals: `date-change` and `value-change` (the date changed), `popup-open-change`, and those of
 * a line edit: `change` and `text-change` (the text changed), `activate`, and so on.
 */
export class DateEdit extends LineEdit {
    _initialize() {
        super._initialize();

        this._calendar = null;
        this._popover = null;
        this._formatter = null;
        this._updatingText = false;

        // Typed dates are local dates, like those of the calendar.
        this._parser = new DateTimeParser({ timeZone: 'local' });

        // An entry with a popup is a combo box for assistive technology, which allows
        // `aria-expanded`.
        this._inputEl.setAttribute('role', 'combobox');
        this._inputEl.setAttribute('aria-autocomplete', 'none');
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
            <span class="wy-date-edit-button" role="button" data-wy-label="Choose date"></span>
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
            this._calendar = new Calendar({ activateOnSingleClick: true });
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
    popup() {
        this.popupOpen = true;
    }

    /**
     * Closes the calendar.
     */
    popdown() {
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
            this._formatter = new Intl.DateTimeFormat(getLocaleManager().locale, {
                calendar: 'gregory',
                ...this._format,
            });
        }

        return this._formatter.format(date);
    }

    /**
     * Parses a typed date with the date parser (`DateTimeParser#parseDate`) of the current locale,
     * in local time. A missing year is this year. Override to accept other notations.
     *
     * @param {string} text
     * @returns {Date | null} The date at local midnight, or `null` if the text is not a date.
     */
    parseDate(text) {
        const date = this._parser.parseDate(text);

        // "Now" is the current time, while a date edit holds days.
        return date && startOfDay(date);
    }

    activate() {
        this._normalizeText();

        super.activate();
    }

    destroy() {
        this._localeDisconnect();
        this._parser.destroy();
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
        super._onTextChange(text);

        // The text of a date shown by the date edit itself is the date already.
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
     * `{year: 'numeric', month: 'long', day: 'numeric'}`. Dates are shown in the Gregorian
     * calendar, which is the one typed dates are read in, also in locales that default to another
     * one.
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
     * Whether the calendar is open. Setting it opens or closes the calendar.
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
