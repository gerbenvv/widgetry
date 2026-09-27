// Tests of the list model: sorting, ids, row operations and signals.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { SortOrder } from '../../core/enums.js';
import { getLocaleManager } from '../../i18n/locale-manager.js';
import { ListModel } from '../list-model.js';

getLocaleManager().locale = 'en-US';

function createModel(properties = {}) {
    return new ListModel({
        rows: [
            { id: 1, name: 'Stocks', value: 3 },
            { id: 2, name: 'bonds', value: 1 },
            { id: 3, name: 'Indices', value: 2 },
            { id: 4, name: 'Funds', value: 1 },
        ],
        idColumn: 'id',
        ...properties,
    });
}

function record(model) {
    const log = [];
    for (const name of [
        'row-insert',
        'row-remove',
        'row-move',
        'row-update',
        'cell-change',
        'rows-reorder',
        'rows-change',
    ]) {
        model.connect(name, (_model, ...args) => log.push([name, ...args.slice(0, 3)]));
    }

    return log;
}

describe('ListModel', () => {
    test('accepts the original positional constructor arguments', () => {
        const model = new ListModel([{ id: 'b' }, { id: 'a' }], 'id', 'id');

        assert.equal(model.idColumn, 'id');
        assert.equal(model.sortOrder, SortOrder.ASCENDING);
        assert.deepEqual(
            model.rows.map((x) => x.id),
            ['a', 'b']
        );
    });

    test('gets rows by index and id', () => {
        const model = createModel();

        assert.equal(model.rowsCount, 4);
        assert.equal(model.getRow(1).name, 'bonds');
        assert.equal(model.getRowById(3).name, 'Indices');
        assert.equal(model.getRowIndexById(4), 3);
        assert.equal(model.getRowIdByIndex(0), 1);
        assert.equal(model.hasRowId(9), false);
        assert.throws(() => model.getRow(4), RangeError);
        assert.throws(() => model.getRowById(9), RangeError);
        assert.throws(() => new ListModel({ rows: [{ a: 1 }] }).getRowById(1), /no id column/);
    });

    test('rejects duplicate ids', () => {
        assert.throws(
            () => new ListModel({ rows: [{ id: 1 }, { id: 1 }], idColumn: 'id' }),
            /Duplicate/
        );

        const model = createModel();
        assert.throws(() => model.appendRow({ id: 2 }), /Duplicate/);
        assert.throws(() => model.updateRow(0, { id: 2 }), /Duplicate/);
    });

    test('rejects an id column with duplicate ids without changing anything', () => {
        const model = createModel();
        const changes = [];
        model.connect('id-column-change', () => changes.push(model.idColumn));

        // Two rows have the value 1.
        assert.throws(() => (model.idColumn = 'value'), /Duplicate row id 1/);
        assert.equal(model.idColumn, 'id');
        assert.equal(model.getRowById(3).name, 'Indices');
        assert.deepEqual(changes, []);

        model.idColumn = 'name';
        assert.equal(model.getRowById('bonds').id, 2);
        assert.deepEqual(changes, ['name']);

        model.idColumn = null;
        assert.equal(model.hasRowIds, false);
        assert.throws(() => (model.idColumn = 'value'), /Duplicate/);
        assert.equal(model.idColumn, null);
        assert.equal(model.hasRowIds, false);
    });

    test('sorts stably, and keeps non-values at the end in both orders', () => {
        const model = new ListModel({
            rows: [
                { key: 'a', value: 2 },
                { key: 'b', value: null },
                { key: 'c', value: 1 },
                { key: 'd', value: 2 },
                { key: 'e', value: NaN },
                { key: 'f', value: 1 },
            ],
        });

        model.sortByColumn('value');
        assert.deepEqual(model.rows.map((x) => x.key).join(''), 'cfadbe');

        model.sortOrder = SortOrder.DESCENDING;
        assert.deepEqual(model.rows.map((x) => x.key).join(''), 'adcfbe');
    });

    test('sort column and order follow the original rules', () => {
        const model = createModel();
        const orders = [];
        model.connect('sort-order-change', () => orders.push(model.sortOrder));

        model.sortColumn = 'value';
        assert.equal(model.sortOrder, SortOrder.ASCENDING);

        model.sortOrder = SortOrder.NONE;
        assert.equal(model.sortColumn, null);

        model.set({ sortColumn: 'name', sortOrder: SortOrder.DESCENDING });
        assert.equal(model.sortOrder, SortOrder.DESCENDING);

        model.sortColumn = null;
        assert.equal(model.sortOrder, SortOrder.NONE);
        assert.deepEqual(orders, ['ascending', 'none', 'descending', 'none']);
        assert.throws(() => (model.sortOrder = 7), RangeError);

        // The old numeric orders are no longer accepted.
        assert.throws(() => model.sortByColumn('name', 1), RangeError);
        assert.equal(model.sortOrder, SortOrder.NONE);
    });

    test('compares strings with the locale, case sensitively or not', () => {
        const model = new ListModel({
            rows: [{ name: 'b' }, { name: 'B' }, { name: 'a' }, { name: 'é' }, { name: 'e' }],
            sortColumn: 'name',
        });
        assert.deepEqual(
            model.rows.map((x) => x.name),
            ['a', 'b', 'B', 'e', 'é']
        );

        model.columnsInfo = { name: { caseSensitive: false } };
        assert.deepEqual(
            model.rows.map((x) => x.name),
            ['a', 'b', 'B', 'e', 'é']
        );

        model.localeAware = false;
        model.columnsInfo = { name: { 'case-sensitive': true } };
        assert.deepEqual(
            model.rows.map((x) => x.name),
            ['B', 'a', 'b', 'e', 'é']
        );
    });

    test('sorts strings again when the locale changes', () => {
        const model = new ListModel({
            rows: [{ name: 'z' }, { name: 'ä' }, { name: 'a' }],
            sortColumn: 'name',
        });
        const log = record(model);

        try {
            // Swedish sorts 'ä' after 'z'.
            getLocaleManager().locale = 'sv-SE';
            assert.deepEqual(
                model.rows.map((x) => x.name),
                ['a', 'z', 'ä']
            );
            assert.equal(log[0][0], 'rows-reorder');

            model.appendRow({ name: 'b' });
            assert.deepEqual(
                model.rows.map((x) => x.name),
                ['a', 'b', 'z', 'ä']
            );
        } finally {
            getLocaleManager().locale = 'en-US';
        }

        assert.deepEqual(
            model.rows.map((x) => x.name),
            ['a', 'ä', 'b', 'z']
        );
    });

    test('compares values by type', () => {
        const model = new ListModel();

        assert.equal(model.compareValues(10, 9, 'number'), 1);
        assert.equal(model.compareValues('10', '9', 'string'), -1);
        assert.equal(model.compareValues('10', '9', 'number'), 1);
        assert.equal(model.compareValues(1, null, 'number'), -1);
        assert.equal(model.compareValues(null, 1, 'number'), 1);
        assert.equal(model.compareValues(false, true, 'boolean'), -1);
        assert.equal(model.compareValues('2024-01-02', new Date(2024, 0, 1), 'date'), 1);
        assert.equal(model.compareValues(new Date(0), new Date(1), 'auto'), -1);
        assert.throws(() => (model.columnsInfo = { x: { type: 'color' } }), RangeError);
    });

    test('uses a custom comparison from the columns info', () => {
        const order = ['low', 'medium', 'high'];
        const model = new ListModel({
            rows: [{ level: 'high' }, { level: 'low' }, { level: 'medium' }],
            columnsInfo: { level: { compare: (a, b) => order.indexOf(a) - order.indexOf(b) } },
            sortColumn: 'level',
        });

        assert.deepEqual(
            model.rows.map((x) => x.level),
            order
        );
    });

    test('inserts rows at their sorted position', () => {
        const model = createModel({ sortColumn: 'value' });
        const log = record(model);

        const index = model.appendRow({ id: 5, name: 'Cash', value: 1 });

        // After the other rows with value 1: stable.
        assert.equal(index, 2);
        assert.equal(model.getRowIndexById(5), 2);
        assert.deepEqual(log, [
            ['row-insert', 2, 5],
            ['rows-change', 2, 4],
        ]);
    });

    test('inserts rows at the given index when unsorted, and validates it', () => {
        const model = createModel();

        assert.equal(model.insertRow(1, { id: 5 }), 1);
        assert.equal(model.prependRow({ id: 6 }), 0);
        assert.equal(model.getRowIndexById(5), 2);
        assert.throws(() => model.insertRow(-1, { id: 7 }), RangeError);
        assert.throws(() => model.insertRow(8, { id: 7 }), RangeError);
        assert.throws(() => model.insertRow(0, 'row'), TypeError);
    });

    test('removes rows', () => {
        const model = createModel();
        const log = record(model);

        const row = model.removeRowById(2);

        assert.equal(row.name, 'bonds');
        assert.equal(model.getRowIndexById(3), 1);
        assert.deepEqual(log, [
            ['row-remove', 1, 2, row],
            ['rows-change', 1, 2],
        ]);

        model.removeAllRows();
        assert.equal(model.rowsCount, 0);
        assert.equal(log.at(-2)[0], 'rows-reorder');
    });

    test('updates rows and moves them to stay sorted', () => {
        const model = createModel({ sortColumn: 'value' });
        const log = record(model);

        // Rows by value: bonds(1), Funds(1), Indices(2), Stocks(3).
        const index = model.updateRow(0, { value: 5, name: 'Bonds' });

        assert.equal(index, 3);
        assert.equal(model.getRow(3).name, 'Bonds');
        assert.equal(model.getRowIndexById(2), 3);
        assert.deepEqual(log, [
            ['row-move', 0, 3, 2],
            ['cell-change', 3, 'value'],
            ['cell-change', 3, 'name'],
            ['row-update', 3, 2, 2],
            ['rows-change', 0, 3],
        ]);

        // Unchanged values do nothing.
        log.length = 0;
        assert.equal(model.setCellValue(3, 'value', 5), 3);
        assert.deepEqual(log, []);
    });

    test('updates ids', () => {
        const model = createModel();
        const log = record(model);

        model.setCellValueById(1, 'id', 10);

        assert.equal(model.getRowIndexById(10), 0);
        assert.equal(model.hasRowId(1), false);
        assert.deepEqual(
            log.find((x) => x[0] === 'row-update'),
            ['row-update', 0, 10, 1]
        );
    });

    test('replaces rows', () => {
        const model = createModel({ sortColumn: 'name' });
        const index = model.replaceRowById(1, { id: 1, name: 'Assets', value: 0 });

        assert.equal(index, 0);
        assert.equal(model.getRow(0).name, 'Assets');
    });

    test('inserts many rows at once with a single reorder signal', () => {
        const model = createModel({ sortColumn: 'value' });
        const log = record(model);

        model.appendRows([
            { id: 5, value: 0 },
            { id: 6, value: 9 },
        ]);

        assert.deepEqual(
            model.rows.map((x) => x.id),
            [5, 2, 4, 3, 1, 6]
        );
        assert.deepEqual(
            log.map((x) => x[0]),
            ['rows-reorder', 'rows-change']
        );
        assert.throws(() => model.appendRows([{ id: 7 }, { id: 7 }]), /Duplicate/);
    });

    test('keeps inserted rows after the rows they are equal to', () => {
        const model = new ListModel({
            rows: [
                { key: 'a', value: 1 },
                { key: 'b', value: 1 },
            ],
            sortColumn: 'value',
        });

        model.insertRows(0, [
            { key: 'c', value: 1 },
            { key: 'd', value: 1 },
        ]);
        model.insertRow(0, { key: 'e', value: 1 });

        assert.equal(model.rows.map((x) => x.key).join(''), 'abcde');
    });

    test('appends many rows with ids one by one in linear time', () => {
        const model = new ListModel({ idColumn: 'id' });

        const start = performance.now();
        for (let i = 0; i < 20000; ++i) {
            model.appendRow({ id: i });
        }

        // Checking every id against a rebuilt index would take seconds.
        assert.ok(performance.now() - start < 1000);
        assert.throws(() => model.appendRow({ id: 5 }), /Duplicate/);
        assert.equal(model.getRowIndexById(19999), 19999);

        model.removeRow(0);
        model.appendRow({ id: 0 });
        model.setCellValue(0, 'id', 'one');
        assert.equal(model.hasRowId(1), false);
        assert.equal(model.hasRowId('one'), true);
        assert.throws(() => model.setCellValue(1, 'id', 'one'), /Duplicate/);

        // Rows added without the id column are known when it is set again.
        model.idColumn = null;
        model.appendRow({ id: 'two' });
        model.setCellValue(0, 'id', 'three');
        model.idColumn = 'id';
        assert.throws(() => model.appendRow({ id: 'two' }), /Duplicate/);
        assert.equal(model.hasRowId('three'), true);

        model.idColumn = null;
        model.rows = [{ id: 1 }, { key: 1 }];
        model.idColumn = 'key';
        assert.equal(model.hasRowId(1), true);
        assert.throws(() => model.appendRow({ key: 1 }), /Duplicate/);
    });

    test('replaces all rows by setting rows', () => {
        const model = createModel({ sortColumn: 'name' });
        const log = record(model);

        model.rows = [
            { id: 'x', name: 'b' },
            { id: 'y', name: 'a' },
        ];

        assert.deepEqual(
            model.rows.map((x) => x.id),
            ['y', 'x']
        );
        assert.equal(model.getRowIndexById('x'), 1);
        assert.deepEqual(log, [['rows-reorder'], ['rows-change', 0, 1]]);
    });

    test('compares rows by index and id', () => {
        const model = createModel();

        assert.equal(model.compareRows(0, 1, 'value'), 1);
        assert.equal(model.compareRowsById(2, 4, 'value'), 0);
    });

    test('handles 100,000 rows', () => {
        const rows = Array.from({ length: 100000 }, (_x, i) => ({
            id: i,
            value: (i * 7919) % 1000,
        }));
        const model = new ListModel({ rows, idColumn: 'id', sortColumn: 'value' });

        assert.equal(model.getRow(0).value, 0);
        assert.equal(model.getRow(99999).value, 999);

        const index = model.appendRow({ id: -1, value: 500 });
        assert.equal(model.getRow(index - 1).value, 500);
        assert.equal(model.getRowIndexById(-1), index);
    });
});
