/**
 * @module columns/data-column
 */

import { SortOrder } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { AbstractColumn, ColumnChange } from './abstract-column.js';

/**
 * Base class of columns that show a column of the model (`name`).
 *
 * Clicking the header of a `sortable` column sorts the model on the column, and clicking again
 * reverses the order. How a value is shown is up to the subclass; a `formatter` function can
 * replace the text, and a `renderer` function can fill the cell element itself.
 */
export class DataColumn extends AbstractColumn {
    /**
     * Whether the column sorts its table when its header is clicked.
     *
     * @type {boolean}
     */
    get isSortable() {
        return this._sortable && Boolean(this._getSortKey());
    }

    /**
     * Sorts the model on the column. Without an order, the order is reversed when the model is
     * already sorted on this column, and ascending otherwise.
     *
     * @param {string} [order] One of `SortOrder`.
     */
    sort(order) {
        const model = this.model;
        const key = this._getSortKey();
        if (!model || !key) {
            return;
        }

        if (order === undefined) {
            order =
                this.sortIndicator === SortOrder.ASCENDING
                    ? SortOrder.DESCENDING
                    : SortOrder.ASCENDING;
        }

        model.sortByColumn(order === SortOrder.NONE ? null : key, order);
    }

    /**
     * Returns the value of the column in a row.
     *
     * @param {object} row
     * @returns {unknown}
     */
    getValue(row) {
        return this._name === null ? undefined : row[this._name];
    }

    getCellText(row, index) {
        const value = this.getValue(row);

        if (this._formatter) {
            const text = this._formatter(value, row, index, this);

            return text === null || text === undefined ? '' : String(text);
        }

        return this._formatValue(value, row, index);
    }

    /**
     * Converts a value to the text of its cell.
     *
     * @protected
     * @param {unknown} value
     * @param {object} _row
     * @param {number} _index
     * @returns {string}
     */
    _formatValue(value, _row, _index) {
        return value === null || value === undefined ? '' : String(value);
    }

    _renderCell(cell, row, index) {
        if (this._renderer) {
            cell.wyText = null;
            this._renderer(cell, this.getValue(row), row, index, this);

            return;
        }

        super._renderCell(cell, row, index);
    }

    _getSortKey() {
        return this._sortColumn || this._name;
    }
}

defineProperties(DataColumn, {
    /**
     * The model column this column shows.
     */
    name: {
        value: null,
        changed() {
            this._contentWidth = 0;
            this._invalidate(ColumnChange.CELLS);
            this._invalidate(ColumnChange.HEADER);
        },
    },

    /**
     * The model column to sort on, or `null` to sort on `name`.
     */
    sortColumn: {
        value: null,
        changed() {
            this._invalidate(ColumnChange.HEADER);
        },
    },

    /**
     * Whether clicking the header sorts the model on this column.
     */
    sortable: {
        value: true,
        changed() {
            this._invalidate(ColumnChange.HEADER);
        },
    },

    /**
     * The sort indicator of the header: the `SortOrder` of the model when it is sorted on this
     * column, and `SortOrder.NONE` otherwise.
     */
    sortIndicator: {
        readOnly: true,
        get() {
            const model = this.model;
            const key = this._getSortKey();

            if (!model || !key || model.sortColumn !== key) {
                return SortOrder.NONE;
            }

            return model.sortOrder;
        },
    },

    /**
     * A function `(value, row, index, column) => string` returning the text of a cell, or
     * `null` for the column's own formatting.
     */
    formatter: {
        value: null,
        coerce(method) {
            if (method !== null && typeof method !== 'function') {
                throw new TypeError('The formatter must be a function or null.');
            }

            return method;
        },
        changed() {
            this._contentWidth = 0;
            this._invalidate(ColumnChange.CELLS);
        },
    },

    /**
     * A function `(cell, value, row, index, column)` that fills the cell element itself, or
     * `null`. Cells are reused for other rows, so it must set all of the cell's content.
     */
    renderer: {
        value: null,
        coerce(method) {
            if (method !== null && typeof method !== 'function') {
                throw new TypeError('The renderer must be a function or null.');
            }

            return method;
        },
        changed() {
            this._invalidate(ColumnChange.CELLS);
        },
    },
});
