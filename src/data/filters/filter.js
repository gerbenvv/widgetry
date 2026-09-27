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
export class Filter extends Instance {
    /**
     * Checks whether a row passes the filter.
     *
     * @param {object} _row
     * @returns {boolean}
     */
    isVisibleRow(_row) {
        throw new Error(`${this.constructor.name} does not implement isVisibleRow().`);
    }

    /**
     * Emits `change`. Subclasses call this when a property that affects the outcome changed.
     *
     * @protected
     */
    _changed() {
        this.emit('change', this);
    }
}
