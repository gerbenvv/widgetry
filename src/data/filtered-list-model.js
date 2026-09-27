/**
 * @module data/filtered-list-model
 */

import { SortOrder } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { AbstractModel } from './abstract-model.js';
import { Filter } from './filters/filter.js';

/**
 * When a filter change shows or hides more rows than this, listeners get one `rows-reorder`
 * signal instead of a `row-insert` or `row-remove` per row.
 *
 * @type {number}
 */
const INCREMENTAL_LIMIT = 200;

/**
 * Signals of the source model that are passed on unchanged (with this model as the sender).
 *
 * @type {ReadonlyArray<string>}
 */
const PROXY_SIGNALS = [
    'columns-info-change',
    'id-column-change',
    'sort-column-change',
    'sort-order-change',
    'locale-aware-change',
];

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
export class FilteredListModel extends AbstractModel {
    /**
     * @param {AbstractModel | Record<string, unknown>} [model] The source model (followed by the
     *     filters, like the original toolkit), or property values.
     * @param {...Filter} filters
     */
    constructor(model, ...filters) {
        super(model instanceof AbstractModel ? { model, filters } : model);
    }

    _initialize() {
        super._initialize();

        /**
         * The index in the source model of every row, in order.
         *
         * @type {number[]}
         */
        this._sourceIndices = [];

        /** @type {Filter[]} */
        this._filters = [];

        this._proxyDisconnectors = [];
    }

    /**
     * Converts an index of this model to the index of the row in the source model.
     *
     * @param {number} index
     * @returns {number}
     * @throws {RangeError} If there is no row at the index.
     */
    toSourceIndex(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this._rows.length) {
            throw new RangeError(`There is no row at index ${index}.`);
        }

        return this._sourceIndices[index];
    }

    /**
     * Converts an index of the source model to the index of the row in this model.
     *
     * @param {number} sourceIndex
     * @returns {number} The index, or -1 if the row does not pass the filters.
     */
    fromSourceIndex(sourceIndex) {
        const position = this._lowerBound(sourceIndex);

        return this._sourceIndices[position] === sourceIndex ? position : -1;
    }

    /**
     * Adds a filter.
     *
     * @param {Filter} filter
     * @throws {Error} If the filter was already added.
     */
    addFilter(filter) {
        if (!(filter instanceof Filter)) {
            throw new TypeError('Only filters can be added to a filtered model.');
        }

        if (this._filters.includes(filter)) {
            throw new Error('The filter has already been added.');
        }

        this._filters.push(filter);
        filter.connect('change', this._onFilterChange, this);
        filter.connect('destroy', this._onFilterDestroy, this);

        this._refilter();
        this.emit('filters-change', this);
    }

    /**
     * Removes a filter.
     *
     * @param {Filter} filter
     * @throws {Error} If the filter was not added.
     */
    removeFilter(filter) {
        const index = this._filters.indexOf(filter);
        if (index < 0) {
            throw new Error('The filter has not been added.');
        }

        this._filters.splice(index, 1);
        filter.disconnect('change', this._onFilterChange, this);
        filter.disconnect('destroy', this._onFilterDestroy, this);

        this._refilter();
        this.emit('filters-change', this);
    }

    /**
     * Removes all filters, so all rows of the source are shown.
     */
    removeAllFilters() {
        this.filters = [];
    }

    /**
     * Refilters all rows. Filters signal their changes themselves; call this when a filter
     * depends on outside state that changed.
     */
    refilter() {
        this._refilter();
    }

    /**
     * Checks whether a row passes all filters.
     *
     * @param {object} row
     * @returns {boolean}
     */
    isVisibleRow(row) {
        const filters = this._filters;

        for (let i = 0; i < filters.length; ++i) {
            if (!filters[i].isVisibleRow(row)) {
                return false;
            }
        }

        return true;
    }

    destroy() {
        this._setSource(null);

        // Like the original toolkit, the filtered model owns its filters.
        for (const filter of [...this._filters]) {
            filter.disconnect('change', this._onFilterChange, this);
            filter.disconnect('destroy', this._onFilterDestroy, this);

            if (!filter.destroyed) {
                filter.destroy();
            }
        }

        this._filters = [];

        super.destroy();
    }

    insertRow(index, row) {
        const count = this._rows.length;
        if (!Number.isInteger(index) || index < 0 || index > count) {
            throw new RangeError(`Invalid row insertion index ${index}.`);
        }

        // Insert before the row at the index, or after the last row.
        const sourceIndex =
            index < count
                ? this._sourceIndices[index]
                : count
                  ? this._sourceIndices[count - 1] + 1
                  : this._requireSource().rowsCount;

        return this.fromSourceIndex(this._requireSource().insertRow(sourceIndex, row));
    }

    appendRow(row) {
        return this.fromSourceIndex(this._requireSource().appendRow(row));
    }

    prependRow(row) {
        return this.fromSourceIndex(this._requireSource().prependRow(row));
    }

    insertRows(index, rows) {
        const count = this._rows.length;
        if (!Number.isInteger(index) || index < 0 || index > count) {
            throw new RangeError(`Invalid row insertion index ${index}.`);
        }

        const sourceIndex =
            index < count ? this._sourceIndices[index] : this._requireSource().rowsCount;

        this._requireSource().insertRows(sourceIndex, rows);
    }

    removeRow(index) {
        return this._requireSource().removeRow(this.toSourceIndex(index));
    }

    /**
     * Removes all rows of the source model, like the original toolkit.
     */
    removeAllRows() {
        this._requireSource().removeAllRows();
    }

    replaceRow(index, row) {
        return this.fromSourceIndex(
            this._requireSource().replaceRow(this.toSourceIndex(index), row)
        );
    }

    updateRow(index, changes) {
        return this.fromSourceIndex(
            this._requireSource().updateRow(this.toSourceIndex(index), changes)
        );
    }

    sortByColumn(column, order = SortOrder.ASCENDING) {
        this._requireSource().sortByColumn(column, order);
    }

    compareValues(first, second, type, caseSensitive) {
        return this._model
            ? this._model.compareValues(first, second, type, caseSensitive)
            : super.compareValues(first, second, type, caseSensitive);
    }

    _requireSource() {
        if (!this._model) {
            throw new Error('The filtered model has no source model.');
        }

        return this._model;
    }

    _setSource(model) {
        const old = this._model;
        if (old) {
            old.disconnect('row-insert', this._onSourceRowInsert, this);
            old.disconnect('row-remove', this._onSourceRowRemove, this);
            old.disconnect('row-move', this._onSourceRowMove, this);
            old.disconnect('row-update', this._onSourceRowUpdate, this);
            old.disconnect('cell-change', this._onSourceCellChange, this);
            old.disconnect('rows-reorder', this._onSourceRowsReorder, this);
            old.disconnect('destroy', this._onSourceDestroy, this);
        }

        for (const disconnect of this._proxyDisconnectors) {
            disconnect();
        }

        this._proxyDisconnectors = [];
        this._model = model;

        if (model) {
            model.connect('row-insert', this._onSourceRowInsert, this);
            model.connect('row-remove', this._onSourceRowRemove, this);
            model.connect('row-move', this._onSourceRowMove, this);
            model.connect('row-update', this._onSourceRowUpdate, this);
            model.connect('cell-change', this._onSourceCellChange, this);
            model.connect('rows-reorder', this._onSourceRowsReorder, this);
            model.connect('destroy', this._onSourceDestroy, this);

            for (const signal of PROXY_SIGNALS) {
                this._proxyDisconnectors.push(
                    model.connect(signal, () => {
                        this._invalidateIndex();
                        this.emit(signal, this);
                    })
                );
            }
        }
    }

    /**
     * Finds the first position in `_sourceIndices` whose source index is at least `sourceIndex`.
     *
     * @param {number} sourceIndex
     * @returns {number}
     */
    _lowerBound(sourceIndex) {
        const indices = this._sourceIndices;

        let low = 0;
        let high = indices.length;
        while (low < high) {
            const middle = (low + high) >>> 1;

            if (indices[middle] < sourceIndex) {
                low = middle + 1;
            } else {
                high = middle;
            }
        }

        return low;
    }

    _shiftIndices(from, delta) {
        const indices = this._sourceIndices;

        for (let i = from; i < indices.length; ++i) {
            indices[i] += delta;
        }
    }

    _getId(row) {
        const idColumn = this.idColumn;

        return idColumn ? row[idColumn] : null;
    }

    /**
     * Computes the visible rows from scratch.
     *
     * @returns {{rows: object[], indices: number[]}}
     */
    _computeRows() {
        const rows = [];
        const indices = [];

        const sourceRows = this._model ? this._model.rows : [];
        for (let i = 0; i < sourceRows.length; ++i) {
            const row = sourceRows[i];

            if (this.isVisibleRow(row)) {
                rows.push(row);
                indices.push(i);
            }
        }

        return { rows, indices };
    }

    _resetRows() {
        const { rows, indices } = this._computeRows();

        this._rows = rows;
        this._sourceIndices = indices;
        this._invalidateIndex();

        this.emit('rows-reorder', this);
        this.emit('rows-change', this, 0, rows.length - 1);
    }

    /**
     * Applies a filter change, signaling only the rows that appear or disappear.
     */
    _refilter() {
        const { indices } = this._computeRows();
        const old = this._sourceIndices;

        // Count the differences between the old and new (sorted) source indices.
        let changes = 0;
        for (let i = 0, j = 0; i < old.length || j < indices.length;) {
            if (j >= indices.length || (i < old.length && old[i] < indices[j])) {
                ++changes;
                ++i;
            } else if (i >= old.length || indices[j] < old[i]) {
                ++changes;
                ++j;
            } else {
                ++i;
                ++j;
            }

            if (changes > INCREMENTAL_LIMIT) {
                this._resetRows();

                return;
            }
        }

        if (!changes) {
            return;
        }

        const sourceRows = this._model.rows;
        const oldIndices = [...old];

        let first = -1;
        let position = 0;
        for (let i = 0, j = 0; i < oldIndices.length || j < indices.length;) {
            if (j >= indices.length || (i < oldIndices.length && oldIndices[i] < indices[j])) {
                // The row no longer passes.
                const row = this._rows[position];

                this._rows.splice(position, 1);
                this._sourceIndices.splice(position, 1);
                this._invalidateIndex();

                first = first < 0 ? position : first;
                this.emit('row-remove', this, position, this._getId(row), row);

                ++i;
            } else if (i >= oldIndices.length || indices[j] < oldIndices[i]) {
                // The row passes now.
                const row = sourceRows[indices[j]];

                this._rows.splice(position, 0, row);
                this._sourceIndices.splice(position, 0, indices[j]);
                this._invalidateIndex();

                first = first < 0 ? position : first;
                this.emit('row-insert', this, position, this._getId(row));

                ++position;
                ++j;
            } else {
                ++position;
                ++i;
                ++j;
            }
        }

        this.emit('rows-change', this, first, this._rows.length - 1);
    }

    _onFilterChange() {
        this._refilter();
    }

    _onFilterDestroy(filter) {
        if (this._filters.includes(filter)) {
            this.removeFilter(filter);
        }
    }

    _onSourceDestroy() {
        this.destroy();
    }

    _onSourceRowsReorder() {
        this._resetRows();
    }

    _onSourceRowInsert(model, sourceIndex, id) {
        const position = this._lowerBound(sourceIndex);
        this._shiftIndices(position, 1);

        const row = model.getRow(sourceIndex);
        if (!this.isVisibleRow(row)) {
            return;
        }

        this._rows.splice(position, 0, row);
        this._sourceIndices.splice(position, 0, sourceIndex);
        this._invalidateIndex();

        this.emit('row-insert', this, position, id);
        this.emit('rows-change', this, position, this._rows.length - 1);
    }

    _onSourceRowRemove(model, sourceIndex, id, row) {
        const position = this._lowerBound(sourceIndex);
        const visible = this._sourceIndices[position] === sourceIndex;

        if (visible) {
            this._rows.splice(position, 1);
            this._sourceIndices.splice(position, 1);
            this._invalidateIndex();
        }

        this._shiftIndices(position, -1);

        if (visible) {
            this.emit('row-remove', this, position, id, row);
            this.emit('rows-change', this, position, this._rows.length - 1);
        }
    }

    _onSourceRowMove(model, fromIndex, toIndex, id) {
        const from = this._lowerBound(fromIndex);
        const visible = this._sourceIndices[from] === fromIndex;

        let row = null;
        if (visible) {
            row = this._rows.splice(from, 1)[0];
            this._sourceIndices.splice(from, 1);
        }

        this._shiftIndices(from, -1);

        const to = this._lowerBound(toIndex);
        this._shiftIndices(to, 1);

        if (!visible) {
            return;
        }

        this._rows.splice(to, 0, row);
        this._sourceIndices.splice(to, 0, toIndex);
        this._invalidateIndex();

        if (to !== from) {
            this.emit('row-move', this, from, to, id);
            this.emit('rows-change', this, Math.min(from, to), Math.max(from, to));
        }
    }

    _onSourceRowUpdate(model, sourceIndex, id, oldId) {
        const position = this._lowerBound(sourceIndex);
        const wasVisible = this._sourceIndices[position] === sourceIndex;

        const row = model.getRow(sourceIndex);
        const visible = this.isVisibleRow(row);

        if (wasVisible && visible) {
            this._rows[position] = row;
            this._invalidateIndex();

            this.emit('row-update', this, position, id, oldId);
            this.emit('rows-change', this, position, position);
        } else if (visible) {
            this._rows.splice(position, 0, row);
            this._sourceIndices.splice(position, 0, sourceIndex);
            this._invalidateIndex();

            this.emit('row-insert', this, position, id);
            this.emit('rows-change', this, position, this._rows.length - 1);
        } else if (wasVisible) {
            this._rows.splice(position, 1);
            this._sourceIndices.splice(position, 1);
            this._invalidateIndex();

            this.emit('row-remove', this, position, oldId, row);
            this.emit('rows-change', this, position, this._rows.length - 1);
        }
    }

    _onSourceCellChange(model, sourceIndex, column) {
        const position = this.fromSourceIndex(sourceIndex);
        if (position >= 0) {
            this.emit('cell-change', this, position, column);
        }
    }
}

/**
 * Declares a property that reads and writes the property of the source model.
 *
 * @param {string} name
 * @param {unknown} fallback The value without a source model.
 * @returns {import('../core/instance.js').PropertySpec}
 */
function sourceProperty(name, fallback) {
    return {
        signal: false,
        get() {
            return this._model ? this._model[name] : fallback;
        },
        set(value) {
            this._requireSource()[name] = value;

            return false;
        },
    };
}

defineProperties(FilteredListModel, {
    /**
     * The rows that pass the filters, in the order of the source. Do not modify the array.
     */
    rows: {
        readOnly: true,
        get() {
            return this._rows;
        },
    },

    /**
     * The source model.
     */
    model: {
        value: null,
        set(model) {
            if (model !== null && !(model instanceof AbstractModel)) {
                throw new TypeError('The source of a filtered model must be a model.');
            }

            if (model === this) {
                throw new Error('A filtered model cannot filter itself.');
            }

            this._setSource(model);
            this._resetRows();
        },
    },

    /**
     * The filters. A row is shown when it passes all of them. Setting an array replaces them.
     */
    filters: {
        signal: false,
        get() {
            return this._filters;
        },
        set(filters) {
            if (!Array.isArray(filters)) {
                throw new TypeError('Filters must be an array.');
            }

            for (const filter of filters) {
                if (!(filter instanceof Filter)) {
                    throw new TypeError('Only filters can be added to a filtered model.');
                }
            }

            for (const filter of this._filters) {
                filter.disconnect('change', this._onFilterChange, this);
                filter.disconnect('destroy', this._onFilterDestroy, this);
            }

            this._filters = [...new Set(filters)];

            for (const filter of this._filters) {
                filter.connect('change', this._onFilterChange, this);
                filter.connect('destroy', this._onFilterDestroy, this);
            }

            this._refilter();
            this.emit('filters-change', this);
        },
    },

    /**
     * The number of filters.
     */
    filtersCount: {
        readOnly: true,
        get() {
            return this._filters.length;
        },
    },

    columnsInfo: sourceProperty('columnsInfo', {}),

    idColumn: sourceProperty('idColumn', null),

    sortColumn: sourceProperty('sortColumn', null),

    sortOrder: sourceProperty('sortOrder', SortOrder.NONE),

    localeAware: sourceProperty('localeAware', true),
});

FilteredListModel.builderProperties = {
    filters(builder, model, filters) {
        if (!Array.isArray(filters)) {
            throw new Error('Filtered model filters must be an array.');
        }

        model.filters = builder.build(filters);
    },
};

registerType('filtered-list-model', FilteredListModel);
