/**
 * @module data/filtered-list-model
 */
import { AbstractModel } from './abstract-model.js';
import { Filter } from './filters/filter.js';
/**
 * A view of another model (the source) that shows only the rows passing all of its filters.
 *
 * The filtered model stays in sync with its source: inserted, removed, moved and changed rows are
 * checked against the filters and passed on as the corresponding signals with indices of the
 * filtered model. When a filter changes, only the rows that appear or disappear are signaled.
 * Sorting, the id column and the columns info are those of the source; setting them sets them on
 * the source.
 *
 * Changes made through the filtered model (such as `updateRow(index, ...)` with an index of the
 * filtered model) are applied to the source. Methods that return a row index return the index in
 * the filtered model, or -1 if the row does not pass the filters.
 *
 * @example
 * const search = new SearchFilter();
 * const filtered = new FilteredListModel(model, search);
 * search.query = 'fund'; // Filtered now only has the rows containing "fund".
 */
export declare class FilteredListModel extends AbstractModel {
    /**
     * The index in the source model of every row, in order.
     *
     * @type {number[]}
     */
    _sourceIndices: number[];
    /** @type {Filter[]} */
    _filters: Filter[];
    _proxyDisconnectors: any[];
    _model: any;
    /**
     * @param {AbstractModel | Record<string, unknown>} [model] The source model (followed by the
     *     filters, like the original toolkit), or property values.
     * @param {...Filter} filters
     */
    constructor(model?: AbstractModel | Record<string, unknown>, ...filters: Filter[]);
    _initialize(): void;
    /**
     * Converts an index of this model to the index of the row in the source model.
     *
     * @param {number} index
     * @returns {number}
     * @throws {RangeError} If there is no row at the index.
     */
    toSourceIndex(index: number): number;
    /**
     * Converts an index of the source model to the index of the row in this model.
     *
     * @param {number} sourceIndex
     * @returns {number} The index, or -1 if the row does not pass the filters.
     */
    fromSourceIndex(sourceIndex: number): number;
    /**
     * Adds a filter.
     *
     * @param {Filter} filter
     * @throws {Error} If the filter was already added.
     */
    addFilter(filter: Filter): void;
    /**
     * Removes a filter.
     *
     * @param {Filter} filter
     * @throws {Error} If the filter was not added.
     */
    removeFilter(filter: Filter): void;
    /**
     * Removes all filters, so all rows of the source are shown.
     */
    removeAllFilters(): void;
    /**
     * Refilters all rows. Filters signal their changes themselves; call this when a filter
     * depends on outside state that changed.
     */
    refilter(): void;
    /**
     * Checks whether a row passes all filters.
     *
     * @param {object} row
     * @returns {boolean}
     */
    isVisibleRow(row: object): boolean;
    destroy(): void;
    insertRow(index: any, row: any): number;
    appendRow(row: any): number;
    prependRow(row: any): number;
    insertRows(index: any, rows: any): void;
    removeRow(index: any): any;
    /**
     * Removes all rows of the source model, like the original toolkit.
     */
    removeAllRows(): void;
    replaceRow(index: any, row: any): number;
    updateRow(index: any, changes: any): number;
    sortByColumn(column: any, order?: string): void;
    compareValues(first: any, second: any, type: any, caseSensitive: any): any;
    _requireSource(): any;
    _setSource(model: any): void;
    /**
     * Finds the first position in `_sourceIndices` whose source index is at least `sourceIndex`.
     *
     * @param {number} sourceIndex
     * @returns {number}
     */
    _lowerBound(sourceIndex: number): number;
    _shiftIndices(from: any, delta: any): void;
    _getId(row: any): any;
    /**
     * Computes the visible rows from scratch.
     *
     * @returns {{rows: object[], indices: number[]}}
     */
    _computeRows(): {
        rows: object[];
        indices: number[];
    };
    _resetRows(): void;
    /**
     * Applies a filter change, signaling only the rows that appear or disappear.
     */
    _refilter(): void;
    _onFilterChange(): void;
    _onFilterDestroy(filter: any): void;
    _onSourceDestroy(): void;
    _onSourceRowsReorder(): void;
    _onSourceRowInsert(model: any, sourceIndex: any, id: any): void;
    _onSourceRowRemove(model: any, sourceIndex: any, id: any, row: any): void;
    _onSourceRowMove(model: any, fromIndex: any, toIndex: any, id: any): void;
    _onSourceRowUpdate(model: any, sourceIndex: any, id: any, oldId: any): void;
    _onSourceCellChange(model: any, sourceIndex: any, column: any): void;
}
export declare namespace FilteredListModel {
    var builderProperties: {
        filters(builder: any, model: any, filters: any): void;
    };
}

/** The declared properties of {@link FilteredListModel}. */
export interface FilteredListModel {
    /**
     * The rows that pass the filters, in the order of the source. Do not modify the array.
     */
    readonly rows: any;
    /**
     * The source model.
     */
    model: any;
    /**
     * The filters. A row is shown when it passes all of them. Setting an array replaces them.
     */
    filters: any[];
    /**
     * The number of filters.
     */
    readonly filtersCount: number;
}
