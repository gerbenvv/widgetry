/**
 * @module columns/data-column
 */
import { AbstractColumn } from './abstract-column.js';
/**
 * Base class of columns that show a column of the model (`name`).
 *
 * Clicking the header of a `sortable` column sorts the model on the column, and clicking again
 * reverses the order. How a value is shown is up to the subclass; a `formatter` function can
 * replace the text, and a `renderer` function can fill the cell element itself.
 */
export declare class DataColumn extends AbstractColumn {
    /**
     * Whether the column sorts its table when its header is clicked.
     *
     * @type {boolean}
     */
    get isSortable(): boolean;
    /**
     * Sorts the model on the column. Without an order, the order is reversed when the model is
     * already sorted on this column, and ascending otherwise.
     *
     * @param {string} [order] One of `SortOrder`.
     */
    sort(order?: string): void;
    /**
     * Returns the value of the column in a row.
     *
     * @param {object} row
     * @returns {unknown}
     */
    getValue(row: object): unknown;
    getCellText(row: any, index: any): string;
    /**
     * Converts a value to the text of its cell.
     *
     * @protected
     * @param {unknown} value
     * @param {object} _row
     * @param {number} _index
     * @returns {string}
     */
    protected _formatValue(value: unknown, _row: object, _index: number): string;
    _renderCell(cell: any, row: any, index: any): void;
    _getSortKey(): any;
}

/** The declared properties of {@link DataColumn}. */
export interface DataColumn {
    /**
     * The model column this column shows.
     */
    name: any;
    /**
     * The model column to sort on, or `null` to sort on `name`.
     */
    sortColumn: any;
    /**
     * Whether clicking the header sorts the model on this column.
     */
    sortable: boolean;
    /**
     * The sort indicator of the header: the `SortOrder` of the model when it is sorted on this
     * column, and `SortOrder.NONE` otherwise.
     */
    readonly sortIndicator: any;
    /**
     * A function `(value, row, index, column) => string` returning the text of a cell, or
     * `null` for the column's own formatting.
     */
    formatter: any;
    /**
     * A function `(cell, value, row, index, column)` that fills the cell element itself, or
     * `null`. Cells are reused for other rows, so it must set all of the cell's content.
     */
    renderer: any;
}
