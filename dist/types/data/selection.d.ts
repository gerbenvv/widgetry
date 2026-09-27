/**
 * @module data/selection
 */
import { Instance } from '../core/instance.js';
/**
 * The selected rows of a model, as used by tables.
 *
 * When the model has an id column (or is a `TreeModel`), rows are selected by id: they stay
 * selected while the model is sorted or filtered, and are unselected when they are removed (or
 * filtered out, or hidden in a collapsed row). Without an id column, rows are selected by index;
 * the selection follows inserted, removed and moved rows, and is cleared when the model is
 * re-sorted.
 *
 * The methods ending in `Row` take a row key: the id with an id column, the index otherwise
 * (like the original toolkit). The other methods (`select`, `toggle`, `selectRange`, ...) take row
 * indices.
 *
 * The `modes` (a mask of `SelectionModes`) limit the selection: with `NONE` nothing can be
 * selected, with `SINGLE` at most one row.
 *
 * Signals: `row-select` and `row-deselect` (`selection, key`), and `change` (`selection`) once
 * per operation that changed the selection.
 */
export declare class Selection extends Instance {
    /**
     * The selected keys, in selection order.
     *
     * @type {Set<unknown>}
     */
    _keys: Set<unknown>;
    _batch: number;
    _batchChanged: any;
    _model: any;
    model: any;
    _initialize(): void;
    destroy(): void;
    /**
     * Whether rows are selected by id (the model has row ids, see `AbstractModel#hasRowIds`).
     *
     * @type {boolean}
     */
    get byId(): boolean;
    /**
     * Returns the key of the row at an index: its id, or the index itself.
     *
     * @param {number} index
     * @returns {unknown}
     */
    getKey(index: number): unknown;
    /**
     * Returns the index of the row with a key, or -1 if it is not in the model.
     *
     * @param {unknown} key
     * @returns {number}
     */
    getIndex(key: unknown): number;
    /**
     * Selects a row by key. With `SelectionModes.SINGLE`, the other rows are unselected.
     *
     * @param {unknown} key
     * @returns {boolean} Whether the selection changed.
     */
    selectRow(key: unknown): boolean;
    /**
     * Selects only one row, unselecting all others.
     *
     * @param {unknown} key
     * @returns {boolean} Whether the selection changed.
     */
    selectOnlyRow(key: unknown): boolean;
    /**
     * Selects all rows. With `SelectionModes.SINGLE`, this does nothing.
     *
     * @returns {boolean} Whether the selection changed.
     */
    selectAllRows(): boolean;
    /**
     * Unselects a row by key.
     *
     * @param {unknown} key
     * @returns {boolean} Whether the selection changed.
     */
    deselectRow(key: unknown): boolean;
    /**
     * Unselects all rows.
     *
     * @returns {boolean} Whether the selection changed.
     */
    deselectAllRows(): boolean;
    /**
     * Toggles the selection of a row by key.
     *
     * @param {unknown} key
     * @returns {boolean} Whether the selection changed.
     */
    toggleRow(key: unknown): boolean;
    /**
     * Whether a row is selected, by key.
     *
     * @param {unknown} key
     * @returns {boolean}
     */
    isRowSelected(key: unknown): boolean;
    /**
     * Calls a function for every selected row key, in selection order.
     *
     * @param {(key: unknown, index: number) => void} method Receives the key and its position in
     *     the selection.
     * @param {object} [context]
     */
    forEachRow(method: (key: unknown, index: number) => void, context?: object): void;
    /**
     * Returns a selected row key, in selection order.
     *
     * @param {number} [index]
     * @returns {unknown}
     * @throws {RangeError} If there is no such selected row.
     */
    getSelectedRowId(index?: number): unknown;
    /**
     * Returns a selected row, in selection order.
     *
     * @param {number} [index]
     * @returns {object}
     */
    getSelectedRow(index?: number): object;
    /**
     * Selects the row at an index.
     *
     * @param {number} index
     * @returns {boolean} Whether the selection changed.
     */
    select(index: number): boolean;
    /**
     * Selects only the row at an index.
     *
     * @param {number} index
     * @returns {boolean} Whether the selection changed.
     */
    selectOnly(index: number): boolean;
    /**
     * Unselects the row at an index.
     *
     * @param {number} index
     * @returns {boolean} Whether the selection changed.
     */
    unselect(index: number): boolean;
    /**
     * Toggles the selection of the row at an index.
     *
     * @param {number} index
     * @returns {boolean} Whether the selection changed.
     */
    toggle(index: number): boolean;
    /**
     * Whether the row at an index is selected.
     *
     * @param {number} index
     * @returns {boolean}
     */
    isSelected(index: number): boolean;
    /**
     * Selects the rows from one index to another (in either order). With `SelectionModes.SINGLE`,
     * only the row at `to` is selected.
     *
     * @param {number} from
     * @param {number} to
     * @param {boolean} [extend] Whether to keep the rows that are already selected.
     * @returns {boolean} Whether the selection changed.
     */
    selectRange(from: number, to: number, extend?: boolean): boolean;
    /**
     * Selects all rows.
     *
     * @returns {boolean} Whether the selection changed.
     */
    selectAll(): boolean;
    /**
     * Unselects all rows.
     *
     * @returns {boolean} Whether the selection changed.
     */
    unselectAll(): boolean;
    _requireModel(): any;
    _checkKey(key: any): void;
    _rowOf(key: any): any;
    _isSingle(): boolean;
    /**
     * Runs a change, emitting `change` once at the end if anything changed.
     *
     * @param {() => void} method
     * @returns {boolean} Whether the selection changed.
     */
    _run(method: () => void): boolean;
    _add(key: any): void;
    _delete(key: any): void;
    _connectModel(model: any): void;
    /**
     * Replaces the index keys after rows shifted, without selecting or unselecting anything.
     *
     * @param {(index: number) => number} map Returns the new index, or -1 to drop the key.
     */
    _remapIndices(map: (index: number) => number): void;
    _onRowInsert(_model: any, index: any): void;
    _onRowRemove(_model: any, index: any, id: any): void;
    _onRowMove(_model: any, from: any, to: any): void;
    _onRowUpdate(_model: any, _index: any, id: any, oldId: any): void;
    _onRowsReorder(): void;
    _onIdColumnChange(): void;
    _onModelDestroy(): void;
}

/** The declared properties of {@link Selection}. */
export interface Selection {
    /**
     * The selection modes: a mask of `SelectionModes`. With `NONE` nothing can be selected; with
     * `SINGLE` at most one row. `TOGGLE` affects how tables handle clicks. Reducing the modes
     * reduces the selection accordingly.
     */
    modes: any;
    /**
     * The keys (ids, or indices without an id column) of the selected rows, in selection order.
     * Setting it selects exactly those rows.
     */
    selectedRowIds: any;
    /**
     * The selected rows, in selection order.
     */
    readonly selectedRows: any;
    /**
     * The indices of the selected rows, in ascending order.
     */
    readonly selectedIndices: any;
    /**
     * The number of selected rows.
     */
    readonly selectedRowsCount: any;
}
