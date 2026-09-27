// Tests of the selection: modes, ranges, ids and following model changes.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { SelectionModes, SortOrder } from '../../core/enums.js';
import { FilteredListModel } from '../filtered-list-model.js';
import { SearchFilter } from '../filters/search-filter.js';
import { ListModel } from '../list-model.js';
import { Selection } from '../selection.js';

function createModel(idColumn = 'id') {
    return new ListModel({
        rows: ['d', 'b', 'a', 'e', 'c'].map((name, i) => ({ id: i + 1, name })),
        idColumn,
    });
}

describe('Selection', () => {
    test('selects rows by id and emits change once per operation', () => {
        const selection = new Selection({ model: createModel() });
        const log = [];
        selection.connect('row-select', (_x, key) => log.push(['select', key]));
        selection.connect('row-deselect', (_x, key) => log.push(['deselect', key]));
        selection.connect('change', () => log.push(['change']));

        assert.equal(selection.byId, true);
        assert.equal(selection.selectRow(2), true);
        assert.equal(selection.selectRow(2), false);
        selection.selectRange(0, 2);

        assert.deepEqual(selection.selectedRowIds, [2, 1, 3]);
        assert.deepEqual(selection.selectedIndices, [0, 1, 2]);
        assert.deepEqual(log, [
            ['select', 2],
            ['change'],
            ['select', 1],
            ['select', 3],
            ['change'],
        ]);
        assert.throws(() => selection.selectRow(99), RangeError);
    });

    test('keeps selected ids while the model is sorted and filtered', () => {
        const model = createModel();
        const filter = new SearchFilter();
        const filtered = new FilteredListModel(model, filter);
        const selection = new Selection({ model: filtered });

        selection.select(0);
        selection.select(4);
        model.sortByColumn('name', SortOrder.ASCENDING);

        assert.deepEqual(selection.selectedRowIds, [1, 5]);
        assert.deepEqual(selection.selectedIndices, [2, 3]);
        assert.deepEqual(
            selection.selectedRows.map((x) => x.name),
            ['d', 'c']
        );

        // Filtering out a selected row unselects it.
        filter.query = 'd';
        assert.deepEqual(selection.selectedRowIds, [1]);
        assert.equal(selection.isSelected(0), true);
    });

    test('limits the selection to the modes', () => {
        const selection = new Selection({ model: createModel(), modes: SelectionModes.SINGLE });

        selection.select(0);
        selection.select(1);
        assert.deepEqual(selection.selectedRowIds, [2]);
        assert.equal(selection.selectAll(), false);

        selection.selectRange(1, 3);
        assert.deepEqual(selection.selectedRowIds, [4]);

        selection.modes = SelectionModes.MULTI;
        selection.selectAll();
        assert.equal(selection.selectedRowsCount, 5);

        selection.modes = SelectionModes.SINGLE;
        assert.equal(selection.selectedRowsCount, 1);

        selection.modes = SelectionModes.NONE;
        assert.equal(selection.selectedRowsCount, 0);
        assert.equal(selection.select(0), false);
    });

    test('toggles, extends ranges and sets the selected ids', () => {
        const selection = new Selection({ model: createModel() });

        selection.toggle(0);
        selection.toggle(1);
        selection.toggle(0);
        assert.deepEqual(selection.selectedRowIds, [2]);

        selection.selectRange(3, 2, true);
        assert.deepEqual(selection.selectedIndices, [1, 2, 3]);

        selection.selectedRowIds = [5, 1];
        assert.deepEqual(selection.selectedRowIds, [5, 1]);
        assert.equal(selection.getSelectedRowId(1), 1);
        assert.equal(selection.getSelectedRow().name, 'c');

        selection.unselectAll();
        assert.equal(selection.selectedRowsCount, 0);
    });

    test('unselects removed rows and follows id changes', () => {
        const model = createModel();
        const selection = new Selection({ model });
        selection.selectedRowIds = [1, 2];

        model.removeRowById(1);
        assert.deepEqual(selection.selectedRowIds, [2]);

        model.setCellValueById(2, 'id', 20);
        assert.deepEqual(selection.selectedRowIds, [20]);

        model.rows = [{ id: 30 }];
        assert.deepEqual(selection.selectedRowIds, []);
    });

    test('follows inserted, removed and moved rows without an id column', () => {
        const model = createModel(null);
        const selection = new Selection({ model });

        assert.equal(selection.byId, false);
        selection.selectedRowIds = [1, 3];

        model.insertRow(0, { name: 'x' });
        assert.deepEqual(selection.selectedIndices, [2, 4]);

        model.removeRow(2);
        assert.deepEqual(selection.selectedIndices, [3]);

        model.sortByColumn('name');
        assert.deepEqual(selection.selectedIndices, []);
    });

    test('clears when the model changes or is destroyed', () => {
        const model = createModel();
        const selection = new Selection({ model });
        selection.select(0);

        model.destroy();
        assert.equal(selection.model, null);
        assert.equal(selection.selectedRowsCount, 0);
        assert.throws(() => selection.select(0), /not connected/);
    });
});
