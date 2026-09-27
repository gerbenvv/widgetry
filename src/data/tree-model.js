/**
 * @module data/tree-model
 */

import { SortOrder } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { AbstractModel } from './abstract-model.js';
import { Filter } from './filters/filter.js';

/**
 * When a change shows or hides more rows than this, listeners get one `rows-reorder` signal
 * instead of a `row-insert` or `row-remove` per row.
 *
 * @type {number}
 */
const INCREMENTAL_LIMIT = 200;

/**
 * The children of rows without children.
 *
 * @type {ReadonlyArray<object>}
 */
const NO_CHILDREN = Object.freeze([]);

function checkRow(row) {
    if (row === null || typeof row !== 'object') {
        throw new TypeError('A row must be an object.');
    }
}

/**
 * The state of a row in the tree.
 *
 * @typedef {object} TreeNode
 * @property {object | null} parent The parent row, or `null` for top-level rows.
 * @property {number} depth 0 for top-level rows.
 * @property {boolean} expanded Whether the row was expanded.
 * @property {boolean} loaded Whether the children of a lazy row were loaded.
 * @property {boolean} loading Whether the children of a lazy row are being loaded.
 * @property {boolean} recursive Whether to expand the children recursively once loaded.
 */

/**
 * How a row is shown in a tree, for tree views.
 *
 * @typedef {object} TreeRowInfo
 * @property {number} level The level of the row: 1 for top-level rows.
 * @property {number} position The position of the row among its shown siblings, from 1.
 * @property {number} size The number of shown siblings, including the row.
 * @property {boolean} expandable Whether the row has (shown or not yet loaded) children.
 * @property {boolean} expanded Whether the row is expanded.
 * @property {boolean} loading Whether the children of the row are being loaded.
 */

/**
 * A model of rows with children: a tree of plain row objects, where the children of a row are
 * an array in its `childrenColumn` (`'children'` by default). Tables show it as a tree view.
 *
 * As a model, it is the list of the *shown* rows: the top-level rows and, below every expanded
 * row, its shown children, in order. `rowsCount`, `getRow(index)` and the row signals are about
 * this list, so expanding and collapsing rows emits `row-insert` and `row-remove` (or
 * `rows-reorder`, for many rows at once). The tree methods (`expand()`, `getParent()`,
 * `insertChild()`, `removeRow()`, ...) take a row object, or the index of a shown row.
 *
 * Rows have ids: the value in `idColumn`, which must be unique in the whole tree, or without an id
 * column the row object itself. So selections keep their rows while rows are expanded, collapsed,
 * sorted and filtered (rows hidden in a collapsed row are unselected, like in GTK).
 *
 * Children can be loaded lazily: a row without children whose `hasChildrenColumn` is true shows
 * as expandable, and expanding it emits `load-children` and calls `loadChildren`, which returns
 * the children or a promise of them. The children can also be set later with `setChildren()`.
 *
 * Sorting (`sortColumn`, `sortOrder`) sorts every level, stably. Filters (`filters`, `addFilter()`)
 * show the rows that match, with their ancestors: a row is shown when it or one of its
 * descendants matches, and the ancestors of matching rows are expanded. Only loaded rows are
 * filtered. Filters that hide no rows are not in effect.
 *
 * The model keeps the children arrays of the rows up to date (and sorted): change the tree only
 * through the model.
 *
 * Signals: those of {@link AbstractModel}, and `row-expand` and `row-collapse` (`model, row`),
 * `load-children` (`model, row`), `load-error` (`model, row, error`) and `filters-change`.
 *
 * @example
 * const model = new TreeModel({
 *     rows: [
 *         { name: 'src', children: [{ name: 'index.js' }] },
 *         { name: 'docs', hasChildren: true },
 *     ],
 *     sortColumn: 'name',
 *     loadChildren: async (row) => (await fetch(`/api/files/${row.name}`)).json(),
 * });
 *
 * model.expand(model.getRow(1)); // Expands "src", showing "index.js".
 */
export class TreeModel extends AbstractModel {
    _initialize() {
        super._initialize();

        /**
         * The top-level rows, in order.
         *
         * @type {object[]}
         */
        this._rootRows = [];

        /** @type {Map<object, TreeNode>} */
        this._nodes = new Map();

        /**
         * All rows of the tree by id, with an id column.
         *
         * @type {Map<unknown, object> | null}
         */
        this._rowsById = null;

        /**
         * The sibling positions and shown children of the shown rows.
         *
         * @type {Map<object, {position: number, size: number, children: number}> | null}
         */
        this._layout = null;

        /** @type {Filter[]} */
        this._filters = [];

        /**
         * The rows hidden by the filters.
         *
         * @type {Set<object>}
         */
        this._hidden = new Set();

        /**
         * The rows expanded because a descendant matches the filters.
         *
         * @type {Set<object>}
         */
        this._revealed = new Set();

        // Changes are batched: the shown rows are updated once at the end of a change.
        this._batch = 0;
        this._dirty = undefined;
        this._filterStateDirty = false;
        this._queuedSignals = [];
    }

    /**
     * Rows always have ids: the value in `idColumn`, or the row object itself.
     *
     * @type {boolean}
     */
    get hasRowIds() {
        return true;
    }

    /**
     * Returns the id of a row: its value in `idColumn`, or the row itself without an id column.
     *
     * @param {object} row
     * @returns {unknown}
     */
    getRowId(row) {
        const idColumn = this.idColumn;

        return idColumn ? row[idColumn] : row;
    }

    getRowIdByIndex(index) {
        return this.getRowId(this.getRow(index));
    }

    /**
     * Gets a row of the tree by its id, also when it is not shown (with an id column; otherwise
     * the id is the row).
     *
     * @param {unknown} id
     * @returns {object}
     * @throws {RangeError} If there is no row with the id.
     */
    getRowById(id) {
        const row = this._findRow(id);
        if (!row) {
            throw new RangeError(`There is no row with id ${String(id)}.`);
        }

        return row;
    }

    /**
     * Returns the index of a row in the shown rows, or -1 when it is not shown (it is in a
     * collapsed row or filtered out) or not in the model.
     *
     * @param {object} row
     * @returns {number}
     */
    getRowIndex(row) {
        if (!this._nodes.has(row)) {
            return -1;
        }

        return this._getIndexById().get(this.getRowId(row)) ?? -1;
    }

    /**
     * Returns the index of the row with an id, or when that row is not shown, of its nearest
     * shown ancestor. Tables use it to keep the cursor near a row that was hidden.
     *
     * @param {unknown} id
     * @returns {number} The index, or -1 when the row is not in the tree or no ancestor is shown.
     */
    getNearestRowIndex(id) {
        for (let row = this._findRow(id); row; row = this._nodes.get(row).parent) {
            const index = this.getRowIndex(row);
            if (index >= 0) {
                return index;
            }
        }

        return -1;
    }

    /**
     * Returns the parent of a row, or `null` for top-level rows.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {object | null}
     */
    getParent(row) {
        return this._getNode(this._resolveRow(row)).parent;
    }

    /**
     * Returns the children of a row (all of them, also those filtered out), in order. Do not
     * modify the array.
     *
     * @param {object | number | null} row A row, the index of a shown row, or `null` for the
     *     top-level rows.
     * @returns {ReadonlyArray<object>}
     */
    getChildren(row) {
        return row === null ? this._rootRows : this._getChildren(this._resolveRow(row));
    }

    /**
     * Returns the depth of a row: 0 for top-level rows, 1 for their children and so on.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {number}
     */
    getDepth(row) {
        return this._getNode(this._resolveRow(row)).depth;
    }

    /**
     * Returns the level of a row, like `aria-level`: 1 for top-level rows.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {number}
     */
    getLevel(row) {
        return this.getDepth(row) + 1;
    }

    /**
     * Returns the path of a row: its index among its siblings, after those of its ancestors.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {number[]}
     */
    getPath(row) {
        const path = [];

        for (let current = this._resolveRow(row); current;) {
            const parent = this._nodes.get(current).parent;

            path.unshift(this.getChildren(parent).indexOf(current));
            current = parent;
        }

        return path;
    }

    /**
     * Returns the row at a path (see `getPath()`), or `null` if there is none.
     *
     * @param {number[]} path
     * @returns {object | null}
     */
    getRowByPath(path) {
        if (!Array.isArray(path) || !path.length) {
            return null;
        }

        let row = null;
        for (const index of path) {
            row = this.getChildren(row)[index];
            if (!row) {
                return null;
            }
        }

        return row;
    }

    /**
     * Whether a row has children, shown or still to be loaded.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {boolean}
     */
    hasChildren(row) {
        row = this._resolveRow(row);

        if (this._isLazy(row)) {
            return true;
        }

        const info = this._getLayout().get(row);

        return info ? info.children > 0 : this._getChildren(row).length > 0;
    }

    /**
     * Whether a row is expanded (also when it is expanded because a descendant matches the
     * filters).
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {boolean}
     */
    isExpanded(row) {
        return this._isOpen(this._resolveRow(row));
    }

    /**
     * Whether the children of a row are being loaded.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {boolean}
     */
    isLoading(row) {
        return this._getNode(this._resolveRow(row)).loading;
    }

    /**
     * Expands a row, showing its children. A lazy row loads its children first.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @param {boolean} [recursive] Whether to expand all descendants too.
     * @returns {boolean} Whether a row was expanded.
     */
    expand(row, recursive = false) {
        row = this._resolveRow(row);

        const wasOpen = this._isOpen(row);
        const expanded = [];

        this._batch += 1;
        try {
            this._expandRow(row, recursive, expanded);

            if (expanded.length) {
                // Expanding a collapsed row shows its shown descendants right after it.
                const index =
                    !recursive && !wasOpen && this._batch === 1 ? this.getRowIndex(row) : -1;
                if (index >= 0 && this._dirty === undefined) {
                    this._insertBlock(index + 1, this._collectRows(this._getChildren(row), []));
                } else {
                    this._markDirty(row);
                }

                for (const x of expanded) {
                    this._queueSignal('row-expand', x);
                }

                for (const x of expanded) {
                    this._load(x);
                }
            }
        } finally {
            this._endBatch();
        }

        return expanded.length > 0;
    }

    /**
     * Collapses a row, hiding its descendants.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @param {boolean} [recursive] Whether to collapse all descendants too.
     * @returns {boolean} Whether a row was collapsed.
     */
    collapse(row, recursive = false) {
        row = this._resolveRow(row);

        const wasOpen = this._isOpen(row);
        const collapsed = [];

        this._batch += 1;
        try {
            this._collapseRow(row, recursive, collapsed);

            if (collapsed.length && wasOpen) {
                // The shown descendants of a row follow it.
                const index = this._batch === 1 ? this.getRowIndex(row) : -1;
                if (index >= 0 && this._dirty === undefined) {
                    const depth = this._nodes.get(row).depth;
                    const rows = this._rows;

                    let end = index + 1;
                    while (end < rows.length && this._nodes.get(rows[end]).depth > depth) {
                        ++end;
                    }

                    this._removeBlock(index + 1, end - index - 1);
                } else {
                    this._markDirty(row);
                }
            }

            for (const x of collapsed) {
                this._queueSignal('row-collapse', x);
            }
        } finally {
            this._endBatch();
        }

        return collapsed.length > 0;
    }

    /**
     * Expands a collapsed row, or collapses an expanded row.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @param {boolean} [recursive] Whether to expand or collapse all descendants too.
     * @returns {boolean} Whether the row is expanded now.
     */
    toggle(row, recursive = false) {
        row = this._resolveRow(row);

        if (this._isOpen(row)) {
            this.collapse(row, recursive);
        } else {
            this.expand(row, recursive);
        }

        return this._isOpen(row);
    }

    /**
     * Expands the ancestors of a row, so it is shown (unless it is filtered out).
     *
     * @param {object | number} row A row, or the index of a shown row.
     */
    expandTo(row) {
        row = this._resolveRow(row);

        this._batch += 1;
        try {
            const ancestors = [];
            for (let parent = this._nodes.get(row).parent; parent;) {
                ancestors.unshift(parent);
                parent = this._nodes.get(parent).parent;
            }

            for (const ancestor of ancestors) {
                this.expand(ancestor);
            }
        } finally {
            this._endBatch();
        }
    }

    /**
     * Expands all rows. Lazy rows load their children, which are expanded as well.
     */
    expandAll() {
        this._batch += 1;
        try {
            const expanded = [];
            for (const row of this._rootRows) {
                this._expandRow(row, true, expanded);
            }

            if (expanded.length) {
                this._markDirty(null);
            }

            for (const x of expanded) {
                this._queueSignal('row-expand', x);
            }

            for (const x of expanded) {
                this._load(x);
            }
        } finally {
            this._endBatch();
        }
    }

    /**
     * Collapses all rows, so only the top-level rows are shown.
     */
    collapseAll() {
        this._batch += 1;
        try {
            const collapsed = [];
            for (const row of this._rootRows) {
                this._collapseRow(row, true, collapsed);
            }

            if (collapsed.length) {
                this._markDirty(null);
            }

            for (const x of collapsed) {
                this._queueSignal('row-collapse', x);
            }
        } finally {
            this._endBatch();
        }
    }

    /**
     * Inserts a row (with its children) as a child of another row. If the model is sorted, the
     * row is placed at its sorted position instead.
     *
     * @param {object | number | null} parent A row, the index of a shown row, or `null` for a
     *     top-level row.
     * @param {number} index The index among the children, between 0 and their number.
     * @param {object} row
     * @returns {number} The index of the row in the shown rows, or -1 when it is not shown.
     * @throws {Error} If the row is already in the model or its id is in use.
     */
    insertChild(parent, index, row) {
        row = this._insertChild(parent, index, row);

        return this.getRowIndex(row);
    }

    /**
     * Inserts a row as a child of another row, like `insertChild()`, without looking up its
     * index, which takes the time of building the id index when many rows are inserted.
     *
     * @param {object | number | null} parent
     * @param {number} index
     * @param {object} row
     * @returns {object} The row.
     */
    _insertChild(parent, index, row) {
        parent = parent === null ? null : this._resolveRow(parent);

        const siblings = parent === null ? this._rootRows : this._getChildren(parent);
        if (!Number.isInteger(index) || index < 0 || index > siblings.length) {
            throw new RangeError(`Invalid child insertion index ${index}.`);
        }

        const depth = parent === null ? 0 : this._nodes.get(parent).depth + 1;
        const nodes = this._prepareNodes([row], parent, depth);

        this._batch += 1;
        try {
            this._commitNodes(nodes);

            let children = siblings;
            if (parent !== null && !Array.isArray(parent[this.childrenColumn])) {
                children = [];
                parent[this.childrenColumn] = children;
            }

            const compare = this._createSortComparator();
            if (compare) {
                this._sortRows(this._getChildren(row), compare);
                index = this._findInsertIndex(children, row, compare);
            }

            children.splice(index, 0, row);
            this._onTreeChange(parent);
        } finally {
            this._endBatch();
        }

        return row;
    }

    /**
     * Appends a row (with its children) to the children of another row. If the model is sorted,
     * the row is placed at its sorted position instead.
     *
     * @param {object | number | null} parent A row, the index of a shown row, or `null` for a
     *     top-level row.
     * @param {object} row
     * @returns {number} The index of the row in the shown rows, or -1 when it is not shown.
     */
    appendChild(parent, row) {
        return this.insertChild(parent, this.getChildren(parent).length, row);
    }

    /**
     * Replaces the children of a row, e.g. once lazily loaded children arrived.
     *
     * @param {object | number | null} parent A row, the index of a shown row, or `null` to
     *     replace the top-level rows.
     * @param {object[]} children The new children. The array is copied, the rows are not.
     */
    setChildren(parent, children) {
        if (parent === null) {
            this.rows = children;

            return;
        }

        parent = this._resolveRow(parent);
        if (!Array.isArray(children)) {
            throw new TypeError('Children must be an array.');
        }

        const node = this._nodes.get(parent);
        const old = this._getChildren(parent);
        const nodes = this._prepareNodes(children, parent, node.depth + 1, this._collectTree(old));

        this._batch += 1;
        try {
            this._unregister(old);
            this._commitNodes(nodes);

            const array = [...children];
            const compare = this._createSortComparator();
            if (compare) {
                this._sortRows(array, compare);
            }

            parent[this.childrenColumn] = array;

            const recursive = node.recursive;
            node.loaded = true;
            node.loading = false;
            node.recursive = false;

            if (!array.length) {
                node.expanded = false;
            }

            this._onTreeChange(parent);

            if (recursive && node.expanded) {
                const expanded = [];
                for (const child of array) {
                    this._expandRow(child, true, expanded);
                }

                for (const x of expanded) {
                    this._queueSignal('row-expand', x);
                }

                for (const x of expanded) {
                    this._load(x);
                }
            }
        } finally {
            this._endBatch();
        }
    }

    /**
     * Inserts a row before the shown row at an index, as its sibling, or at the end of the
     * top-level rows. If the model is sorted, the row is placed at its sorted position instead.
     *
     * @param {number} index Between 0 and `rowsCount`.
     * @param {object} row
     * @returns {number} The index the row got, or -1 when it is not shown.
     */
    insertRow(index, row) {
        const { parent, position } = this._getInsertPosition(index);

        return this.insertChild(parent, position, row);
    }

    insertRows(index, rows) {
        if (!Array.isArray(rows)) {
            throw new TypeError('Rows must be an array.');
        }

        const { parent, position } = this._getInsertPosition(index);

        this._batch += 1;
        try {
            rows.forEach((row, i) => this._insertChild(parent, position + i, row));
        } finally {
            this._endBatch();
        }
    }

    /**
     * Removes a row with its descendants.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {object} The removed row.
     */
    removeRow(row) {
        row = this._resolveRow(row);

        const parent = this._nodes.get(row).parent;
        const siblings = parent === null ? this._rootRows : this._getChildren(parent);

        this._batch += 1;
        try {
            siblings.splice(siblings.indexOf(row), 1);
            this._unregister([row]);

            // Like GTK, a row without children is no longer expanded.
            if (parent !== null && !siblings.length) {
                this._nodes.get(parent).expanded = false;
            }

            this._onTreeChange(parent);
        } finally {
            this._endBatch();
        }

        return row;
    }

    removeAllRows() {
        this.rows = [];
    }

    /**
     * Replaces a row by another row object (with its children), at the same place in the tree.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @param {object} newRow
     * @returns {number} The index of the new row, or -1 when it is not shown.
     */
    replaceRow(row, newRow) {
        row = this._resolveRow(row);
        checkRow(newRow);

        const parent = this._nodes.get(row).parent;
        const position = this.getChildren(parent).indexOf(row);

        this._batch += 1;
        try {
            this.removeRow(row);
            this.insertChild(parent, position, newRow);
        } finally {
            this._endBatch();
        }

        return this.getRowIndex(newRow);
    }

    /**
     * Changes values of a row: the given columns are assigned to the row object. The siblings stay
     * sorted, so the row may move. Changing the `childrenColumn` replaces the children.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @param {Record<string, unknown>} changes Values by column.
     * @returns {number} The index of the row after the change, or -1 when it is not shown.
     */
    updateRow(row, changes) {
        row = this._resolveRow(row);
        if (changes === null || typeof changes !== 'object') {
            throw new TypeError('Row changes must be an object.');
        }

        const childrenColumn = this.childrenColumn;
        const columns = Object.keys(changes).filter(
            (column) => column !== childrenColumn && !Object.is(row[column], changes[column])
        );

        if (childrenColumn in changes && changes[childrenColumn] !== row[childrenColumn]) {
            this.setChildren(row, changes[childrenColumn] || []);
        }

        if (!columns.length) {
            return this.getRowIndex(row);
        }

        const idColumn = this.idColumn;
        const oldId = this.getRowId(row);
        const from = this.getRowIndex(row);

        if (idColumn && columns.includes(idColumn)) {
            const id = changes[idColumn];
            if (this._getRowsById().has(id)) {
                throw new Error(`Duplicate row id ${String(id)}.`);
            }
        }

        for (const column of columns) {
            row[column] = changes[column];
        }

        if (idColumn && columns.includes(idColumn)) {
            this._rowsById = null;
            this._invalidateIndex();
        }

        // Keep the siblings sorted.
        let moved = false;
        const compare = this._createSortComparator();
        if (
            compare &&
            (columns.includes(this.sortColumn) || this.getColumnInfo(this.sortColumn).compare)
        ) {
            const siblings = this.getChildren(this._nodes.get(row).parent);
            const position = siblings.indexOf(row);

            siblings.splice(position, 1);
            const newPosition = this._findInsertIndex(siblings, row, compare);
            siblings.splice(newPosition, 0, row);

            moved = newPosition !== position;
        }

        if (this._filters.length) {
            this._computeFilterState();
        }

        if (moved || this._filters.length) {
            this._layout = null;

            const rows = this._collectRows(this._rootRows, []);
            const to = rows.indexOf(row);

            if (!this._filters.length && from >= 0 && to >= 0 && this._isMove(rows, from, to)) {
                // Only the row moved: move it.
                this._rows.splice(from, 1);
                this._rows.splice(to, 0, row);
                this._invalidateIndex();

                this.emit('row-move', this, from, to, oldId);
            } else {
                this._applyRows(rows, moved ? null : undefined);
            }
        }

        const index = this.getRowIndex(row);
        if (index >= 0) {
            for (const column of columns) {
                this.emit('cell-change', this, index, column);
            }

            this.emit('row-update', this, index, this.getRowId(row), oldId);

            const start = from >= 0 ? Math.min(from, index) : index;
            this.emit('rows-change', this, start, Math.max(from, index));
        }

        return index;
    }

    /**
     * Calls a function for every row of the tree (also those that are not shown), depth first.
     *
     * @param {(row: object, depth: number, parent: object | null) => void} method
     * @param {object} [context]
     */
    forEachTreeRow(method, context) {
        const visit = (rows, depth, parent) => {
            for (const row of [...rows]) {
                method.call(context, row, depth, parent);
                visit(this._getChildren(row), depth + 1, row);
            }
        };

        visit(this._rootRows, 0, null);
    }

    sortByColumn(column, order = SortOrder.ASCENDING) {
        if (
            order !== SortOrder.NONE &&
            order !== SortOrder.ASCENDING &&
            order !== SortOrder.DESCENDING
        ) {
            throw new RangeError(`Invalid sort order '${order}'.`);
        }

        if (!column) {
            column = null;
            order = SortOrder.NONE;
        } else if (order === SortOrder.NONE) {
            column = null;
        }

        const columnChanged = this._sortColumn !== column;
        const orderChanged = this._sortOrder !== order;

        this._sortColumn = column;
        this._sortOrder = order;

        if (columnChanged) {
            this.emit('sort-column-change', this);
        }

        if (orderChanged) {
            this.emit('sort-order-change', this);
        }

        if (columnChanged || orderChanged) {
            this._onSortingChange();
        }
    }

    /**
     * Adds a filter.
     *
     * @param {Filter} filter
     * @throws {Error} If the filter was already added.
     */
    addFilter(filter) {
        if (!(filter instanceof Filter)) {
            throw new TypeError('Only filters can be added to a tree model.');
        }

        if (this._filters.includes(filter)) {
            throw new Error('The filter has already been added.');
        }

        this.filters = [...this._filters, filter];
    }

    /**
     * Removes a filter.
     *
     * @param {Filter} filter
     * @throws {Error} If the filter was not added.
     */
    removeFilter(filter) {
        if (!this._filters.includes(filter)) {
            throw new Error('The filter has not been added.');
        }

        this.filters = this._filters.filter((x) => x !== filter);
    }

    /**
     * Removes all filters, so all rows are shown again.
     */
    removeAllFilters() {
        this.filters = [];
    }

    /**
     * Filters all rows again. Filters signal their changes themselves; call this when a filter
     * depends on outside state that changed.
     */
    refilter() {
        this._refilter();
    }

    /**
     * Checks whether a row matches all filters (whatever its descendants).
     *
     * @param {object} row
     * @returns {boolean}
     */
    matchesFilters(row) {
        const filters = this._filters;

        for (let i = 0; i < filters.length; ++i) {
            if (!filters[i].isVisibleRow(row)) {
                return false;
            }
        }

        return true;
    }

    destroy() {
        // Like filtered list models, the tree model owns its filters.
        for (const filter of this._filters) {
            filter.disconnect('change', this._onFilterChange, this);
            filter.disconnect('destroy', this._onFilterDestroy, this);

            if (!filter.destroyed) {
                filter.destroy();
            }
        }

        this._filters = [];

        super.destroy();
    }

    /**
     * Returns how a row is shown, for tree views.
     *
     * @protected
     * @param {object} row A shown row.
     * @returns {TreeRowInfo}
     */
    _getRowInfo(row) {
        const node = this._getNode(row);
        const info = this._getLayout().get(row);
        const expandable = this._isLazy(row) || (info ? info.children > 0 : false);

        return {
            level: node.depth + 1,
            position: info ? info.position : 1,
            size: info ? info.size : 1,
            expandable,
            expanded: expandable && this._isOpen(row),
            loading: node.loading,
        };
    }

    _getIndexById() {
        if (this._indexDirty || !this._indexById) {
            const index = new Map();
            const rows = this._rows;
            const idColumn = this.idColumn;

            for (let i = 0; i < rows.length; ++i) {
                index.set(idColumn ? rows[i][idColumn] : rows[i], i);
            }

            this._indexById = index;
            this._indexDirty = false;
        }

        return this._indexById;
    }

    /**
     * Returns all rows of the tree by id, building the index when the tree changed.
     *
     * @returns {Map<unknown, object>}
     */
    _getRowsById() {
        const idColumn = this.idColumn;
        if (!idColumn) {
            throw new Error('The model has no id column.');
        }

        if (!this._rowsById) {
            const rows = new Map();

            for (const row of this._nodes.keys()) {
                const id = row[idColumn];
                if (rows.has(id)) {
                    throw new Error(`Duplicate row id ${String(id)}.`);
                }

                rows.set(id, row);
            }

            this._rowsById = rows;
        }

        return this._rowsById;
    }

    /**
     * Checks that all rows of the tree, also those in collapsed rows, have a different value in
     * a column.
     *
     * @protected
     * @param {string} column
     * @throws {Error} If two rows have the same id.
     */
    _checkUniqueIds(column) {
        const ids = new Set();

        for (const row of this._nodes.keys()) {
            const id = row[column];
            if (ids.has(id)) {
                throw new Error(`Duplicate row id ${String(id)}.`);
            }

            ids.add(id);
        }
    }

    _findRow(id) {
        if (!this.idColumn) {
            return this._nodes.has(id) ? id : null;
        }

        return this._getRowsById().get(id) || null;
    }

    _resolveRow(row) {
        if (typeof row === 'number') {
            return this.getRow(row);
        }

        this._getNode(row);

        return row;
    }

    _getNode(row) {
        const node = row !== null && typeof row === 'object' ? this._nodes.get(row) : undefined;
        if (!node) {
            throw new Error('The row is not in the model.');
        }

        return node;
    }

    _getChildren(row) {
        const children = row[this.childrenColumn];

        return Array.isArray(children) ? children : NO_CHILDREN;
    }

    /**
     * Whether a row has children that are not loaded yet.
     *
     * @param {object} row
     * @returns {boolean}
     */
    _isLazy(row) {
        const column = this.hasChildrenColumn;

        return (
            Boolean(column && row[column]) &&
            !this._nodes.get(row).loaded &&
            !this._getChildren(row).length
        );
    }

    _isOpen(row) {
        return this._nodes.get(row).expanded || this._revealed.has(row);
    }

    /**
     * Collects the shown rows of a tree, depth first.
     *
     * @param {ReadonlyArray<object>} children
     * @param {object[]} rows The array to add the rows to.
     * @returns {object[]} `rows`.
     */
    _collectRows(children, rows) {
        const hidden = this._hidden;
        const childrenColumn = this.childrenColumn;

        for (const row of children) {
            if (hidden.size && hidden.has(row)) {
                continue;
            }

            rows.push(row);

            const grandchildren = row[childrenColumn];
            if (Array.isArray(grandchildren) && grandchildren.length && this._isOpen(row)) {
                this._collectRows(grandchildren, rows);
            }
        }

        return rows;
    }

    /**
     * Collects all rows of subtrees.
     *
     * @param {ReadonlyArray<object>} rows
     * @param {Set<object>} [collected]
     * @returns {Set<object>}
     */
    _collectTree(rows, collected = new Set()) {
        for (const row of rows) {
            collected.add(row);
            this._collectTree(this._getChildren(row), collected);
        }

        return collected;
    }

    /**
     * Creates the nodes of new subtrees, checking that their rows and ids are not in use.
     *
     * @param {object[]} rows
     * @param {object | null} parent
     * @param {number} depth
     * @param {Set<object>} [replaced] Rows that are replaced, whose ids may be reused.
     * @param {boolean} [all] Whether all rows are replaced.
     * @returns {Map<object, TreeNode>}
     */
    _prepareNodes(rows, parent, depth, replaced = new Set(), all = false) {
        const nodes = new Map();
        const childrenColumn = this.childrenColumn;

        const visit = (children, parentRow, level) => {
            for (const row of children) {
                checkRow(row);

                if (nodes.has(row) || (!all && this._nodes.has(row) && !replaced.has(row))) {
                    throw new Error('A row can be in a tree model only once.');
                }

                // Keep the state of rows that are replaced by themselves.
                const old = this._nodes.get(row);
                nodes.set(row, {
                    parent: parentRow,
                    depth: level,
                    expanded: old ? old.expanded : false,
                    loaded: old ? old.loaded : false,
                    loading: false,
                    recursive: false,
                });

                const grandchildren = row[childrenColumn];
                if (Array.isArray(grandchildren)) {
                    visit(grandchildren, row, level + 1);
                }
            }
        };

        visit(rows, parent, depth);

        const idColumn = this.idColumn;
        if (idColumn) {
            const existing = all ? new Map() : this._getRowsById();
            const ids = new Set();

            for (const row of nodes.keys()) {
                const id = row[idColumn];
                const owner = existing.get(id);

                if (ids.has(id) || (owner && !replaced.has(owner))) {
                    throw new Error(`Duplicate row id ${String(id)}.`);
                }

                ids.add(id);
            }
        }

        return nodes;
    }

    _commitNodes(nodes) {
        const idColumn = this.idColumn;
        const rowsById = idColumn ? this._rowsById : null;

        for (const [row, node] of nodes) {
            this._nodes.set(row, node);

            // Keep the id index up to date, instead of building it again.
            rowsById?.set(row[idColumn], row);
        }
    }

    _unregister(rows) {
        const idColumn = this.idColumn;

        for (const row of rows) {
            this._nodes.delete(row);
            this._revealed.delete(row);

            if (idColumn && this._rowsById?.get(row[idColumn]) === row) {
                this._rowsById.delete(row[idColumn]);
            }

            this._unregister(this._getChildren(row));
        }
    }

    /**
     * Sorts rows and all their loaded descendants.
     *
     * @param {object[]} rows
     * @param {(first: object, second: object) => number} compare
     */
    _sortRows(rows, compare) {
        // Array.prototype.sort is stable.
        if (rows.length > 1) {
            rows.sort(compare);
        }

        for (const row of rows) {
            const children = this._getChildren(row);
            if (children.length) {
                this._sortRows(children, compare);
            }
        }
    }

    /**
     * Expands a row and optionally its descendants, without updating the shown rows.
     *
     * @param {object} row
     * @param {boolean} recursive
     * @param {object[]} expanded Receives the rows that were expanded.
     */
    _expandRow(row, recursive, expanded) {
        const node = this._nodes.get(row);
        const lazy = this._isLazy(row);
        const children = this._getChildren(row);

        if (!lazy && !children.length) {
            return;
        }

        if (!this._isOpen(row)) {
            expanded.push(row);
        }

        node.expanded = true;

        if (lazy) {
            node.recursive = node.recursive || recursive;
        } else if (recursive) {
            for (const child of children) {
                this._expandRow(child, true, expanded);
            }
        }
    }

    /**
     * Collapses a row and optionally its descendants, without updating the shown rows.
     *
     * @param {object} row
     * @param {boolean} recursive
     * @param {object[]} collapsed Receives the rows that were collapsed.
     */
    _collapseRow(row, recursive, collapsed) {
        const node = this._nodes.get(row);

        if (this._isOpen(row)) {
            collapsed.push(row);
        }

        node.expanded = false;
        node.recursive = false;
        this._revealed.delete(row);

        if (recursive) {
            for (const child of this._getChildren(row)) {
                this._collapseRow(child, true, collapsed);
            }
        }
    }

    /**
     * Loads the children of a lazy row: emits `load-children` and calls `loadChildren`.
     *
     * @param {object} row
     */
    _load(row) {
        const node = this._nodes.get(row);
        if (!node || node.loading || !node.expanded || !this._isLazy(row)) {
            return;
        }

        node.loading = true;
        this.emit('load-children', this, row);

        // A handler may have set the children already.
        const loader = this._loadChildren;
        if (!node.loading || !loader) {
            return;
        }

        let result;
        try {
            result = loader(row, this);
        } catch (error) {
            this._onLoadError(row, node, error);

            return;
        }

        if (result && typeof result.then === 'function') {
            // Show the loading state.
            this._markDirty(row);

            result.then(
                (children) => {
                    if (!this.destroyed && this._nodes.get(row) === node && node.loading) {
                        this.setChildren(row, children || []);
                    }
                },
                (error) => {
                    if (!this.destroyed && this._nodes.get(row) === node && node.loading) {
                        this._onLoadError(row, node, error);
                    }
                }
            );
        } else if (result !== undefined) {
            this.setChildren(row, result || []);
        }
    }

    _onLoadError(row, node, error) {
        node.loading = false;
        node.recursive = false;

        this.collapse(row);
        this._emitRowChange(row);

        // Report errors nobody handles.
        if (!this.emit('load-error', this, row, error)) {
            queueMicrotask(() => {
                throw error;
            });
        }
    }

    _emitRowChange(row) {
        const index = this.getRowIndex(row);
        if (index >= 0 && !this._batch) {
            this.emit('rows-change', this, index, index);
        } else if (index >= 0) {
            this._markDirty(row);
        }
    }

    _getInsertPosition(index) {
        const count = this._rows.length;
        if (!Number.isInteger(index) || index < 0 || index > count) {
            throw new RangeError(`Invalid row insertion index ${index}.`);
        }

        if (index === count) {
            return { parent: null, position: this._rootRows.length };
        }

        const before = this._rows[index];
        const parent = this._nodes.get(before).parent;

        return { parent, position: this.getChildren(parent).indexOf(before) };
    }

    /**
     * Whether the shown rows are the current ones with one row moved.
     *
     * @param {object[]} rows
     * @param {number} from
     * @param {number} to
     * @returns {boolean}
     */
    _isMove(rows, from, to) {
        const old = this._rows;
        if (rows.length !== old.length) {
            return false;
        }

        const start = Math.min(from, to);
        const end = Math.max(from, to);
        const shift = from < to ? 1 : -1;

        for (let i = start; i <= end; ++i) {
            const expected = i === to ? old[from] : old[i + shift];
            if (rows[i] !== expected) {
                return false;
            }
        }

        return true;
    }

    /**
     * Updates the state after rows were added to or removed from the tree.
     *
     * @param {object | null} parent The row whose children changed, or `null`.
     */
    _onTreeChange(parent) {
        this._layout = null;

        // The filter state is computed once at the end of the change, not for every row.
        if (this._filters.length) {
            this._filterStateDirty = true;
        }

        this._markDirty(parent);
    }

    /**
     * Marks the shown rows as outdated, so they are updated at the end of the change.
     *
     * @param {object | null} row The row from which rows need to be rendered again, or `null`
     *     for all rows.
     */
    _markDirty(row) {
        if (this._dirty === undefined) {
            this._dirty = row;
        } else if (this._dirty !== row) {
            this._dirty = null;
        }

        if (!this._batch) {
            this._endBatch(true);
        }
    }

    _queueSignal(name, row) {
        this._queuedSignals.push([name, row]);
    }

    /**
     * Ends a change: updates the shown rows and emits the queued signals.
     *
     * @param {boolean} [unbatched] Whether the change was not in a batch.
     */
    _endBatch(unbatched = false) {
        if (!unbatched) {
            this._batch -= 1;
        }

        if (this._batch) {
            return;
        }

        if (this._filterStateDirty) {
            this._computeFilterState();
            this._layout = null;
        }

        if (this._dirty !== undefined) {
            const dirty = this._dirty;
            this._dirty = undefined;

            this._applyRows(this._collectRows(this._rootRows, []), dirty);
        }

        const signals = this._queuedSignals;
        this._queuedSignals = [];

        for (const [name, row] of signals) {
            if (this._nodes.has(row)) {
                this.emit(name, this, row);
            }
        }
    }

    /**
     * Inserts shown rows at an index, signaling them.
     *
     * @param {number} index
     * @param {object[]} rows
     */
    _insertBlock(index, rows) {
        if (rows.length > INCREMENTAL_LIMIT) {
            const old = this._rows;
            this._resetRows(old.slice(0, index).concat(rows, old.slice(index)));

            return;
        }

        this._rows.splice(index, 0, ...rows);
        this._invalidateIndex();

        rows.forEach((row, i) => this.emit('row-insert', this, index + i, this.getRowId(row)));
        this.emit('rows-change', this, Math.max(0, index - 1), this._rows.length - 1);
    }

    /**
     * Removes shown rows at an index, signaling them.
     *
     * @param {number} index
     * @param {number} count
     */
    _removeBlock(index, count) {
        if (count > INCREMENTAL_LIMIT) {
            const old = this._rows;
            this._resetRows(old.slice(0, index).concat(old.slice(index + count)));

            return;
        }

        const removed = this._rows.splice(index, count);
        this._invalidateIndex();

        for (const row of removed) {
            this.emit('row-remove', this, index, this.getRowId(row), row);
        }

        this.emit('rows-change', this, Math.max(0, index - 1), this._rows.length - 1);
    }

    _resetRows(rows) {
        this._rows = rows;
        this._invalidateIndex();

        this.emit('rows-reorder', this);
        this.emit('rows-change', this, 0, rows.length - 1);
    }

    /**
     * Makes the shown rows the given rows, signaling only the rows that appear and disappear.
     * Both lists must be in tree order; otherwise (after sorting) all rows are signaled as
     * reordered.
     *
     * @param {object[]} rows
     * @param {object | null | undefined} dirty The row from which rows need to be rendered
     *     again, `null` for all rows, or `undefined`.
     */
    _applyRows(rows, dirty) {
        const old = this._rows;
        const oldRows = new Set(old);
        const newRows = new Set(rows);

        // Count the differences, checking that the order is the same.
        let changes = 0;
        for (let i = 0, j = 0; i < old.length || j < rows.length;) {
            if (i < old.length && j < rows.length && old[i] === rows[j]) {
                ++i;
                ++j;
                continue;
            }

            if (i < old.length && !newRows.has(old[i])) {
                ++i;
            } else if (j < rows.length && !oldRows.has(rows[j])) {
                ++j;
            } else {
                changes = Infinity;
            }

            if (++changes > INCREMENTAL_LIMIT) {
                this._resetRows(rows);

                return;
            }
        }

        let first = -1;
        if (changes) {
            this._rows = [...old];

            let position = 0;
            for (let i = 0, j = 0; i < old.length || j < rows.length;) {
                if (i < old.length && j < rows.length && old[i] === rows[j]) {
                    ++position;
                    ++i;
                    ++j;
                } else if (i < old.length && !newRows.has(old[i])) {
                    // The row is no longer shown.
                    const row = old[i];

                    this._rows.splice(position, 1);
                    this._invalidateIndex();

                    first = first < 0 ? position : first;
                    this.emit('row-remove', this, position, this.getRowId(row), row);

                    ++i;
                } else {
                    // The row is shown now.
                    const row = rows[j];

                    this._rows.splice(position, 0, row);
                    this._invalidateIndex();

                    first = first < 0 ? position : first;
                    this.emit('row-insert', this, position, this.getRowId(row));

                    ++position;
                    ++j;
                }
            }
        }

        let start = first;
        if (dirty === null) {
            start = 0;
        } else if (dirty !== undefined) {
            const index = this.getRowIndex(dirty);
            start = index >= 0 && (start < 0 || index < start) ? index : start;
        }

        if (start >= 0 || changes) {
            this.emit('rows-change', this, Math.max(0, start), this._rows.length - 1);
        }
    }

    /**
     * Returns the positions of the shown rows among their shown siblings, and their numbers of
     * shown children.
     *
     * @returns {Map<object, {position: number, size: number, children: number}>}
     */
    _getLayout() {
        if (!this._layout) {
            const layout = new Map();
            const hidden = this._hidden;

            const visit = (rows) => {
                const shown = hidden.size ? rows.filter((x) => !hidden.has(x)) : rows;

                shown.forEach((row, i) => {
                    const children = this._getChildren(row);

                    layout.set(row, {
                        position: i + 1,
                        size: shown.length,
                        children: children.length ? visit(children) : 0,
                    });
                });

                return shown.length;
            };

            visit(this._rootRows);
            this._layout = layout;
        }

        return this._layout;
    }

    /**
     * Computes which rows the filters hide, and which rows they expand.
     */
    _computeFilterState() {
        this._filterStateDirty = false;
        this._hidden = new Set();
        this._revealed = new Set();

        if (!this._filters.length) {
            return;
        }

        const hidden = new Set();
        const revealed = new Set();

        // Returns whether any of the rows is shown.
        const visit = (rows) => {
            let shown = false;

            for (const row of rows) {
                const children = this._getChildren(row);
                const childShown = children.length ? visit(children) : false;

                if (childShown) {
                    revealed.add(row);
                }

                if (childShown || this.matchesFilters(row)) {
                    shown = true;
                } else {
                    hidden.add(row);
                }
            }

            return shown;
        };

        visit(this._rootRows);

        // Filters that hide no rows are not in effect, so the rows are not expanded either.
        if (hidden.size) {
            this._hidden = hidden;
            this._revealed = revealed;
        }
    }

    _refilter() {
        this._computeFilterState();
        this._layout = null;
        this._markDirty(null);
    }

    _onFilterChange() {
        this._refilter();
    }

    _onFilterDestroy(filter) {
        if (this._filters.includes(filter)) {
            this.removeFilter(filter);
        }
    }

    _setRows(rows) {
        if (!Array.isArray(rows)) {
            throw new TypeError('Rows must be an array.');
        }

        const nodes = this._prepareNodes(rows, null, 0, new Set(), true);

        this._nodes = nodes;
        this._rowsById = null;
        this._rootRows = [...rows];

        const compare = this._createSortComparator();
        if (compare) {
            this._sortRows(this._rootRows, compare);
        }

        this._computeFilterState();
        this._layout = null;
        this._resetRows(this._collectRows(this._rootRows, []));
    }

    _onSortingChange() {
        const compare = this._createSortComparator();
        if (!compare) {
            return;
        }

        this._sortRows(this._rootRows, compare);
        this._layout = null;
        this._resetRows(this._collectRows(this._rootRows, []));
    }
}

defineProperties(TreeModel, {
    /**
     * The shown rows, in order: the top-level rows and the shown children of expanded rows. Do
     * not modify the array. Setting it replaces the tree with the given top-level rows (the array
     * is copied, the row objects and their children arrays are not).
     */
    rows: {
        signal: false,
        late: true,
        get() {
            return this._rows;
        },
        set(rows) {
            this._setRows(rows);
        },
    },

    /**
     * The top-level rows, in order. Do not modify the array.
     */
    rootRows: {
        readOnly: true,
        get() {
            return this._rootRows;
        },
    },

    /**
     * The column that holds the array of children of a row.
     */
    childrenColumn: {
        value: 'children',
        changed() {
            this._setRows(this._rootRows);
        },
    },

    /**
     * The column that tells whether a row without children has children to load lazily, or
     * `null`.
     */
    hasChildrenColumn: {
        value: 'hasChildren',
        changed() {
            this._layout = null;
            this._markDirty(null);
        },
    },

    /**
     * A function `(row, model)` returning the children of a lazy row, or a promise of them, or
     * `null`. It is called when the row is expanded for the first time, after `load-children`.
     * Without it, a `load-children` handler calls `setChildren()` once it has the children.
     */
    loadChildren: {
        value: null,
        coerce(method) {
            if (method !== null && typeof method !== 'function') {
                throw new TypeError('The children loader must be a function or null.');
            }

            return method;
        },
    },

    idColumn: {
        value: null,
        changed() {
            this._invalidateIndex();
            this._rowsById = null;
        },
    },

    /**
     * The filters. A row is shown when it or one of its descendants matches all of them. Setting
     * an array replaces them.
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
                    throw new TypeError('Only filters can be added to a tree model.');
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
});

TreeModel.builderProperties = {
    filters(builder, model, filters) {
        if (!Array.isArray(filters)) {
            throw new Error('Tree model filters must be an array.');
        }

        model.filters = builder.build(filters);
    },
};

registerType('tree-model', TreeModel);
