/**
 * @module columns/index-column
 */

import { Justification } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { AbstractColumn, ColumnChange } from './abstract-column.js';

/**
 * A column that shows the row number, labeled `#` by default.
 */
export class IndexColumn extends AbstractColumn {
    getCellText(_row, index) {
        return String(index + this._offset);
    }

    _getTypeClassName() {
        return 'wy-table-index-cell';
    }

    _measureCell(_row, _index, measureText) {
        // The widest number is that of the last row.
        const count = this.model?.rowsCount || 0;

        return measureText(String(Math.max(1, count - 1 + this._offset)).replace(/\d/g, '0'));
    }
}

defineProperties(IndexColumn, {
    label: { value: '#' },

    alignment: { value: Justification.END },

    /**
     * The number of the first row.
     */
    offset: {
        value: 1,
        coerce(offset) {
            if (!Number.isInteger(offset)) {
                throw new TypeError('The offset must be an integer.');
            }

            return offset;
        },
        changed() {
            this._contentWidth = 0;
            this._invalidate(ColumnChange.CELLS);
        },
    },
});

registerType('index-column', IndexColumn);
