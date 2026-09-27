/**
 * @module data/filters/filter
 */
import { Instance } from '../../core/instance.js';
/**
 * Base class of row filters, which decide which rows of a model a `FilteredListModel` shows.
 *
 * Subclasses implement {@link Filter#isVisibleRow} and call {@link Filter#_changed} (or emit
 * `change` themselves) whenever the outcome may have changed, so filtered models update.
 *
 * Signals: `change` (`filter`).
 */
export declare class Filter extends Instance {
    /**
     * Checks whether a row passes the filter.
     *
     * @param {object} row
     * @returns {boolean}
     */
    isVisibleRow(_row: any): boolean;
    /**
     * Emits `change`. Subclasses call this when a property that affects the outcome changed.
     *
     * @protected
     */
    protected _changed(): void;
}
