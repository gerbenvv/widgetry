/**
 * @module columns/index-column
 */
import { AbstractColumn } from './abstract-column.js';
/**
 * A column that shows the row number, labeled `#` by default.
 */
export declare class IndexColumn extends AbstractColumn {
    getCellText(_row: any, index: any): string;
    _getTypeClassName(): string;
    _measureCell(_row: any, _index: any, measureText: any): any;
}

/** The declared properties of {@link IndexColumn}. */
export interface IndexColumn {
    label: any;
    alignment: any;
    /**
     * The number of the first row.
     */
    offset: number;
}
