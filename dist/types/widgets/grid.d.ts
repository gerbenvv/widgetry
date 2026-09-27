/**
 * @module widgets/grid
 */
import { Container } from './container.js';
export type GridAttachment = {
    /**
     * The first row.
     */
    row: number;
    /**
     * The first column.
     */
    column: number;
    /**
     * The number of rows.
     */
    rowSpan: number;
    /**
     * The number of columns.
     */
    columnSpan: number;
};
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
export declare class Grid extends Container {
    /** @type {Map<import('./widget.js').Widget, GridAttachment>} */
    _attachments: Map<import('./widget.js').Widget, GridAttachment>;
    /** @type {GridAttachment | null} */
    _pendingAttachment: GridAttachment | null;
    _initialize(): void;
    _render(): HTMLElement;
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
    addChild(widget: import('./widget.js').Widget, row?: number, column?: number, rowSpan?: number, columnSpan?: number): import('./widget.js').Widget;
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
    attach(widget: import('./widget.js').Widget, row: number, column: number, rowSpan?: number, columnSpan?: number): import('./widget.js').Widget;
    insertChild(widget: any, index: any): import("./widget.js").Widget;
    removeChild(widget: any): number;
    /**
     * Returns the attachment of a child.
     *
     * @param {import('./widget.js').Widget} widget
     * @returns {GridAttachment}
     * @throws {Error} If the widget is not a child.
     */
    getChildPosition(widget: import('./widget.js').Widget): GridAttachment;
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
    setChildPosition(widget: import('./widget.js').Widget, row: number, column: number, rowSpan?: number, columnSpan?: number): void;
    /**
     * Returns the child whose area covers a cell, or `null`.
     *
     * @param {number} row
     * @param {number} column
     * @returns {import('./widget.js').Widget | null}
     */
    getChildAt(row: number, column: number): import('./widget.js').Widget | null;
    /**
     * Inserts an empty row: children at or below it move down, and children spanning across it
     * grow.
     *
     * @param {number} position
     */
    insertRow(position: number): void;
    /**
     * Inserts an empty column: children at or right of it move right, and children spanning
     * across it grow.
     *
     * @param {number} position
     */
    insertColumn(position: number): void;
    /**
     * Removes a row: children only in that row are destroyed, children spanning it shrink and
     * children below it move up.
     *
     * @param {number} position
     */
    removeRow(position: number): void;
    /**
     * Removes a column: children only in that column are destroyed, children spanning it shrink
     * and children right of it move left.
     *
     * @param {number} position
     */
    removeColumn(position: number): void;
    _createAttachment(row: any, column: any, rowSpan: any, columnSpan: any): {
        row: any;
        column: any;
        rowSpan: any;
        columnSpan: any;
    };
    _insertTrack(position: any, key: any, spanKey: any): void;
    _removeTrack(position: any, key: any, spanKey: any): void;
    _clearChildPlacement(widget: any): void;
    _updateLayout(): void;
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
    _computeTracks(visible: import('./widget.js').Widget[], key: 'row' | 'column', spanKey: 'rowSpan' | 'columnSpan', expandKey: 'isHExpand' | 'isVExpand'): {
        indexes: Map<number, number>;
        expands: boolean[];
    };
    _toTemplate(tracks: any, homogeneous: any): any;
    _toLines(tracks: any, start: any, span: any): string;
}
export declare namespace Grid {
    var builderProperties: {
        /**
         * Builds the children, each an object with the widget's own properties plus `row`, `column`,
         * `row-span` (or `rowSpan`) and `col-span` (or `colSpan`, `columnSpan`).
         *
         * @param {object} builder
         * @param {Grid} grid
         * @param {object[]} children
         */
        children(builder: object, grid: Grid, children: object[]): void;
    };
}

/** The declared properties of {@link Grid}. */
export interface Grid {
    /**
     * The space between rows, in pixels.
     */
    rowSpacing: number;
    /**
     * The space between columns, in pixels.
     */
    columnSpacing: number;
    /**
     * Whether all rows get the same height.
     */
    rowHomogeneous: boolean;
    /**
     * Whether all columns get the same width.
     */
    columnHomogeneous: boolean;
    /**
     * The number of rows: one more than the last row any child occupies.
     */
    readonly rowCount: number;
    /**
     * The number of columns: one more than the last column any child occupies.
     */
    readonly columnCount: number;
}
