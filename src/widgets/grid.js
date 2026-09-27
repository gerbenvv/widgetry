/**
 * @module widgets/grid
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Container } from './container.js';

/**
 * The CSS track size of a track that takes extra space.
 *
 * @type {string}
 */
const EXPANDING_TRACK = 'minmax(auto, 1fr)';

/**
 * The CSS track size of a track in a homogeneous direction: all tracks are as large as the
 * largest natural size, and share extra space equally.
 *
 * @type {string}
 */
const HOMOGENEOUS_TRACK = 'minmax(max-content, 1fr)';

/**
 * The keys of a builder child object that describe its attachment rather than the widget.
 *
 * @type {ReadonlyArray<string>}
 */
const ATTACHMENT_KEYS = [
    'row',
    'column',
    'row-span',
    'rowSpan',
    'col-span',
    'colSpan',
    'column-span',
    'columnSpan',
];

/**
 * @typedef {object} GridAttachment
 * @property {number} row The first row.
 * @property {number} column The first column.
 * @property {number} rowSpan The number of rows.
 * @property {number} columnSpan The number of columns.
 */

function checkIndex(value, name) {
    if (!Number.isInteger(value) || value < 0) {
        throw new RangeError(`Invalid grid ${name}: ${value}.`);
    }
}

function checkSpan(value, name) {
    if (!Number.isInteger(value) || value < 1) {
        throw new RangeError(`Invalid grid ${name}: ${value}.`);
    }
}

/**
 * Lays out its children in rows and columns, where a child can span several cells, like GTK's
 * grid. It is a CSS grid.
 *
 * Every column is as wide as its widest child (and every row as high as its highest child).
 * A column takes extra space when one of its children expands horizontally; a child spanning
 * several columns makes all of them expand if none of them does already. With
 * `columnHomogeneous` (or `rowHomogeneous`) all columns (rows) get the same size. Rows and
 * columns without visible children take no space.
 *
 * Note the argument order of the original toolkit: `addChild(widget, row, column, rowSpan,
 * columnSpan)`.
 *
 * @example
 * const grid = new Grid({ rowSpacing: 4, columnSpacing: 6 });
 * grid.addChild(new Label({ text: 'Name:' }), 0, 0);
 * grid.addChild(new LineEdit({ hExpand: true }), 0, 1);
 */
export class Grid extends Container {
    _initialize() {
        super._initialize();

        /** @type {Map<import('./widget.js').Widget, GridAttachment>} */
        this._attachments = new Map();

        // The attachment for the child being added by `addChild()`.
        /** @type {GridAttachment | null} */
        this._pendingAttachment = null;
    }

    _render() {
        return createElement('<div class="wy-grid"></div>');
    }

    /**
     * Adds a child at a cell. Without a position, the child is put in column 0 of a new row
     * below all other children.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {number} [row] The first row the child occupies.
     * @param {number} [column] The first column the child occupies.
     * @param {number} [rowSpan] The number of rows the child spans.
     * @param {number} [columnSpan] The number of columns the child spans.
     * @returns {import('./widget.js').Widget} The widget.
     * @throws {RangeError} If the position or a span is invalid.
     */
    addChild(widget, row, column, rowSpan = 1, columnSpan = 1) {
        const attachment = this._createAttachment(row, column, rowSpan, columnSpan);

        this._pendingAttachment = attachment;
        try {
            return super.addChild(widget);
        } finally {
            this._pendingAttachment = null;
        }
    }

    /**
     * Adds a child at a cell. The same as `addChild()`, with the name GTK uses.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {number} row
     * @param {number} column
     * @param {number} [rowSpan]
     * @param {number} [columnSpan]
     * @returns {import('./widget.js').Widget}
     */
    attach(widget, row, column, rowSpan = 1, columnSpan = 1) {
        return this.addChild(widget, row, column, rowSpan, columnSpan);
    }

    insertChild(widget, index) {
        const attachment =
            this._pendingAttachment || this._createAttachment(undefined, undefined, 1, 1);

        const result = super.insertChild(widget, index);
        this._attachments.set(widget, attachment);
        this._queueLayout();

        return result;
    }

    removeChild(widget) {
        const index = super.removeChild(widget);

        this._attachments.delete(widget);
        this._clearChildPlacement(widget);

        return index;
    }

    /**
     * Returns the attachment of a child.
     *
     * @param {import('./widget.js').Widget} widget
     * @returns {GridAttachment}
     * @throws {Error} If the widget is not a child.
     */
    getChildPosition(widget) {
        const attachment = this._attachments.get(widget);
        if (!attachment) {
            throw new Error('The widget is not a child of this grid.');
        }

        return { ...attachment };
    }

    /**
     * Moves a child to another cell, or changes its spans.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {number} row
     * @param {number} column
     * @param {number} [rowSpan]
     * @param {number} [columnSpan]
     * @throws {Error} If the widget is not a child.
     */
    setChildPosition(widget, row, column, rowSpan = 1, columnSpan = 1) {
        if (!this._attachments.has(widget)) {
            throw new Error('The widget is not a child of this grid.');
        }

        this._attachments.set(widget, this._createAttachment(row, column, rowSpan, columnSpan));
        this._onChildrenChange();
    }

    /**
     * Returns the child whose area covers a cell, or `null`.
     *
     * @param {number} row
     * @param {number} column
     * @returns {import('./widget.js').Widget | null}
     */
    getChildAt(row, column) {
        for (const child of this._children) {
            const a = this._attachments.get(child);
            if (
                row >= a.row &&
                row < a.row + a.rowSpan &&
                column >= a.column &&
                column < a.column + a.columnSpan
            ) {
                return child;
            }
        }

        return null;
    }

    /**
     * Inserts an empty row: children at or below it move down, and children spanning across it
     * grow.
     *
     * @param {number} position
     */
    insertRow(position) {
        this._insertTrack(position, 'row', 'rowSpan');
    }

    /**
     * Inserts an empty column: children at or right of it move right, and children spanning
     * across it grow.
     *
     * @param {number} position
     */
    insertColumn(position) {
        this._insertTrack(position, 'column', 'columnSpan');
    }

    /**
     * Removes a row: children only in that row are destroyed, children spanning it shrink and
     * children below it move up.
     *
     * @param {number} position
     */
    removeRow(position) {
        this._removeTrack(position, 'row', 'rowSpan');
    }

    /**
     * Removes a column: children only in that column are destroyed, children spanning it shrink
     * and children right of it move left.
     *
     * @param {number} position
     */
    removeColumn(position) {
        this._removeTrack(position, 'column', 'columnSpan');
    }

    _createAttachment(row, column, rowSpan, columnSpan) {
        if (row === undefined || row === null) {
            row = this.rowCount;
            column = column ?? 0;
        }

        column = column ?? 0;

        checkIndex(row, 'row');
        checkIndex(column, 'column');
        checkSpan(rowSpan, 'row span');
        checkSpan(columnSpan, 'column span');

        return { row, column, rowSpan, columnSpan };
    }

    _insertTrack(position, key, spanKey) {
        checkIndex(position, key);

        for (const attachment of this._attachments.values()) {
            if (attachment[key] >= position) {
                attachment[key] += 1;
            } else if (attachment[key] + attachment[spanKey] > position) {
                attachment[spanKey] += 1;
            }
        }

        this._onChildrenChange();
    }

    _removeTrack(position, key, spanKey) {
        checkIndex(position, key);

        for (const child of [...this._children]) {
            const attachment = this._attachments.get(child);
            const start = attachment[key];
            const end = start + attachment[spanKey];

            if (start === position && end === position + 1) {
                child.destroy();
            } else if (start > position) {
                attachment[key] -= 1;
            } else if (end > position) {
                attachment[spanKey] -= 1;
            }
        }

        this._onChildrenChange();
    }

    _clearChildPlacement(widget) {
        widget._setLayoutStyle('gridRow', '');
        widget._setLayoutStyle('gridColumn', '');
    }

    _updateLayout() {
        const style = this.bodyElement.style;

        style.rowGap = this._rowSpacing ? `${this._rowSpacing}px` : '';
        style.columnGap = this._columnSpacing ? `${this._columnSpacing}px` : '';

        const visible = this._children.filter((x) => x.visible);

        const columns = this._computeTracks(visible, 'column', 'columnSpan', 'isHExpand');
        const rows = this._computeTracks(visible, 'row', 'rowSpan', 'isVExpand');

        style.gridTemplateColumns = this._toTemplate(columns, this._columnHomogeneous);
        style.gridTemplateRows = this._toTemplate(rows, this._rowHomogeneous);

        for (const child of this._children) {
            if (!child.visible) {
                continue;
            }

            const a = this._attachments.get(child);
            child._setLayoutStyle('gridRow', this._toLines(rows, a.row, a.rowSpan));
            child._setLayoutStyle('gridColumn', this._toLines(columns, a.column, a.columnSpan));
        }
    }

    /**
     * Computes the used tracks in one direction: a map from track index to CSS line index, and
     * whether each used track expands.
     *
     * @param {import('./widget.js').Widget[]} visible
     * @param {'row' | 'column'} key
     * @param {'rowSpan' | 'columnSpan'} spanKey
     * @param {'isHExpand' | 'isVExpand'} expandKey
     * @returns {{indexes: Map<number, number>, expands: boolean[]}}
     */
    _computeTracks(visible, key, spanKey, expandKey) {
        const used = new Set();
        const expanding = new Set();

        for (const child of visible) {
            const a = this._attachments.get(child);
            for (let i = a[key]; i < a[key] + a[spanKey]; ++i) {
                used.add(i);
            }

            if (a[spanKey] === 1 && child[expandKey]) {
                expanding.add(a[key]);
            }
        }

        // A spanning child that expands makes all its tracks expand, unless one already does.
        for (const child of visible) {
            const a = this._attachments.get(child);
            if (a[spanKey] === 1 || !child[expandKey]) {
                continue;
            }

            const tracks = [];
            for (let i = a[key]; i < a[key] + a[spanKey]; ++i) {
                tracks.push(i);
            }

            if (!tracks.some((x) => expanding.has(x))) {
                tracks.forEach((x) => expanding.add(x));
            }
        }

        const indexes = new Map();
        const expands = [];
        for (const track of [...used].sort((x, y) => x - y)) {
            indexes.set(track, indexes.size + 1);
            expands.push(expanding.has(track));
        }

        return { indexes, expands };
    }

    _toTemplate(tracks, homogeneous) {
        if (!tracks.expands.length) {
            return '';
        }

        return tracks.expands
            .map((expands) => {
                if (homogeneous) {
                    return HOMOGENEOUS_TRACK;
                }

                return expands ? EXPANDING_TRACK : 'auto';
            })
            .join(' ');
    }

    _toLines(tracks, start, span) {
        const first = tracks.indexes.get(start);
        const last = tracks.indexes.get(start + span - 1);

        return `${first} / ${last + 1}`;
    }
}

defineProperties(Grid, {
    /**
     * The space between rows, in pixels.
     */
    rowSpacing: {
        value: 0,
        changed() {
            this._queueLayout();
        },
    },

    /**
     * The space between columns, in pixels.
     */
    columnSpacing: {
        value: 0,
        changed() {
            this._queueLayout();
        },
    },

    /**
     * Whether all rows get the same height.
     */
    rowHomogeneous: {
        value: false,
        changed() {
            this._queueLayout();
        },
    },

    /**
     * Whether all columns get the same width.
     */
    columnHomogeneous: {
        value: false,
        changed() {
            this._queueLayout();
        },
    },

    /**
     * The number of rows: one more than the last row any child occupies.
     */
    rowCount: {
        readOnly: true,
        get() {
            let count = 0;
            for (const a of this._attachments.values()) {
                count = Math.max(count, a.row + a.rowSpan);
            }

            return count;
        },
    },

    /**
     * The number of columns: one more than the last column any child occupies.
     */
    columnCount: {
        readOnly: true,
        get() {
            let count = 0;
            for (const a of this._attachments.values()) {
                count = Math.max(count, a.column + a.columnSpan);
            }

            return count;
        },
    },
});

Grid.builderProperties = {
    /**
     * Builds the children, each an object with the widget's own properties plus `row`, `column`,
     * `row-span` (or `rowSpan`) and `col-span` (or `colSpan`, `columnSpan`).
     *
     * @param {object} builder
     * @param {Grid} grid
     * @param {object[]} children
     */
    children(builder, grid, children) {
        if (!Array.isArray(children)) {
            throw new Error('Grid children must be an array.');
        }

        for (const child of children) {
            const spec = { ...child };
            for (const key of ATTACHMENT_KEYS) {
                delete spec[key];
            }

            const widget = builder.build(spec)[0];
            const rowSpan = child.rowSpan ?? child['row-span'] ?? 1;
            const columnSpan =
                child.columnSpan ?? child['column-span'] ?? child.colSpan ?? child['col-span'] ?? 1;

            grid.addChild(widget, child.row, child.column, rowSpan, columnSpan);
        }
    },
};

registerType('grid', Grid);
