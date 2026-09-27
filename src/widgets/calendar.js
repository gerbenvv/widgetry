/**
 * @module widgets/calendar
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement, uniqueId } from '../core/util.js';
import { Key } from '../events/constants.js';
import { getLocaleManager } from '../i18n/locale-manager.js';
import { attachDoublePress } from './double-press.js';
import { Widget } from './widget.js';

/**
 * The number of weeks (rows) the calendar shows, so its size does not change between months.
 *
 * @type {number}
 */
const WEEKS = 6;

/**
 * The accessible names of the navigation buttons.
 *
 * @type {Readonly<Record<string, string>>}
 */
const NAVIGATION_LABELS = Object.freeze({
    'previous-month': 'Previous month',
    'next-month': 'Next month',
    'previous-year': 'Previous year',
    'next-year': 'Next year',
});

/**
 * Returns a date at midnight (local time) of the same day, or `null`.
 *
 * @param {Date | null | undefined} date
 * @returns {Date | null}
 */
export function startOfDay(date) {
    if (!date) {
        return null;
    }

    return makeDate(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Creates a local date. Unlike `new Date(year, month, day)`, years below 100 are not moved to the
 * 20th century, and a day past the end of the month is clamped to the last day.
 *
 * @param {number} year
 * @param {number} month From 0 (January) to 11.
 * @param {number} day
 * @returns {Date}
 */
export function makeDate(year, month, day) {
    const date = new Date(2000, 0, 1);
    date.setFullYear(year, month, 1);

    const last = getDaysInMonth(date.getFullYear(), date.getMonth());
    date.setDate(Math.min(day, last));

    return date;
}

/**
 * Returns the number of days in a month.
 *
 * @param {number} year
 * @param {number} month From 0 (January) to 11.
 * @returns {number}
 */
export function getDaysInMonth(year, month) {
    const date = new Date(2000, 0, 1);
    date.setFullYear(year, month + 1, 0);

    return date.getDate();
}

/**
 * Compares two dates by day: negative if `first` is earlier, positive if later, 0 if the same day.
 *
 * @param {Date} first
 * @param {Date} second
 * @returns {number}
 */
export function compareDays(first, second) {
    return (
        first.getFullYear() - second.getFullYear() ||
        first.getMonth() - second.getMonth() ||
        first.getDate() - second.getDate()
    );
}

/**
 * Returns the ISO 8601 week number of a date.
 *
 * @param {Date} date
 * @returns {number}
 */
export function getIsoWeek(date) {
    const day = new Date(Date.UTC(2000, 0, 1));
    day.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());

    // A week belongs to the year of its Thursday.
    day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));

    const yearStart = new Date(Date.UTC(2000, 0, 1));
    yearStart.setUTCFullYear(day.getUTCFullYear(), 0, 1);

    return Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);

    return result;
}

function addMonths(date, months) {
    const target = new Date(2000, 0, 1);
    target.setFullYear(date.getFullYear(), date.getMonth() + months, 1);

    return makeDate(target.getFullYear(), target.getMonth(), date.getDate());
}

function checkDate(date) {
    if (date === null || date === undefined) {
        return null;
    }

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new TypeError('Expected a valid Date or null.');
    }

    return startOfDay(date);
}

/**
 * A month calendar, for choosing a day.
 *
 * The calendar shows the month of its cursor, the day that has the keyboard focus, with the
 * locale's month and day names and first day of the week. Days outside `minDate` and `maxDate`
 * cannot be chosen.
 *
 * Keyboard: the arrow keys move the cursor by a day or a week, Home and End to the start and end
 * of the week, Page Up and Page Down by a month, and with Shift by a year. Space selects the
 * cursor day, and Enter selects and activates it. The wheel changes the month.
 *
 * Signals: `day-selected` (the selected `date` changed by the user), `day-activate` (a day was
 * activated: double-clicked, Enter pressed, or clicked with `activateOnClick`), `month-change`
 * (the shown month changed).
 */
export class Calendar extends Widget {
    _initialize() {
        super._initialize();

        this._cursor = startOfDay(new Date());
        this._shownMonth = null;

        this._headerEl.addEventListener('pointerdown', (event) => this._onHeaderPointerDown(event));
        this._gridEl.addEventListener('pointerdown', (event) => this._onGridPointerDown(event));
        this._gridEl.addEventListener('click', (event) => this._onGridClick(event));
        attachDoublePress(this._gridEl, (event) => this._onGridDoubleClick(event), {
            key: (event) => event.target.closest?.('.wy-calendar-day') || null,
        });
        this._gridEl.addEventListener('keydown', (event) => {
            if (this.handleKey(event)) {
                event.preventDefault();
                event.stopPropagation();
            }
        });
        this.el.addEventListener('wheel', (event) => this._onWheel(event), { passive: false });

        this._localeDisconnect = getLocaleManager().connect('locale-change', () =>
            this._renderNames()
        );

        this._renderNames();
    }

    _render() {
        const monthId = uniqueId('wy-calendar-month');

        const navigation = (action) =>
            `<span class="wy-calendar-navigation" data-action="${action}" role="button" data-wy-label="${NAVIGATION_LABELS[action]}"></span>`;

        const cells = Array.from({ length: WEEKS }, () => {
            const days = Array.from(
                { length: 7 },
                () => '<span class="wy-calendar-day" role="gridcell"></span>'
            ).join('');

            return `<div class="wy-calendar-week" role="row"><span class="wy-calendar-week-number" role="rowheader"></span>${days}</div>`;
        }).join('');

        const element = createElement(`
            <div class="wy-calendar">
                <div class="wy-calendar-header">
                    <span class="wy-calendar-heading wy-calendar-month-heading">
                        ${navigation('previous-month')}
                        <span class="wy-calendar-title">
                            <span class="wy-calendar-sizer" aria-hidden="true"></span>
                            <span class="wy-calendar-month" id="${monthId}"></span>
                        </span>
                        ${navigation('next-month')}
                    </span>
                    <span class="wy-calendar-heading wy-calendar-year-heading">
                        ${navigation('previous-year')}
                        <span class="wy-calendar-title">
                            <span class="wy-calendar-year" id="${monthId}-year"></span>
                        </span>
                        ${navigation('next-year')}
                    </span>
                </div>
                <div class="wy-calendar-grid" role="grid" aria-labelledby="${monthId} ${monthId}-year">
                    <div class="wy-calendar-day-names" role="row">
                        <span class="wy-calendar-week-number"></span>
                        ${'<span class="wy-calendar-day-name" role="columnheader"></span>'.repeat(7)}
                    </div>
                    ${cells}
                </div>
            </div>
        `);

        this._headerEl = element.querySelector('.wy-calendar-header');
        this._gridEl = element.querySelector('.wy-calendar-grid');
        this._monthEl = element.querySelector('.wy-calendar-month');
        this._yearEl = element.querySelector('.wy-calendar-year');
        this._sizerEl = element.querySelector('.wy-calendar-sizer');
        this._dayNameEls = [...element.querySelectorAll('.wy-calendar-day-name')];
        this._weekEls = [...element.querySelectorAll('.wy-calendar-week')];
        this._dayEls = [...element.querySelectorAll('.wy-calendar-day')];
        this._navigationEls = [...element.querySelectorAll('.wy-calendar-navigation')];

        this._idPrefix = uniqueId('wy-calendar-day');
        this._dayEls.forEach((cell, index) => {
            cell.id = `${this._idPrefix}-${index}`;
        });

        return element;
    }

    /**
     * The grid of days.
     *
     * @type {HTMLElement}
     */
    get focusElement() {
        return this._gridEl;
    }

    /**
     * Selects a day, as if the user did.
     *
     * @param {Date} date
     * @returns {boolean} Whether the day could be selected (it is not outside the date range).
     */
    selectDay(date) {
        const day = checkDate(date);
        if (!day || !this._isInRange(day)) {
            return false;
        }

        this._moveCursor(day);

        if (!this._date || compareDays(this._date, day) !== 0) {
            this._setDate(day);
            this.emit('day-selected', this);
        }

        return true;
    }

    /**
     * Shows the previous month.
     */
    previousMonth() {
        this._moveCursor(addMonths(this._cursor, -1));
    }

    /**
     * Shows the next month.
     */
    nextMonth() {
        this._moveCursor(addMonths(this._cursor, 1));
    }

    /**
     * Shows the same month in the previous year.
     */
    previousYear() {
        this._moveCursor(addMonths(this._cursor, -12));
    }

    /**
     * Shows the same month in the next year.
     */
    nextYear() {
        this._moveCursor(addMonths(this._cursor, 12));
    }

    /**
     * Handles a key as the calendar's keyboard navigation does. Widgets that keep the focus
     * themselves while showing a calendar (such as a date edit) forward their keys to it.
     *
     * @param {KeyboardEvent} event
     * @returns {boolean} Whether the key was handled.
     */
    handleKey(event) {
        if (!this.isSensitive || event.altKey || event.ctrlKey || event.metaKey) {
            return false;
        }

        const cursor = this._cursor;
        const weekday = (cursor.getDay() - this._getFirstDayOfWeek() + 7) % 7;
        const rtl = getComputedStyle(this.el).direction === 'rtl';

        switch (event.key) {
            case Key.LEFT:
                this._moveCursor(addDays(cursor, rtl ? 1 : -1));
                break;

            case Key.RIGHT:
                this._moveCursor(addDays(cursor, rtl ? -1 : 1));
                break;

            case Key.UP:
                this._moveCursor(addDays(cursor, -7));
                break;

            case Key.DOWN:
                this._moveCursor(addDays(cursor, 7));
                break;

            case Key.HOME:
                this._moveCursor(addDays(cursor, -weekday));
                break;

            case Key.END:
                this._moveCursor(addDays(cursor, 6 - weekday));
                break;

            case Key.PAGE_UP:
                this._moveCursor(addMonths(cursor, event.shiftKey ? -12 : -1));
                break;

            case Key.PAGE_DOWN:
                this._moveCursor(addMonths(cursor, event.shiftKey ? 12 : 1));
                break;

            case Key.SPACE:
                this.selectDay(cursor);
                break;

            case Key.ENTER:
                if (this.selectDay(cursor)) {
                    this.emit('day-activate', this);
                }
                break;

            default:
                return false;
        }

        return true;
    }

    destroy() {
        this._localeDisconnect();

        super.destroy();
    }

    _getFirstDayOfWeek() {
        return this._firstDayOfWeek ?? getLocaleManager().firstDayOfWeek;
    }

    _isInRange(day) {
        return (
            (!this._minDate || compareDays(day, this._minDate) >= 0) &&
            (!this._maxDate || compareDays(day, this._maxDate) <= 0)
        );
    }

    _clampToRange(day) {
        if (this._minDate && compareDays(day, this._minDate) < 0) {
            return new Date(this._minDate);
        }

        if (this._maxDate && compareDays(day, this._maxDate) > 0) {
            return new Date(this._maxDate);
        }

        return day;
    }

    _setDate(day) {
        this._date = day;
        this.emit('date-change', this);
        this._renderDays();
    }

    _moveCursor(day) {
        this._cursor = this._clampToRange(day);
        this._renderDays();
    }

    _renderNames() {
        const manager = getLocaleManager();
        const first = this._getFirstDayOfWeek();

        const shortNames = manager.shortDayNames;
        const longNames = manager.longDayNames;

        this._dayNameEls.forEach((element, index) => {
            const day = (first + index) % 7;

            element.textContent = shortNames[day];
            element.title = longNames[day];
            element.setAttribute('aria-label', longNames[day]);
            element.classList.toggle('wy-weekend', day === 0 || day === 6);
        });

        // All month names are stacked invisibly, so the heading keeps its width.
        this._sizerEl.textContent = '';
        for (const name of manager.longMonthNames) {
            const span = document.createElement('span');
            span.textContent = name;
            this._sizerEl.append(span);
        }

        this._numberFormat = new Intl.NumberFormat(manager.locale, { useGrouping: false });
        this._labelFormat = new Intl.DateTimeFormat(manager.locale, { dateStyle: 'full' });

        this._shownMonth = null;
        this._renderDays();
    }

    _renderDays() {
        const manager = getLocaleManager();
        const cursor = this._cursor;
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const first = this._getFirstDayOfWeek();
        const today = startOfDay(new Date());

        this._monthEl.textContent = manager.longMonthNames[month];
        this._yearEl.textContent = this._numberFormat.format(year);

        // The first cell is the first day of the week on or before the first of the month.
        const firstOfMonth = makeDate(year, month, 1);
        const offset = (firstOfMonth.getDay() - first + 7) % 7;
        const start = addDays(firstOfMonth, -offset);

        this._dayEls.forEach((cell, index) => {
            const day = addDays(start, index);
            const inRange = this._isInRange(day);
            const isCursor = compareDays(day, cursor) === 0;
            const selected = Boolean(this._date) && compareDays(day, this._date) === 0;

            cell.textContent = this._numberFormat.format(day.getDate());
            cell.dataset.date = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
            cell.setAttribute('aria-label', this._labelFormat.format(day));
            cell.setAttribute('aria-selected', String(selected));

            cell.classList.toggle('wy-other-month', day.getMonth() !== month);
            cell.classList.toggle('wy-today', compareDays(day, today) === 0);
            cell.classList.toggle('wy-selected', selected);
            cell.classList.toggle('wy-cursor', isCursor);
            cell.classList.toggle('wy-disabled', !inRange);
            cell.classList.toggle('wy-weekend', day.getDay() === 0 || day.getDay() === 6);

            if (inRange) {
                cell.removeAttribute('aria-disabled');
            } else {
                cell.setAttribute('aria-disabled', 'true');
            }

            if (isCursor) {
                this._gridEl.setAttribute('aria-activedescendant', cell.id);
            }
        });

        // Week numbers are those of the Monday in each row.
        const monday = (8 - first) % 7;
        this._weekEls.forEach((week, index) => {
            const number = week.querySelector('.wy-calendar-week-number');
            const day = addDays(start, index * 7 + monday);

            number.textContent = this._numberFormat.format(getIsoWeek(day));
        });

        // Navigation is disabled when the whole target month is out of range.
        for (const element of this._navigationEls) {
            const months = {
                'previous-month': -1,
                'next-month': 1,
                'previous-year': -12,
                'next-year': 12,
            }[element.dataset.action];

            const target = addMonths(makeDate(year, month, 1), months);
            const last = makeDate(target.getFullYear(), target.getMonth(), 31);
            const disabled =
                (this._minDate && compareDays(last, this._minDate) < 0) ||
                (this._maxDate && compareDays(target, this._maxDate) > 0);

            element.classList.toggle('wy-disabled', Boolean(disabled));
            element.setAttribute('aria-disabled', String(Boolean(disabled)));
        }

        const shown = year * 12 + month;
        if (this._shownMonth !== null && this._shownMonth !== shown) {
            this._shownMonth = shown;
            this.emit('month-change', this);
        }

        this._shownMonth = shown;
    }

    _dayFromCell(cell) {
        const [year, month, day] = cell.dataset.date.split('-').map(Number);

        return makeDate(year, month - 1, day);
    }

    _onHeaderPointerDown(event) {
        const button = event.target.closest('.wy-calendar-navigation');
        if (event.button !== 0 || !button || button.classList.contains('wy-disabled')) {
            return;
        }

        event.preventDefault();
        this.focus();

        const actions = {
            'previous-month': () => this.previousMonth(),
            'next-month': () => this.nextMonth(),
            'previous-year': () => this.previousYear(),
            'next-year': () => this.nextYear(),
        };

        actions[button.dataset.action]();
    }

    _onGridPointerDown(event) {
        const cell = event.target.closest('.wy-calendar-day');
        if (event.button !== 0 || !cell) {
            return;
        }

        this.focus();

        this.selectDay(this._dayFromCell(cell));
    }

    _onGridClick(event) {
        // A click activates after the button is released, so the press is complete by then.
        const cell = event.target.closest('.wy-calendar-day');
        if (cell && this._activateOnClick && this._isInRange(this._dayFromCell(cell))) {
            this.emit('day-activate', this);
        }
    }

    _onGridDoubleClick(event) {
        const cell = event.target.closest('.wy-calendar-day');
        if (cell && !this._activateOnClick && this._isInRange(this._dayFromCell(cell))) {
            this.emit('day-activate', this);
        }
    }

    _onWheel(event) {
        if (!this.isSensitive || !event.deltaY) {
            return;
        }

        event.preventDefault();

        if (event.deltaY < 0) {
            this.previousMonth();
        } else {
            this.nextMonth();
        }
    }
}

defineProperties(Calendar, {
    canFocus: { value: true },

    /**
     * The selected day, or `null`. Setting it also shows its month.
     */
    date: {
        value: null,
        coerce: checkDate,
        set(date) {
            if (
                date === this._date ||
                (date && this._date && compareDays(date, this._date) === 0)
            ) {
                return false;
            }

            this._date = date;

            if (date) {
                this._cursor = date;
            }

            this._renderDays();
        },
    },

    /**
     * The day with the keyboard focus, which determines the month shown. It stays within the date
     * range.
     */
    cursor: {
        signal: false,
        get() {
            return new Date(this._cursor);
        },
        set(date) {
            const day = checkDate(date);
            if (day) {
                this._moveCursor(day);
            }

            return false;
        },
    },

    /**
     * The year shown.
     */
    year: {
        signal: false,
        get() {
            return this._cursor.getFullYear();
        },
        set(year) {
            this._moveCursor(
                makeDate(Number(year), this._cursor.getMonth(), this._cursor.getDate())
            );

            return false;
        },
    },

    /**
     * The month shown, from 0 (January) to 11.
     */
    month: {
        signal: false,
        get() {
            return this._cursor.getMonth();
        },
        set(month) {
            this._moveCursor(
                makeDate(this._cursor.getFullYear(), Number(month), this._cursor.getDate())
            );

            return false;
        },
    },

    /**
     * The earliest day that can be chosen, or `null`.
     */
    minDate: {
        value: null,
        coerce: checkDate,
        set(date) {
            if (date && this._minDate && compareDays(date, this._minDate) === 0) {
                return false;
            }

            this._minDate = date;
            this._moveCursor(this._cursor);
        },
    },

    /**
     * The latest day that can be chosen, or `null`.
     */
    maxDate: {
        value: null,
        coerce: checkDate,
        set(date) {
            if (date && this._maxDate && compareDays(date, this._maxDate) === 0) {
                return false;
            }

            this._maxDate = date;
            this._moveCursor(this._cursor);
        },
    },

    /**
     * The first day of the week (0 for Sunday, 1 for Monday and so on), or `null` for the
     * locale's.
     */
    firstDayOfWeek: {
        value: null,
        coerce(day) {
            if (day === null || day === undefined) {
                return null;
            }

            const value = Number(day);
            if (!Number.isInteger(value) || value < 0 || value > 6) {
                throw new RangeError(`Invalid first day of the week ${day}.`);
            }

            return value;
        },
        changed() {
            this._renderNames();
        },
    },

    /**
     * Whether the month and year headings with their navigation buttons are shown.
     */
    showHeading: {
        value: true,
        coerce: Boolean,
        changed(show) {
            this._headerEl.hidden = !show;
        },
    },

    /**
     * Whether the names of the days are shown.
     */
    showDayNames: {
        value: true,
        coerce: Boolean,
        changed(show) {
            this.el.classList.toggle('wy-no-day-names', !show);
        },
    },

    /**
     * Whether ISO week numbers are shown.
     */
    showWeekNumbers: {
        value: false,
        coerce: Boolean,
        changed(show) {
            this.el.classList.toggle('wy-show-week-numbers', show);
        },
    },

    /**
     * Whether a single click on a day also activates it, as in a date picker.
     */
    activateOnClick: { value: false, coerce: Boolean },
});

registerType('calendar', Calendar);
