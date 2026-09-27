/**
 * @module data/selection
 */

import { SelectionModes } from '../core/enums.js';
import { defineProperties, Instance } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { AbstractModel } from './abstract-model.js';

/**
 * The selected rows of a model, as used by tables.
 *
 * When the model has an id column, rows are selected by id: they stay selected while the model
 * is sorted or filtered, and are unselected when they are removed (or filtered out). Without an id
 * column, rows are selected by index; the selection follows inserted, removed and moved rows, and
 * is cleared when the model is re-sorted.
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
export class Selection extends Instance {
    _initialize() {
        super._initialize();

        /**
         * The selected keys, in selection order.
         *
         * @type {Set<unknown>}
         */
        this._keys = new Set();

        this._batch = 0;
        this._batchChanged = false;
    }

    destroy() {
        this._connectModel(null);
        this._keys.clear();

        super.destroy();
    }

    /**
     * Whether rows are selected by id (the model has an id column).
     *
     * @type {boolean}
     */
    get byId() {
        return Boolean(this._model?.idColumn);
    }

    /**
     * Returns the key of the row at an index: its id, or the index itself.
     *
     * @param {number} index
     * @returns {unknown}
     */
    getKey(index) {
        const model = this._requireModel();

        return this.byId ? model.getRowIdByIndex(index) : (model.getRow(index), index);
    }

    /**
     * Returns the index of the row with a key, or -1 if it is not in the model.
     *
     * @param {unknown} key
     * @returns {number}
     */
    getIndex(key) {
        const model = this._model;
        if (!model) {
            return -1;
        }

        if (this.byId) {
            return model.hasRowId(key) ? model.getRowIndexById(key) : -1;
        }

        return Number.isInteger(key) && key >= 0 && key < model.rowsCount ? key : -1;
    }

    /**
     * Selects a row by key. With `SelectionModes.SINGLE`, the other rows are unselected.
     *
     * @param {unknown} key
     * @returns {boolean} Whether the selection changed.
     */
    selectRow(key) {
        this._checkKey(key);

        if (!this._modes) {
            return false;
        }

        if (this._isSingle()) {
            return this.selectOnlyRow(key);
        }

        return this._run(() => this._add(key));
    }

    /**
     * Selects only one row, unselecting all others.
     *
     * @param {unknown} key
     * @returns {boolean} Whether the selection changed.
     */
    selectOnlyRow(key) {
        this._checkKey(key);

        if (!this._modes) {
            return false;
        }

        return this._run(() => {
            for (const other of [...this._keys]) {
                if (!Object.is(other, key)) {
                    this._delete(other);
                }
            }

            this._add(key);
        });
    }

    /**
     * Selects all rows. With `SelectionModes.SINGLE`, this does nothing.
     *
     * @returns {boolean} Whether the selection changed.
     */
    selectAllRows() {
        const model = this._requireModel();
        if (!(this._modes & SelectionModes.MULTI)) {
            return false;
        }

        return this._run(() => {
            for (let i = 0; i < model.rowsCount; ++i) {
                this._add(this.getKey(i));
            }
        });
    }

    /**
     * Unselects a row by key.
     *
     * @param {unknown} key
     * @returns {boolean} Whether the selection changed.
     */
    deselectRow(key) {
        return this._run(() => this._delete(key));
    }

    /**
     * Unselects all rows.
     *
     * @returns {boolean} Whether the selection changed.
     */
    deselectAllRows() {
        return this._run(() => {
            for (const key of [...this._keys]) {
                this._delete(key);
            }
        });
    }

    /**
     * Toggles the selection of a row by key.
     *
     * @param {unknown} key
     * @returns {boolean} Whether the selection changed.
     */
    toggleRow(key) {
        return this._keys.has(key) ? this.deselectRow(key) : this.selectRow(key);
    }

    /**
     * Whether a row is selected, by key.
     *
     * @param {unknown} key
     * @returns {boolean}
     */
    isRowSelected(key) {
        return this._keys.has(key);
    }

    /**
     * Calls a function for every selected row key, in selection order.
     *
     * @param {(key: unknown, index: number) => void} method Receives the key and its position in
     *     the selection.
     * @param {object} [context]
     */
    forEachRow(method, context) {
        let i = 0;
        for (const key of [...this._keys]) {
            method.call(context, key, i++);
        }
    }

    /**
     * Returns a selected row key, in selection order.
     *
     * @param {number} [index]
     * @returns {unknown}
     * @throws {RangeError} If there is no such selected row.
     */
    getSelectedRowId(index = 0) {
        if (!Number.isInteger(index) || index < 0 || index >= this._keys.size) {
            throw new RangeError('The selected row could not be found.');
        }

        let i = 0;
        for (const key of this._keys) {
            if (i++ === index) {
                return key;
            }
        }

        return undefined;
    }

    /**
     * Returns a selected row, in selection order.
     *
     * @param {number} [index]
     * @returns {object}
     */
    getSelectedRow(index = 0) {
        return this._rowOf(this.getSelectedRowId(index));
    }

    /**
     * Selects the row at an index.
     *
     * @param {number} index
     * @returns {boolean} Whether the selection changed.
     */
    select(index) {
        return this.selectRow(this.getKey(index));
    }

    /**
     * Selects only the row at an index.
     *
     * @param {number} index
     * @returns {boolean} Whether the selection changed.
     */
    selectOnly(index) {
        return this.selectOnlyRow(this.getKey(index));
    }

    /**
     * Unselects the row at an index.
     *
     * @param {number} index
     * @returns {boolean} Whether the selection changed.
     */
    unselect(index) {
        return this.deselectRow(this.getKey(index));
    }

    /**
     * Toggles the selection of the row at an index.
     *
     * @param {number} index
     * @returns {boolean} Whether the selection changed.
     */
    toggle(index) {
        return this.toggleRow(this.getKey(index));
    }

    /**
     * Whether the row at an index is selected.
     *
     * @param {number} index
     * @returns {boolean}
     */
    isSelected(index) {
        const model = this._model;
        if (
            !model ||
            !this._keys.size ||
            !Number.isInteger(index) ||
            index < 0 ||
            index >= model.rowsCount
        ) {
            return false;
        }

        return this._keys.has(this.byId ? model.getRowIdByIndex(index) : index);
    }

    /**
     * Selects the rows from one index to another (in either order). With `SelectionModes.SINGLE`,
     * only the row at `to` is selected.
     *
     * @param {number} from
     * @param {number} to
     * @param {boolean} [extend] Whether to keep the rows that are already selected.
     * @returns {boolean} Whether the selection changed.
     */
    selectRange(from, to, extend = false) {
        const model = this._requireModel();
        const count = model.rowsCount;

        if (!Number.isInteger(from) || !Number.isInteger(to)) {
            throw new TypeError('Range indices must be integers.');
        }

        if (from < 0 || to < 0 || from >= count || to >= count) {
            throw new RangeError(`Invalid row range ${from} to ${to}.`);
        }

        if (!this._modes) {
            return false;
        }

        if (!(this._modes & SelectionModes.MULTI)) {
            return this.selectOnly(to);
        }

        const start = Math.min(from, to);
        const end = Math.max(from, to);

        return this._run(() => {
            if (!extend) {
                const keep = new Set();
                for (let i = start; i <= end; ++i) {
                    keep.add(this.getKey(i));
                }

                for (const key of [...this._keys]) {
                    if (!keep.has(key)) {
                        this._delete(key);
                    }
                }
            }

            for (let i = start; i <= end; ++i) {
                this._add(this.getKey(i));
            }
        });
    }

    /**
     * Selects all rows.
     *
     * @returns {boolean} Whether the selection changed.
     */
    selectAll() {
        return this.selectAllRows();
    }

    /**
     * Unselects all rows.
     *
     * @returns {boolean} Whether the selection changed.
     */
    unselectAll() {
        return this.deselectAllRows();
    }

    _requireModel() {
        if (!this._model) {
            throw new Error('The selection is not connected to a model.');
        }

        return this._model;
    }

    _checkKey(key) {
        if (this.getIndex(key) < 0) {
            this._requireModel();

            throw new RangeError(`There is no row ${String(key)}.`);
        }
    }

    _rowOf(key) {
        const model = this._requireModel();

        return this.byId ? model.getRowById(key) : model.getRow(key);
    }

    _isSingle() {
        return (
            Boolean(this._modes & SelectionModes.SINGLE) && !(this._modes & SelectionModes.MULTI)
        );
    }

    /**
     * Runs a change, emitting `change` once at the end if anything changed.
     *
     * @param {() => void} method
     * @returns {boolean} Whether the selection changed.
     */
    _run(method) {
        this._batch += 1;

        const before = this._batchChanged;
        this._batchChanged = false;

        let changed;
        try {
            method();
        } finally {
            changed = this._batchChanged;
            this._batchChanged = before || changed;
            this._batch -= 1;
        }

        if (!this._batch && this._batchChanged) {
            this._batchChanged = false;
            this.emit('change', this);
        }

        return changed;
    }

    _add(key) {
        if (this._keys.has(key)) {
            return;
        }

        this._keys.add(key);
        this._batchChanged = true;

        this.emit('row-select', this, key);
    }

    _delete(key) {
        if (!this._keys.delete(key)) {
            return;
        }

        this._batchChanged = true;

        this.emit('row-deselect', this, key);
    }

    _connectModel(model) {
        const old = this._model;
        if (old) {
            old.disconnect('row-insert', this._onRowInsert, this);
            old.disconnect('row-remove', this._onRowRemove, this);
            old.disconnect('row-move', this._onRowMove, this);
            old.disconnect('row-update', this._onRowUpdate, this);
            old.disconnect('rows-reorder', this._onRowsReorder, this);
            old.disconnect('id-column-change', this._onIdColumnChange, this);
            old.disconnect('destroy', this._onModelDestroy, this);
        }

        this._model = model;

        if (model) {
            model.connect('row-insert', this._onRowInsert, this);
            model.connect('row-remove', this._onRowRemove, this);
            model.connect('row-move', this._onRowMove, this);
            model.connect('row-update', this._onRowUpdate, this);
            model.connect('rows-reorder', this._onRowsReorder, this);
            model.connect('id-column-change', this._onIdColumnChange, this);
            model.connect('destroy', this._onModelDestroy, this);
        }
    }

    /**
     * Replaces the index keys after rows shifted, without selecting or unselecting anything.
     *
     * @param {(index: number) => number} map Returns the new index, or -1 to drop the key.
     */
    _remapIndices(map) {
        const keys = new Set();
        const dropped = [];

        for (const key of this._keys) {
            const index = map(key);
            if (index < 0) {
                dropped.push(key);
            } else {
                keys.add(index);
            }
        }

        this._keys = keys;

        if (dropped.length) {
            this._run(() => {
                this._batchChanged = true;

                for (const key of dropped) {
                    this.emit('row-deselect', this, key);
                }
            });
        }
    }

    _onRowInsert(_model, index) {
        if (!this.byId && this._keys.size) {
            this._remapIndices((key) => (key >= index ? key + 1 : key));
        }
    }

    _onRowRemove(_model, index, id) {
        if (this.byId) {
            // Ids are unique, so the id is gone.
            this.deselectRow(id);
        } else if (this._keys.size) {
            this._remapIndices((key) => (key === index ? -1 : key > index ? key - 1 : key));
        }
    }

    _onRowMove(_model, from, to) {
        if (this.byId || !this._keys.size) {
            return;
        }

        this._remapIndices((key) => {
            if (key === from) {
                return to;
            }

            if (from < to && key > from && key <= to) {
                return key - 1;
            }

            if (to < from && key >= to && key < from) {
                return key + 1;
            }

            return key;
        });
    }

    _onRowUpdate(_model, _index, id, oldId) {
        if (!this.byId || Object.is(id, oldId) || !this._keys.has(oldId)) {
            return;
        }

        // The row got another id; keep it selected under the new id, in the same position.
        this._keys = new Set([...this._keys].map((key) => (Object.is(key, oldId) ? id : key)));
        this._run(() => {
            this._batchChanged = true;

            this.emit('row-deselect', this, oldId);
            this.emit('row-select', this, id);
        });
    }

    _onRowsReorder() {
        if (!this._keys.size) {
            return;
        }

        if (this.byId) {
            // Keep the rows that are still there.
            this._run(() => {
                for (const key of [...this._keys]) {
                    if (!this._model.hasRowId(key)) {
                        this._delete(key);
                    }
                }
            });
        } else {
            this.deselectAllRows();
        }
    }

    _onIdColumnChange() {
        this.deselectAllRows();
    }

    _onModelDestroy() {
        this.model = null;
    }
}

defineProperties(Selection, {
    /**
     * The model the selection is of. Changing it clears the selection.
     */
    model: {
        value: null,
        set(model) {
            if (model !== null && !(model instanceof AbstractModel)) {
                throw new TypeError('A selection needs a model.');
            }

            this.deselectAllRows();
            this._connectModel(model);
        },
    },

    /**
     * The selection modes: a mask of `SelectionModes`. With `NONE` nothing can be selected; with
     * `SINGLE` at most one row. `TOGGLE` affects how tables handle clicks. Reducing the modes
     * reduces the selection accordingly.
     */
    modes: {
        value: SelectionModes.MULTI,
        changed(modes) {
            if (!modes) {
                this.deselectAllRows();
            } else if (this._isSingle() && this._keys.size > 1) {
                const last = [...this._keys].pop();
                this.selectOnlyRow(last);
            }
        },
    },

    /**
     * The keys (ids, or indices without an id column) of the selected rows, in selection order.
     * Setting it selects exactly those rows.
     */
    selectedRowIds: {
        signal: false,
        get() {
            return [...this._keys];
        },
        set(keys) {
            if (!Array.isArray(keys)) {
                throw new TypeError('Selected row ids must be an array.');
            }

            keys.forEach((key) => this._checkKey(key));

            const wanted = this._modes ? (this._isSingle() ? keys.slice(-1) : keys) : [];

            this._run(() => {
                const keep = new Set(wanted);
                for (const key of [...this._keys]) {
                    if (!keep.has(key)) {
                        this._delete(key);
                    }
                }

                for (const key of wanted) {
                    this._add(key);
                }
            });

            return false;
        },
    },

    /**
     * The selected rows, in selection order.
     */
    selectedRows: {
        readOnly: true,
        get() {
            return [...this._keys].map((key) => this._rowOf(key));
        },
    },

    /**
     * The indices of the selected rows, in ascending order.
     */
    selectedIndices: {
        readOnly: true,
        get() {
            const indices = [...this._keys].map((key) => this.getIndex(key)).filter((x) => x >= 0);

            return indices.sort((first, second) => first - second);
        },
    },

    /**
     * The number of selected rows.
     */
    selectedRowsCount: {
        readOnly: true,
        get() {
            return this._keys.size;
        },
    },
});

registerType('selection', Selection);

// The original toolkit's name.
registerType('selection-model', Selection);
