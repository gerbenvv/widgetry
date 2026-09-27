/**
 * @module columns/abstract-column
 */

import { EllipsizeMode, Justification } from '../core/enums.js';
import { defineProperties, Instance } from '../core/instance.js';

/**
 * What changed about a column, telling the table what to update.
 *
 * @enum {string}
 */
export const ColumnChange = Object.freeze({
    STRUCTURE: 'structure', // The column was shown or hidden.
    WIDTH: 'width', // The width or how it is computed.
    HEADER: 'header', // The header (label, sorting, resizing).
    CELLS: 'cells', // How cells look.
});

/**
 * The ellipsis character.
 *
 * @type {string}
 */
const ELLIPSIS = '…';

/**
 * Base class of table columns. A column renders a header and a cell per row; the table creates
 * and recycles the cell elements, and asks the column to fill them.
 *
 * Columns are plain instances (not widgets): the table lays them out as the tracks of a CSS grid.
 * All rows have the same height, `--wy-row-height` in CSS.
 *
 * A column's width is `width` when set, and otherwise its natural width: the widest of the header
 * and the cells measured so far, like the original toolkit. Columns with `expand` share the extra
 * space. When no column expands, an empty filler column takes it.
 *
 * Signals: the property change signals, `table-change` (`column`) and `destroy`. A destroyed
 * column is removed from its table.
 */
export class AbstractColumn extends Instance {
    _initialize() {
        super._initialize();

        /** @type {import('../widgets/table.js').Table | null} */
        this._table = null;

        // The widest cell content measured so far, in pixels, without padding.
        this._contentWidth = 0;

        // Whether the user resized the column; it then keeps its width instead of expanding.
        this._userResized = false;

        // The width the column got in the last layout, in pixels.
        this._allocatedWidth = 0;

        this._updateCellClass();
    }

    /**
     * The model of the table the column is in, or `null`.
     *
     * @type {import('../data/abstract-model.js').AbstractModel | null}
     */
    get model() {
        return this._table?.model || null;
    }

    /**
     * Whether the column sorts its table when its header is clicked.
     *
     * @type {boolean}
     */
    get isSortable() {
        return false;
    }

    /**
     * Whether the table can measure the natural width of the cells (the text of the cells).
     *
     * @type {boolean}
     */
    get isAutoWidth() {
        return this._width < 0 && !this._userResized;
    }

    /**
     * Returns the text of the cell of a row, used for measuring, type-ahead search and
     * accessibility.
     *
     * @param {object} _row
     * @param {number} _index
     * @returns {string}
     */
    getCellText(_row, _index) {
        return '';
    }

    /**
     * Creates the element of a cell. The table sets its class names.
     *
     * @protected
     * @returns {HTMLElement}
     */
    _createCell() {
        const cell = document.createElement('div');
        cell.setAttribute('role', 'gridcell');

        return cell;
    }

    /**
     * Fills a cell for a row. The default shows `getCellText()`.
     *
     * @protected
     * @param {HTMLElement} cell
     * @param {object} row
     * @param {number} index
     */
    _renderCell(cell, row, index) {
        this._renderText(cell, this.getCellText(row, index));
    }

    /**
     * Shows text in a cell, shortened according to `ellipsize`.
     *
     * @protected
     * @param {HTMLElement} cell
     * @param {string} text
     */
    _renderText(cell, text) {
        if (this._ellipsize === EllipsizeMode.MIDDLE) {
            text = this._ellipsizeMiddle(text);
        }

        if (cell.wyText === text && cell.wyEllipsize === this._ellipsize) {
            return;
        }

        cell.wyText = text;
        cell.wyEllipsize = this._ellipsize;

        if (this._ellipsize === EllipsizeMode.START) {
            // The cell is right-to-left, so the ellipsis is at the start; isolate the text itself.
            const isolate = document.createElement('bdi');
            isolate.textContent = text;
            cell.replaceChildren(isolate);
        } else {
            cell.textContent = text;
        }
    }

    /**
     * Returns the class names of a cell.
     *
     * @protected
     * @param {object} row
     * @param {number} index
     * @returns {string}
     */
    _getCellClassName(row, index) {
        const extra = this._cellClassName ? this._cellClassName(row, index, this) : '';

        return extra ? `${this._cellClass} ${extra}` : this._cellClass;
    }

    /**
     * Returns the class names of the cells that are specific to the column type.
     *
     * @protected
     * @returns {string}
     */
    _getTypeClassName() {
        return '';
    }

    /**
     * Measures the natural width of the content of a cell, without padding.
     *
     * @protected
     * @param {object} row
     * @param {number} index
     * @param {(text: string) => number} measureText
     * @returns {number}
     */
    _measureCell(row, index, measureText) {
        return measureText(this.getCellText(row, index));
    }

    /**
     * Handles a click on a cell, e.g. to toggle a check box.
     *
     * @protected
     * @param {HTMLElement} _cell
     * @param {number} _index
     * @param {MouseEvent} _event
     * @returns {boolean} Whether the click was handled.
     */
    _onCellClick(_cell, _index, _event) {
        return false;
    }

    /**
     * Handles the Space key on the cursor row. Columns with editable cells toggle them.
     *
     * @protected
     * @param {number} _index
     * @returns {boolean} Whether the key was handled.
     */
    _onCellKeyActivate(_index) {
        return false;
    }

    /**
     * Returns the model column the table is sorted on when the header is clicked, or `null`.
     *
     * @protected
     * @returns {string | null}
     */
    _getSortKey() {
        return null;
    }

    /**
     * Sets the table. Called by the table.
     *
     * @protected
     * @param {import('../widgets/table.js').Table | null} table
     */
    _setTable(table) {
        if (table && this._table && this._table !== table) {
            throw new Error('The column has already been added to a table.');
        }

        this._table = table;
        this._contentWidth = 0;
        this._allocatedWidth = 0;

        this.emit('table-change', this);
    }

    /**
     * Tells the table that something changed.
     *
     * @protected
     * @param {string} change One of {@link ColumnChange}.
     */
    _invalidate(change) {
        this._table?._onColumnChange(this, change);
    }

    _updateCellClass() {
        const typeClass = this._getTypeClassName();

        this._cellClass =
            `wy-table-cell wy-align-${this._alignment} wy-ellipsize-${this._ellipsize}` +
            (typeClass ? ` ${typeClass}` : '');
    }

    _ellipsizeMiddle(text) {
        const measure = this._table?._measureCellText;
        const available = this._allocatedWidth - (this._table?._cellPadding || 0);
        if (!measure || available <= 0 || measure(text) <= available) {
            return text;
        }

        // Find the longest shortened text that fits, keeping the start and the end.
        let low = 0;
        let high = text.length;
        while (low < high) {
            const keep = (low + high + 1) >>> 1;
            const candidate =
                text.slice(0, Math.ceil(keep / 2)) +
                ELLIPSIS +
                text.slice(text.length - Math.floor(keep / 2));

            if (measure(candidate) <= available) {
                low = keep;
            } else {
                high = keep - 1;
            }
        }

        return (
            text.slice(0, Math.ceil(low / 2)) +
            ELLIPSIS +
            text.slice(text.length - Math.floor(low / 2))
        );
    }
}

defineProperties(AbstractColumn, {
    /**
     * The text of the header.
     */
    label: {
        value: '',
        coerce(label) {
            return label === null || label === undefined ? '' : String(label);
        },
        changed() {
            this._invalidate(ColumnChange.HEADER);
        },
    },

    /**
     * Another name of `label`.
     */
    title: {
        signal: false,
        get() {
            return this._label;
        },
        set(title) {
            this.label = title;

            return false;
        },
    },

    /**
     * Whether the column is shown.
     */
    visible: {
        value: true,
        changed() {
            this._invalidate(ColumnChange.STRUCTURE);
        },
    },

    /**
     * The width in pixels, or -1 for the natural width. Resizing the column by dragging its
     * header sets this.
     */
    width: {
        value: -1,
        coerce(width) {
            const value = Number(width);
            if (!Number.isFinite(value)) {
                throw new TypeError('A column width must be a number.');
            }

            return value < 0 ? -1 : Math.round(value);
        },
        changed(width) {
            if (width < 0) {
                this._userResized = false;
            }

            this._invalidate(ColumnChange.WIDTH);
        },
    },

    /**
     * The minimum width in pixels, also when resizing.
     */
    minWidth: {
        value: 24,
        coerce(width) {
            return Math.max(0, Math.round(Number(width) || 0));
        },
        changed() {
            this._invalidate(ColumnChange.WIDTH);
        },
    },

    /**
     * Whether the column takes a share of the extra width.
     */
    expand: {
        value: false,
        changed() {
            this._invalidate(ColumnChange.WIDTH);
        },
    },

    /**
     * Whether the user can resize the column by dragging the right edge of its header.
     */
    resizable: {
        value: true,
        changed() {
            this._invalidate(ColumnChange.HEADER);
        },
    },

    /**
     * The alignment of the cell contents: one of `Justification` (`FILL` is `START`).
     */
    alignment: {
        value: Justification.START,
        coerce(alignment) {
            if (!Object.values(Justification).includes(alignment)) {
                throw new RangeError(`Invalid alignment '${alignment}'.`);
            }

            return alignment === Justification.FILL ? Justification.START : alignment;
        },
        changed() {
            this._updateCellClass();
            this._invalidate(ColumnChange.CELLS);
        },
    },

    /**
     * How text that does not fit is shortened: one of `EllipsizeMode`.
     */
    ellipsize: {
        value: EllipsizeMode.END,
        coerce(mode) {
            if (!Object.values(EllipsizeMode).includes(mode)) {
                throw new RangeError(`Invalid ellipsize mode '${mode}'.`);
            }

            return mode;
        },
        changed() {
            this._updateCellClass();
            this._invalidate(ColumnChange.CELLS);
        },
    },

    /**
     * A function `(row, index, column) => string` returning extra class names for a cell, or
     * `null`. Use it to style cells by their value, e.g. negative numbers in red.
     */
    cellClassName: {
        value: null,
        coerce(method) {
            if (method !== null && typeof method !== 'function') {
                throw new TypeError('The cell class name must be a function or null.');
            }

            return method;
        },
        changed() {
            this._invalidate(ColumnChange.CELLS);
        },
    },

    /**
     * The table the column is in, or `null`.
     */
    table: {
        readOnly: true,
        get() {
            return this._table;
        },
    },
});
