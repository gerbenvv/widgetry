// Tests of the filtered list model: filtering and staying in sync with the source model.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { SortOrder } from '../../core/enums.js';
import { FilteredListModel } from '../filtered-list-model.js';
import { ConditionFilter, ConditionOperator } from '../filters/condition-filter.js';
import { SearchFilter } from '../filters/search-filter.js';
import { ListModel } from '../list-model.js';

function createModels() {
    const model = new ListModel({
        rows: Array.from({ length: 10 }, (_x, i) => ({ id: i, even: i % 2 === 0, value: i })),
        idColumn: 'id',
    });
    const filter = new ConditionFilter({
        operator: ConditionOperator.EQUALS,
        value: true,
        columns: ['even'],
    });
    const filtered = new FilteredListModel(model, filter);

    return { model, filter, filtered };
}

function ids(model) {
    return model.rows.map((x) => x.id);
}

function record(model) {
    const log = [];
    for (const name of ['row-insert', 'row-remove', 'row-move', 'row-update', 'rows-reorder']) {
        model.connect(name, (_model, ...args) =>
            log.push([name, ...args.slice(0, name === 'row-remove' ? 2 : 3)])
        );
    }

    return log;
}

// Checks that the filtered model equals filtering the source from scratch.
function assertInSync(filtered, model) {
    const expected = model.rows.filter((row) => filtered.isVisibleRow(row)).map((x) => x.id);

    assert.deepEqual(ids(filtered), expected);

    filtered.rows.forEach((row, index) => {
        assert.equal(model.getRow(filtered.toSourceIndex(index)), row);
        assert.equal(filtered.getRowIndexById(row.id), index);
    });
}

describe('FilteredListModel', () => {
    test('shows the rows passing all filters', () => {
        const { model, filtered } = createModels();

        assert.deepEqual(ids(filtered), [0, 2, 4, 6, 8]);

        filtered.addFilter(
            new ConditionFilter({
                operator: ConditionOperator.GREATER_THAN,
                value: 3,
                columns: ['value'],
            })
        );
        assert.deepEqual(ids(filtered), [4, 6, 8]);
        assert.equal(filtered.filtersCount, 2);
        assert.equal(filtered.getRow(0), model.getRow(4));
        assert.equal(filtered.getRowIndexById(6), 1);
        assert.throws(() => filtered.getRowById(1), RangeError);
    });

    test('accepts a property object', () => {
        const model = new ListModel({ rows: [{ a: 'x' }, { a: 'y' }] });
        const filtered = new FilteredListModel({
            model,
            filters: [new SearchFilter({ query: 'y' })],
        });

        assert.equal(filtered.rowsCount, 1);
    });

    test('follows inserted and removed source rows', () => {
        const { model, filtered } = createModels();
        const log = record(filtered);

        model.insertRow(3, { id: 10, even: true, value: 10 });
        model.insertRow(0, { id: 11, even: false, value: 11 });
        model.removeRowById(2);
        model.removeRowById(1);

        assert.deepEqual(log, [
            ['row-insert', 2, 10],
            ['row-remove', 1, 2],
        ]);
        assertInSync(filtered, model);
    });

    test('follows changed rows that start or stop passing', () => {
        const { model, filtered } = createModels();
        const log = record(filtered);

        model.updateRowById(3, { even: true });
        model.updateRowById(4, { even: false });
        model.updateRowById(6, { value: 60 });

        assert.deepEqual(log, [
            ['row-insert', 2, 3],
            ['row-remove', 3, 4],
            ['row-update', 3, 6, 6],
        ]);
        assertInSync(filtered, model);
    });

    test('follows rows that move because the source is sorted', () => {
        const { model, filtered } = createModels();
        model.sortByColumn('value');
        const log = record(filtered);

        model.updateRowById(0, { value: 7.5 });

        assert.deepEqual(log, [
            ['row-move', 0, 3, 0],
            ['row-update', 3, 0, 0],
        ]);
        assert.deepEqual(ids(filtered), [2, 4, 6, 0, 8]);
        assertInSync(filtered, model);
    });

    test('signals only the rows that appear or disappear when a filter changes', () => {
        const { model, filter, filtered } = createModels();
        const log = record(filtered);

        filter.columns = ['even', 'value'];
        filter.value = 3;

        assert.deepEqual(log, [
            ['row-remove', 0, 0],
            ['row-remove', 0, 2],
            ['row-insert', 0, 3],
            ['row-remove', 1, 4],
            ['row-remove', 1, 6],
            ['row-remove', 1, 8],
        ]);
        assertInSync(filtered, model);
    });

    test('resets instead of signaling many rows', () => {
        const model = new ListModel({
            rows: Array.from({ length: 1000 }, (_x, i) => ({ id: i })),
            idColumn: 'id',
        });
        const filter = new SearchFilter({ query: 'x' });
        const filtered = new FilteredListModel(model, filter);
        const log = record(filtered);

        filter.query = '';

        assert.deepEqual(log, [['rows-reorder']]);
        assert.equal(filtered.rowsCount, 1000);
    });

    test('keeps in sync under random changes', () => {
        const { model, filtered } = createModels();
        let seed = 7;
        const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

        model.sortByColumn('value');
        for (let i = 0; i < 300; ++i) {
            const action = random();
            const count = model.rowsCount;

            if (action < 0.3 || !count) {
                model.appendRow({
                    id: 100 + i,
                    even: random() < 0.5,
                    value: Math.floor(random() * 20),
                });
            } else if (action < 0.5) {
                model.removeRow(Math.floor(random() * count));
            } else if (action < 0.9) {
                model.updateRow(Math.floor(random() * count), {
                    even: random() < 0.5,
                    value: Math.floor(random() * 20),
                });
            } else {
                model.sortOrder =
                    model.sortOrder === SortOrder.ASCENDING
                        ? SortOrder.DESCENDING
                        : SortOrder.ASCENDING;
            }

            assertInSync(filtered, model);
        }
    });

    test('passes on the shown row when a replaced row is filtered out', () => {
        const { model, filtered } = createModels();
        const shown = model.getRowById(2);
        const removed = [];
        filtered.connect('row-remove', (_model, index, id, row) => removed.push([index, id, row]));

        model.replaceRowById(2, { id: 2, even: false, value: 2 });

        assert.deepEqual(removed, [[1, 2, shown]]);
        assertInSync(filtered, model);
    });

    test('removes a row that a change moves and filters out, without moving it first', () => {
        const { model, filtered } = createModels();
        model.sortByColumn('value');
        const log = record(filtered);

        // The row with id 2 moves to the end of the source, and is no longer even.
        model.updateRowById(2, { even: false, value: 20 });

        assert.deepEqual(log, [['row-remove', 1, 2]]);
        assertInSync(filtered, model);
    });

    test('changes go to the source model with translated indices', () => {
        const { model, filtered } = createModels();

        filtered.updateRow(1, { value: 20 });
        assert.equal(model.getRowById(2).value, 20);

        assert.equal(filtered.insertRow(1, { id: 20, even: true }), 1);
        assert.equal(model.getRowIndexById(20), 2);

        assert.equal(filtered.appendRow({ id: 21, even: false }), -1);
        filtered.removeRow(0);
        assert.equal(model.hasRowId(0), false);
        assertInSync(filtered, model);
    });

    test('delegates sorting and passes the sort signals on', () => {
        const { model, filtered } = createModels();
        const signals = [];
        filtered.connect('sort-column-change', (sender) => signals.push(sender));

        filtered.sortByColumn('value', SortOrder.DESCENDING);

        assert.equal(model.sortColumn, 'value');
        assert.equal(filtered.sortOrder, SortOrder.DESCENDING);
        assert.deepEqual(ids(filtered), [8, 6, 4, 2, 0]);
        assert.deepEqual(signals, [filtered]);
    });

    test('removes destroyed filters and is destroyed with its source', () => {
        const { model, filter, filtered } = createModels();

        filter.destroy();
        assert.equal(filtered.rowsCount, 10);

        model.destroy();
        assert.equal(filtered.destroyed, true);
    });
});
