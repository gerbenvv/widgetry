/**
 * @module data/tree-model
 */
import { AbstractModel } from './abstract-model.js';
import { Filter } from './filters/filter.js';
export type TreeNode = {
    /**
     * The parent row, or `null` for top-level rows.
     */
    parent: object | null;
    /**
     * 0 for top-level rows.
     */
    depth: number;
    /**
     * Whether the row was expanded.
     */
    expanded: boolean;
    /**
     * Whether the children of a lazy row were loaded.
     */
    loaded: boolean;
    /**
     * Whether the children of a lazy row are being loaded.
     */
    loading: boolean;
    /**
     * Whether to expand the children recursively once loaded.
     */
    recursive: boolean;
};
export type TreeRowInfo = {
    /**
     * The level of the row: 1 for top-level rows.
     */
    level: number;
    /**
     * The position of the row among its shown siblings, from 1.
     */
    position: number;
    /**
     * The number of shown siblings, including the row.
     */
    size: number;
    /**
     * Whether the row has (shown or not yet loaded) children.
     */
    expandable: boolean;
    /**
     * Whether the row is expanded.
     */
    expanded: boolean;
    /**
     * Whether the children of the row are being loaded.
     */
    loading: boolean;
};
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
export declare class TreeModel extends AbstractModel {
    /**
     * The top-level rows, in order.
     *
     * @type {object[]}
     */
    _rootRows: object[];
    /** @type {Map<object, TreeNode>} */
    _nodes: Map<object, TreeNode>;
    /**
     * All rows of the tree by id, with an id column.
     *
     * @type {Map<unknown, object> | null}
     */
    _rowsById: Map<unknown, object> | null;
    /**
     * The sibling positions and shown children of the shown rows.
     *
     * @type {Map<object, {position: number, size: number, children: number}> | null}
     */
    _layout: Map<object, {
        position: number;
        size: number;
        children: number;
    }> | null;
    /** @type {Filter[]} */
    _filters: Filter[];
    /**
     * The rows hidden by the filters.
     *
     * @type {Set<object>}
     */
    _hidden: Set<object>;
    /**
     * The rows expanded because a descendant matches the filters.
     *
     * @type {Set<object>}
     */
    _revealed: Set<object>;
    _batch: number;
    _dirty: object;
    _queuedSignals: any[];
    rows: any[] | object[];
    _sortColumn: any;
    _sortOrder: 1;
    filters: any[] | Filter[];
    _initialize(): void;
    /**
     * Rows always have ids: the value in `idColumn`, or the row object itself.
     *
     * @type {boolean}
     */
    get hasRowIds(): boolean;
    /**
     * Returns the id of a row: its value in `idColumn`, or the row itself without an id column.
     *
     * @param {object} row
     * @returns {unknown}
     */
    getRowId(row: object): unknown;
    getRowIdByIndex(index: any): unknown;
    /**
     * Gets a row of the tree by its id, also when it is not shown (with an id column; otherwise
     * the id is the row).
     *
     * @param {unknown} id
     * @returns {object}
     * @throws {RangeError} If there is no row with the id.
     */
    getRowById(id: unknown): object;
    /**
     * Returns the index of a row in the shown rows, or -1 when it is not shown (it is in a
     * collapsed row or filtered out) or not in the model.
     *
     * @param {object} row
     * @returns {number}
     */
    getRowIndex(row: object): number;
    /**
     * Returns the index of the row with an id, or when that row is not shown, of its nearest
     * shown ancestor. Tables use it to keep the cursor near a row that was hidden.
     *
     * @param {unknown} id
     * @returns {number} The index, or -1 when the row is not in the tree or no ancestor is shown.
     */
    getNearestRowIndex(id: unknown): number;
    /**
     * Returns the parent of a row, or `null` for top-level rows.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {object | null}
     */
    getParent(row: object | number): object | null;
    /**
     * Returns the children of a row (all of them, also those filtered out), in order. Do not
     * modify the array.
     *
     * @param {object | number | null} row A row, the index of a shown row, or `null` for the
     *     top-level rows.
     * @returns {ReadonlyArray<object>}
     */
    getChildren(row: object | number | null): ReadonlyArray<object>;
    /**
     * Returns the depth of a row: 0 for top-level rows, 1 for their children and so on.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {number}
     */
    getDepth(row: object | number): number;
    /**
     * Returns the level of a row, like `aria-level`: 1 for top-level rows.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {number}
     */
    getLevel(row: object | number): number;
    /**
     * Returns the path of a row: its index among its siblings, after those of its ancestors.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {number[]}
     */
    getPath(row: object | number): number[];
    /**
     * Returns the row at a path (see `getPath()`), or `null` if there is none.
     *
     * @param {number[]} path
     * @returns {object | null}
     */
    getRowByPath(path: number[]): object | null;
    /**
     * Whether a row has children, shown or still to be loaded.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {boolean}
     */
    hasChildren(row: object | number): boolean;
    /**
     * Whether a row is expanded (also when it is expanded because a descendant matches the
     * filters).
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {boolean}
     */
    isExpanded(row: object | number): boolean;
    /**
     * Whether the children of a row are being loaded.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {boolean}
     */
    isLoading(row: object | number): boolean;
    /**
     * Expands a row, showing its children. A lazy row loads its children first.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @param {boolean} [recursive] Whether to expand all descendants too.
     * @returns {boolean} Whether a row was expanded.
     */
    expand(row: object | number, recursive?: boolean): boolean;
    /**
     * Collapses a row, hiding its descendants.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @param {boolean} [recursive] Whether to collapse all descendants too.
     * @returns {boolean} Whether a row was collapsed.
     */
    collapse(row: object | number, recursive?: boolean): boolean;
    /**
     * Expands a collapsed row, or collapses an expanded row.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @param {boolean} [recursive] Whether to expand or collapse all descendants too.
     * @returns {boolean} Whether the row is expanded now.
     */
    toggle(row: object | number, recursive?: boolean): boolean;
    /**
     * Expands the ancestors of a row, so it is shown (unless it is filtered out).
     *
     * @param {object | number} row A row, or the index of a shown row.
     */
    expandTo(row: object | number): void;
    /**
     * Expands all rows. Lazy rows load their children, which are expanded as well.
     */
    expandAll(): void;
    /**
     * Collapses all rows, so only the top-level rows are shown.
     */
    collapseAll(): void;
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
    insertChild(parent: object | number | null, index: number, row: object): number;
    /**
     * Appends a row (with its children) to the children of another row. If the model is sorted,
     * the row is placed at its sorted position instead.
     *
     * @param {object | number | null} parent A row, the index of a shown row, or `null` for a
     *     top-level row.
     * @param {object} row
     * @returns {number} The index of the row in the shown rows, or -1 when it is not shown.
     */
    appendChild(parent: object | number | null, row: object): number;
    /**
     * Replaces the children of a row, e.g. once lazily loaded children arrived.
     *
     * @param {object | number | null} parent A row, the index of a shown row, or `null` to
     *     replace the top-level rows.
     * @param {object[]} children The new children. The array is copied, the rows are not.
     */
    setChildren(parent: object | number | null, children: object[]): void;
    /**
     * Inserts a row before the shown row at an index, as its sibling, or at the end of the
     * top-level rows. If the model is sorted, the row is placed at its sorted position instead.
     *
     * @param {number} index Between 0 and `rowsCount`.
     * @param {object} row
     * @returns {number} The index the row got, or -1 when it is not shown.
     */
    insertRow(index: number, row: object): number;
    insertRows(index: any, rows: any): void;
    /**
     * Removes a row with its descendants.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @returns {object} The removed row.
     */
    removeRow(row: object | number): object;
    removeAllRows(): void;
    /**
     * Replaces a row by another row object (with its children), at the same place in the tree.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @param {object} newRow
     * @returns {number} The index of the new row, or -1 when it is not shown.
     */
    replaceRow(row: object | number, newRow: object): number;
    /**
     * Changes values of a row: the given columns are assigned to the row object. The siblings stay
     * sorted, so the row may move. Changing the `childrenColumn` replaces the children.
     *
     * @param {object | number} row A row, or the index of a shown row.
     * @param {Record<string, unknown>} changes Values by column.
     * @returns {number} The index of the row after the change, or -1 when it is not shown.
     */
    updateRow(row: object | number, changes: Record<string, unknown>): number;
    /**
     * Calls a function for every row of the tree (also those that are not shown), depth first.
     *
     * @param {(row: object, depth: number, parent: object | null) => void} method
     * @param {object} [context]
     */
    forEachTreeRow(method: (row: object, depth: number, parent: object | null) => void, context?: object): void;
    sortByColumn(column: any, order?: 1): void;
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
     * Removes all filters, so all rows are shown again.
     */
    removeAllFilters(): void;
    /**
     * Filters all rows again. Filters signal their changes themselves; call this when a filter
     * depends on outside state that changed.
     */
    refilter(): void;
    /**
     * Checks whether a row matches all filters (whatever its descendants).
     *
     * @param {object} row
     * @returns {boolean}
     */
    matchesFilters(row: object): boolean;
    destroy(): void;
    /**
     * Returns how a row is shown, for tree views.
     *
     * @protected
     * @param {object} row A shown row.
     * @returns {TreeRowInfo}
     */
    protected _getRowInfo(row: object): TreeRowInfo;
    _getIndexById(): Map<unknown, number>;
    /**
     * Returns all rows of the tree by id, building the index when the tree changed.
     *
     * @returns {Map<unknown, object>}
     */
    _getRowsById(): Map<unknown, object>;
    _findRow(id: any): any;
    _resolveRow(row: any): any;
    _getNode(row: any): TreeNode;
    _getChildren(row: any): any[] | readonly object[];
    /**
     * Whether a row has children that are not loaded yet.
     *
     * @param {object} row
     * @returns {boolean}
     */
    _isLazy(row: object): boolean;
    _isOpen(row: any): boolean;
    /**
     * Collects the shown rows of a tree, depth first.
     *
     * @param {ReadonlyArray<object>} children
     * @param {object[]} rows The array to add the rows to.
     * @returns {object[]} `rows`.
     */
    _collectRows(children: ReadonlyArray<object>, rows: object[]): object[];
    /**
     * Collects all rows of subtrees.
     *
     * @param {ReadonlyArray<object>} rows
     * @param {Set<object>} [collected]
     * @returns {Set<object>}
     */
    _collectTree(rows: ReadonlyArray<object>, collected?: Set<object>): Set<object>;
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
    _prepareNodes(rows: object[], parent: object | null, depth: number, replaced?: Set<object>, all?: boolean): Map<object, TreeNode>;
    _commitNodes(nodes: any): void;
    _unregister(rows: any): void;
    /**
     * Sorts rows and all their loaded descendants.
     *
     * @param {object[]} rows
     * @param {(first: object, second: object) => number} compare
     */
    _sortRows(rows: object[], compare: (first: object, second: object) => number): void;
    /**
     * Expands a row and optionally its descendants, without updating the shown rows.
     *
     * @param {object} row
     * @param {boolean} recursive
     * @param {object[]} expanded Receives the rows that were expanded.
     */
    _expandRow(row: object, recursive: boolean, expanded: object[]): void;
    /**
     * Collapses a row and optionally its descendants, without updating the shown rows.
     *
     * @param {object} row
     * @param {boolean} recursive
     * @param {object[]} collapsed Receives the rows that were collapsed.
     */
    _collapseRow(row: object, recursive: boolean, collapsed: object[]): void;
    /**
     * Loads the children of a lazy row: emits `load-children` and calls `loadChildren`.
     *
     * @param {object} row
     */
    _load(row: object): void;
    _onLoadError(row: any, node: any, error: any): void;
    _emitRowChange(row: any): void;
    _getInsertPosition(index: any): {
        parent: object;
        position: number;
    };
    /**
     * Whether the shown rows are the current ones with one row moved.
     *
     * @param {object[]} rows
     * @param {number} from
     * @param {number} to
     * @returns {boolean}
     */
    _isMove(rows: object[], from: number, to: number): boolean;
    /**
     * Updates the state after rows were added to or removed from the tree.
     *
     * @param {object | null} parent The row whose children changed, or `null`.
     */
    _onTreeChange(parent: object | null): void;
    /**
     * Marks the shown rows as outdated, so they are updated at the end of the change.
     *
     * @param {object | null} row The row from which rows need to be rendered again, or `null`
     *     for all rows.
     */
    _markDirty(row: object | null): void;
    _queueSignal(name: any, row: any): void;
    /**
     * Ends a change: updates the shown rows and emits the queued signals.
     *
     * @param {boolean} [unbatched] Whether the change was not in a batch.
     */
    _endBatch(unbatched?: boolean): void;
    /**
     * Inserts shown rows at an index, signaling them.
     *
     * @param {number} index
     * @param {object[]} rows
     */
    _insertBlock(index: number, rows: object[]): void;
    /**
     * Removes shown rows at an index, signaling them.
     *
     * @param {number} index
     * @param {number} count
     */
    _removeBlock(index: number, count: number): void;
    _resetRows(rows: any): void;
    /**
     * Makes the shown rows the given rows, signaling only the rows that appear and disappear.
     * Both lists must be in tree order; otherwise (after sorting) all rows are signaled as
     * reordered.
     *
     * @param {object[]} rows
     * @param {object | null | undefined} dirty The row from which rows need to be rendered
     *     again, `null` for all rows, or `undefined`.
     */
    _applyRows(rows: object[], dirty: object | null | undefined): void;
    /**
     * Returns the positions of the shown rows among their shown siblings, and their numbers of
     * shown children.
     *
     * @returns {Map<object, {position: number, size: number, children: number}>}
     */
    _getLayout(): Map<object, {
        position: number;
        size: number;
        children: number;
    }>;
    /**
     * Computes which rows the filters hide, and which rows they expand.
     */
    _computeFilterState(): void;
    _refilter(): void;
    _onFilterChange(): void;
    _onFilterDestroy(filter: any): void;
    _setRows(rows: any): void;
    _onSortingChange(): void;
}
export declare namespace TreeModel {
    var builderProperties: {
        filters(builder: any, model: any, filters: any): void;
    };
}

/** The declared properties of {@link TreeModel}. */
export interface TreeModel {
    /**
     * The top-level rows, in order. Do not modify the array.
     */
    readonly rootRows: any;
    /**
     * The column that holds the array of children of a row.
     */
    childrenColumn: string;
    /**
     * The column that tells whether a row without children has children to load lazily, or
     * `null`.
     */
    hasChildrenColumn: string;
    /**
     * A function `(row, model)` returning the children of a lazy row, or a promise of them, or
     * `null`. It is called when the row is expanded for the first time, after `load-children`.
     * Without it, a `load-children` handler calls `setChildren()` once it has the children.
     */
    loadChildren: any;
    idColumn: any;
    /**
     * The number of filters.
     */
    readonly filtersCount: any;
}
