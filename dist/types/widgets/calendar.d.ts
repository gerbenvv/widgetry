/**
 * @module widgets/calendar
 */
import { Widget } from './widget.js';
/**
 * Returns a date at midnight (local time) of the same day, or `null`.
 *
 * @param {Date | null | undefined} date
 * @returns {Date | null}
 */
export declare function startOfDay(date: Date | null | undefined): Date | null;
/**
 * Creates a local date. Unlike `new Date(year, month, day)`, years below 100 are not moved to the
 * 20th century, and a day past the end of the month is clamped to the last day.
 *
 * @param {number} year
 * @param {number} month From 0 (January) to 11.
 * @param {number} day
 * @returns {Date}
 */
export declare function makeDate(year: number, month: number, day: number): Date;
/**
 * Returns the number of days in a month.
 *
 * @param {number} year
 * @param {number} month From 0 (January) to 11.
 * @returns {number}
 */
export declare function getDaysInMonth(year: number, month: number): number;
/**
 * Compares two dates by day: negative if `first` is earlier, positive if later, 0 if the same day.
 *
 * @param {Date} first
 * @param {Date} second
 * @returns {number}
 */
export declare function compareDays(first: Date, second: Date): number;
/**
 * Returns the ISO 8601 week number of a date.
 *
 * @param {Date} date
 * @returns {number}
 */
export declare function getIsoWeek(date: Date): number;
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
 * activated: double-clicked, Enter pressed, or clicked with `activateOnSingleClick`),
 * `month-change` (the shown month changed).
 */
export declare class Calendar extends Widget {
    _cursor: any;
    _shownMonth: any;
    _localeDisconnect: () => void;
    _headerEl: Element;
    _gridEl: Element;
    _monthEl: Element;
    _yearEl: Element;
    _sizerEl: Element;
    _dayNameEls: Element[];
    _weekEls: Element[];
    _dayEls: Element[];
    _navigationEls: Element[];
    _idPrefix: string;
    _date: any;
    _numberFormat: Intl.NumberFormat;
    _labelFormat: Intl.DateTimeFormat;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The grid of days.
     *
     * @type {HTMLElement}
     */
    get focusElement(): HTMLElement;
    _syncAccessibleName(): void;
    /**
     * Selects a day, as if the user did.
     *
     * @param {Date} date
     * @returns {boolean} Whether the day could be selected (it is not outside the date range).
     */
    selectDay(date: Date): boolean;
    /**
     * Shows the previous month.
     */
    previousMonth(): void;
    /**
     * Shows the next month.
     */
    nextMonth(): void;
    /**
     * Shows the same month in the previous year.
     */
    previousYear(): void;
    /**
     * Shows the same month in the next year.
     */
    nextYear(): void;
    /**
     * Handles a key as the calendar's keyboard navigation does. Widgets that keep the focus
     * themselves while showing a calendar (such as a date edit) forward their keys to it.
     *
     * @param {KeyboardEvent} event
     * @returns {boolean} Whether the key was handled.
     */
    handleKey(event: KeyboardEvent): boolean;
    destroy(): void;
    _getFirstDayOfWeek(): any;
    _isInRange(day: any): boolean;
    _clampToRange(day: any): any;
    _setDate(day: any): void;
    _moveCursor(day: any): void;
    _renderNames(): void;
    _renderDays(): void;
    _dayFromCell(cell: any): Date;
    _onHeaderPointerDown(event: any): void;
    _onGridPointerDown(event: any): void;
    _onGridClick(event: any): void;
    _onGridDoubleClick(event: any): void;
    _onWheel(event: any): void;
}

/** The declared properties of {@link Calendar}. */
export interface Calendar {
    /**
     * The selected day, or `null`. Setting it also shows its month.
     */
    date: Date | null;
    /**
     * The day with the keyboard focus, which determines the month shown. It stays within the date
     * range.
     */
    cursor: any;
    /**
     * The year shown.
     */
    year: any;
    /**
     * The month shown, from 0 (January) to 11.
     */
    month: any;
    /**
     * The earliest day that can be chosen, or `null`.
     */
    minDate: Date | null;
    /**
     * The latest day that can be chosen, or `null`.
     */
    maxDate: Date | null;
    /**
     * The first day of the week (0 for Sunday, 1 for Monday and so on), or `null` for the
     * locale's.
     */
    firstDayOfWeek: any;
    /**
     * Whether the month and year headings with their navigation buttons are shown.
     */
    showHeading: boolean;
    /**
     * Whether the names of the days are shown.
     */
    showDayNames: boolean;
    /**
     * Whether ISO week numbers are shown.
     */
    showWeekNumbers: boolean;
    /**
     * Whether a single click on a day also activates it, as in a date picker.
     */
    activateOnSingleClick: any;
}
