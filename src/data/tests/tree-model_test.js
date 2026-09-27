// Tests of the tree model: the shown rows, expanding and collapsing, tree operations, ids, sorting,
// lazy loading, filtering and selections.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { SelectionMode, SortOrder } from '../../core/enums.js';
import { getLocaleManager } from '../../i18n/locale-manager.js';
import { SearchFilter } from '../filters/search-filter.js';
import { Selection } from '../selection.js';
import { TreeModel } from '../tree-model.js';

getLocaleManager().locale = 'en-US';

// A small file system: two folders with files, and a file at the top level.
function createRows() {
    return [
        {
            id: 1,
            name: 'src',
            children: [
                { id: 2, name: 'main.js' },
                {
                    id: 3,
                    name: 'widgets',
                    children: [
                        { id: 4, name: 'button.js' },
                        { id: 5, name: 'label.js' },
                    ],
                },
            ],
        },
        { id: 6, name: 'docs', children: [{ id: 7, name: 'guide.md' }] },
        { id: 8, name: 'README.md' },
    ];
}

function createModel(properties = {}) {
    return new TreeModel({ rows: createRows(), idColumn: 'id', ...properties });
}

function names(model) {
    return model.rows.map((x) => x.name);
}

function record(model) {
    const log = [];
    for (const name of [
        'row-insert',
        'row-remove',
        'row-move',
        'row-update',
        'rows-reorder',
        'rows-change',
    ]) {
        model.connect(name, (_model, ...args) => log.push([name, ...args.slice(0, 2)]));
    }

    for (const name of ['row-expand', 'row-collapse', 'load-children']) {
        model.connect(name, (_model, row) => log.push([name, row.name]));
    }

    return log;
}

describe('TreeModel', () => {
    test('shows the top-level rows until rows are expanded', () => {
        const model = createModel();

        assert.equal(model.rowsCount, 3);
        assert.deepEqual(names(model), ['src', 'docs', 'README.md']);
        assert.equal(model.getRow(1).name, 'docs');
        assert.equal(model.rootRows.length, 3);
        assert.equal(model.hasRowIds, true);
    });

    test('expands and collapses rows, signaling the shown rows', () => {
        const model = createModel();
        const log = record(model);
        const src = model.getRow(0);

        assert.equal(model.expand(src), true);
        assert.deepEqual(names(model), ['src', 'main.js', 'widgets', 'docs', 'README.md']);
        assert.deepEqual(log, [
            ['row-insert', 1, 2],
            ['row-insert', 2, 3],
            ['rows-change', 0, 4],
            ['row-expand', 'src'],
        ]);
        assert.equal(model.isExpanded(src), true);
        assert.equal(model.expand(src), false);

        // Expanding a row inside an expanded row shows its children after it.
        model.expand(model.getRowById(3));
        assert.deepEqual(names(model), [
            'src',
            'main.js',
            'widgets',
            'button.js',
            'label.js',
            'docs',
            'README.md',
        ]);

        // Collapsing hides all descendants, but keeps their state.
        log.length = 0;
        assert.equal(model.collapse(0), true);
        assert.deepEqual(names(model), ['src', 'docs', 'README.md']);
        assert.deepEqual(log, [
            ['row-remove', 1, 2],
            ['row-remove', 1, 3],
            ['row-remove', 1, 4],
            ['row-remove', 1, 5],
            ['rows-change', 0, 2],
            ['row-collapse', 'src'],
        ]);

        model.toggle(0);
        assert.equal(model.rowsCount, 7);
        assert.equal(model.isExpanded(model.getRowById(3)), true);

        // Leaves cannot be expanded.
        assert.equal(model.expand(model.getRowById(8)), false);
        assert.equal(model.isExpanded(model.getRowById(8)), false);
    });

    test('expands and collapses recursively and all rows', () => {
        const model = createModel();

        model.expand(0, true);
        assert.equal(model.rowsCount, 7);

        model.collapse(0, true);
        model.expand(0);
        assert.deepEqual(names(model), ['src', 'main.js', 'widgets', 'docs', 'README.md']);

        model.expandAll();
        assert.equal(model.rowsCount, 8);

        model.expandTo(model.getRowById(4));
        model.collapseAll();
        assert.deepEqual(names(model), ['src', 'docs', 'README.md']);

        model.expandTo(model.getRowById(4));
        assert.deepEqual(names(model).slice(0, 5), [
            'src',
            'main.js',
            'widgets',
            'button.js',
            'label.js',
        ]);
    });

    test('tells the parents, depths, children and paths of rows', () => {
        const model = createModel();
        const button = model.getRowById(4);
        const widgets = model.getRowById(3);

        assert.equal(model.getParent(button), widgets);
        assert.equal(model.getParent(model.getRowById(1)), null);
        assert.equal(model.getDepth(button), 2);
        assert.equal(model.getLevel(button), 3);
        assert.deepEqual(
            model.getChildren(widgets).map((x) => x.name),
            ['button.js', 'label.js']
        );
        assert.equal(model.getChildren(null), model.rootRows);
        assert.deepEqual(model.getChildren(button), []);
        assert.equal(model.hasChildren(widgets), true);
        assert.equal(model.hasChildren(button), false);

        assert.deepEqual(model.getPath(button), [0, 1, 0]);
        assert.equal(model.getRowByPath([0, 1, 1]).name, 'label.js');
        assert.equal(model.getRowByPath([0, 5]), null);
        assert.equal(model.getRowByPath([]), null);

        // Hidden rows have no index, but can be found by id.
        assert.equal(model.getRowIndex(button), -1);
        assert.equal(model.hasRowId(4), false);
        assert.equal(model.getNearestRowIndex(4), 0);
        assert.throws(() => model.getRowIndexById(4), RangeError);
        assert.throws(() => model.getParent({}), /not in the model/);
    });

    test('inserts, removes and updates rows in the tree', () => {
        const model = createModel();
        model.expand(0);

        const log = record(model);
        const src = model.getRow(0);

        assert.equal(model.appendChild(src, { id: 9, name: 'util.js' }), 3);
        assert.deepEqual(log, [
            ['row-insert', 3, 9],
            ['rows-change', 0, 5],
        ]);

        assert.equal(model.insertChild(null, 0, { id: 10, name: 'build' }), 0);
        assert.equal(model.insertChild(model.getRowById(8), 0, { id: 11, name: 'x' }), -1);
        assert.equal(model.hasChildren(model.getRowById(8)), true);
        assert.throws(() => model.appendChild(null, { id: 9, name: 'again' }), /Duplicate/);
        assert.throws(() => model.appendChild(null, src), /only once/);

        log.length = 0;
        assert.equal(model.removeRow(src).name, 'src');
        assert.deepEqual(names(model), ['build', 'docs', 'README.md']);
        assert.equal(log.filter((x) => x[0] === 'row-remove').length, 4);
        assert.equal(model.hasRowId(1), false);
        assert.throws(() => model.getRowById(2), RangeError);

        // Removing the last child collapses the parent.
        model.expand(model.getRowById(6));
        model.removeRow(model.getRowById(7));
        assert.equal(model.isExpanded(model.getRowById(6)), false);

        log.length = 0;
        assert.equal(model.updateRow(0, { name: 'dist' }), 0);
        assert.deepEqual(log, [
            ['row-update', 0, 10],
            ['rows-change', 0, 0],
        ]);

        // Changing the id keeps the row.
        model.updateRow(model.getRowById(10), { id: 12 });
        assert.equal(model.getRowById(12).name, 'dist');
        assert.throws(() => model.updateRow(0, { id: 6 }), /Duplicate/);

        // The model API with indices works on the shown rows.
        model.insertRow(1, { id: 13, name: 'before docs' });
        assert.deepEqual(names(model), ['dist', 'before docs', 'docs', 'README.md']);
        model.setCellValue(1, 'name', 'changed');
        assert.equal(model.getRow(1).name, 'changed');
        model.replaceRow(1, { id: 14, name: 'replaced' });
        assert.equal(model.getRow(1).name, 'replaced');
        model.removeAllRows();
        assert.equal(model.rowsCount, 0);
    });

    test('works without an id column, with the rows as ids', () => {
        const model = new TreeModel({ rows: createRows() });
        const src = model.getRow(0);

        assert.equal(model.getRowIdByIndex(0), src);
        assert.equal(model.getRowById(src), src);
        assert.equal(model.getRowIndexById(src), 0);
        assert.throws(() => model.getRowById({}), RangeError);
    });

    test('rejects duplicate ids in the whole tree', () => {
        assert.throws(
            () =>
                new TreeModel({
                    rows: [{ id: 1, children: [{ id: 1 }] }],
                    idColumn: 'id',
                }),
            /Duplicate/
        );
    });

    test('rejects an id column with duplicate ids in collapsed rows without changing anything', () => {
        const model = new TreeModel({
            rows: [
                { id: 1, code: 'a', children: [{ id: 2, code: 'b' }] },
                { id: 3, code: 'b' },
            ],
            idColumn: 'id',
        });
        const changes = [];
        model.connect('id-column-change', () => changes.push(model.idColumn));

        // The duplicate code is in a collapsed row.
        assert.throws(() => (model.idColumn = 'code'), /Duplicate row id b/);
        assert.equal(model.idColumn, 'id');
        assert.equal(model.getRowById(3).code, 'b');
        assert.equal(model.getRowById(2).code, 'b');
        assert.deepEqual(changes, []);
    });

    test('sorts every level stably and keeps it sorted', () => {
        const model = createModel({ sortColumn: 'name' });
        model.expandAll();

        assert.deepEqual(names(model), [
            'docs',
            'guide.md',
            'README.md',
            'src',
            'main.js',
            'widgets',
            'button.js',
            'label.js',
        ]);

        const log = record(model);
        model.sortByColumn('name', SortOrder.DESCENDING);
        assert.deepEqual(names(model).slice(0, 4), ['src', 'widgets', 'label.js', 'button.js']);
        assert.deepEqual(log.slice(0, 1), [['rows-reorder']]);

        // A changed row without shown descendants moves among its siblings.
        model.sortOrder = SortOrder.ASCENDING;
        log.length = 0;
        model.updateRow(model.getRowById(2), { name: 'z.js' });
        assert.deepEqual(names(model).slice(3, 8), [
            'src',
            'widgets',
            'button.js',
            'label.js',
            'z.js',
        ]);
        assert.deepEqual(log[0], ['row-move', 4, 7]);

        // A row with shown descendants moves with them.
        log.length = 0;
        model.updateRow(model.getRowById(3), { name: 'zz' });
        assert.deepEqual(names(model).slice(3, 8), ['src', 'z.js', 'zz', 'button.js', 'label.js']);
        assert.deepEqual(log[0], ['rows-reorder']);

        // Inserted rows go to their sorted position.
        assert.equal(model.appendChild(model.getRowById(1), { id: 20, name: 'b.js' }), 4);

        // Equal rows keep their order.
        const stable = new TreeModel({
            rows: [
                { id: 1, group: 1 },
                { id: 2, group: 0 },
                { id: 3, group: 1 },
                { id: 4, group: 0 },
            ],
            idColumn: 'id',
            sortColumn: 'group',
        });
        assert.deepEqual(
            stable.rows.map((x) => x.id),
            [2, 4, 1, 3]
        );
    });

    test('loads children lazily with a loader function', async () => {
        const calls = [];
        const model = new TreeModel({
            rows: [
                { id: 1, name: 'sync', hasChildren: true },
                { id: 2, name: 'async', hasChildren: true },
                { id: 3, name: 'empty', hasChildren: true },
            ],
            idColumn: 'id',
            loadChildren(row) {
                calls.push(row.name);

                if (row.name === 'sync') {
                    return [{ id: 10, name: 'child' }];
                }

                if (row.name === 'empty') {
                    return [];
                }

                return Promise.resolve([
                    { id: 20, name: 'later' },
                    { id: 21, name: 'deeper', hasChildren: true },
                ]);
            },
        });

        assert.equal(model.hasChildren(0), true);

        model.expand(0);
        assert.deepEqual(names(model), ['sync', 'child', 'async', 'empty']);

        // Loaded rows do not load again.
        model.collapse(0);
        model.expand(0);
        assert.deepEqual(calls, ['sync']);

        const async = model.getRowById(2);
        model.expand(async);
        assert.equal(model.isLoading(async), true);
        assert.equal(model.isExpanded(async), true);
        assert.equal(model._getRowInfo(async).loading, true);

        await Promise.resolve();
        assert.equal(model.isLoading(async), false);
        assert.deepEqual(names(model), ['sync', 'child', 'async', 'later', 'deeper', 'empty']);

        // Children without children make a leaf.
        model.expand(model.getRowById(3));
        assert.equal(model.hasChildren(model.getRowById(3)), false);
        assert.equal(model.isExpanded(model.getRowById(3)), false);
        assert.deepEqual(calls, ['sync', 'async', 'empty']);
    });

    test('loads children lazily with the load-children signal', () => {
        const model = new TreeModel({ rows: [{ name: 'root', hasChildren: true }] });
        const root = model.getRow(0);
        const requests = [];

        model.connect('load-children', (_model, row) => requests.push(row));
        model.expand(root);

        assert.deepEqual(requests, [root]);
        assert.equal(model.isLoading(root), true);

        model.setChildren(root, [{ name: 'a' }, { name: 'b' }]);
        assert.deepEqual(names(model), ['root', 'a', 'b']);
        assert.equal(model.isLoading(root), false);
    });

    test('expands lazy rows recursively once loaded', () => {
        let id = 0;
        const model = new TreeModel({
            rows: [{ name: 'root', depth: 0, hasChildren: true }],
            loadChildren: (row) =>
                row.depth < 2
                    ? [1, 2].map(() => ({
                          name: `n${++id}`,
                          depth: row.depth + 1,
                          hasChildren: true,
                      }))
                    : [],
        });

        model.expandAll();
        assert.equal(model.rowsCount, 1 + 2 + 4);
    });

    test('reports loading errors and collapses the row', async () => {
        const model = new TreeModel({
            rows: [{ name: 'root', hasChildren: true }],
            loadChildren: () => Promise.reject(new Error('offline')),
        });
        const errors = [];
        model.connect('load-error', (_model, row, error) => {
            errors.push([row.name, error.message]);

            return true;
        });

        model.expand(0);
        await new Promise((resolve) => setTimeout(resolve));

        assert.deepEqual(errors, [['root', 'offline']]);
        assert.equal(model.isExpanded(0), false);
        assert.equal(model.isLoading(0), false);
    });

    test('filters rows, showing and expanding the ancestors of matches', () => {
        const model = createModel();
        const filter = new SearchFilter({ columns: ['name'] });
        model.addFilter(filter);

        // A filter that hides nothing is not in effect.
        assert.deepEqual(names(model), ['src', 'docs', 'README.md']);

        filter.query = 'label';
        assert.deepEqual(names(model), ['src', 'widgets', 'label.js']);
        assert.equal(model.isExpanded(0), true);
        assert.equal(model.getRowIndex(model.getRowById(4)), -1);
        assert.deepEqual(model._getRowInfo(model.getRowById(5)), {
            level: 3,
            position: 1,
            size: 1,
            expandable: false,
            expanded: false,
            loading: false,
        });

        // Matching rows show without their children that do not match.
        filter.query = 'widgets';
        assert.deepEqual(names(model), ['src', 'widgets']);
        assert.equal(model.hasChildren(model.getRowById(3)), false);

        // Collapsing a row that was expanded by the filter.
        filter.query = '.js';
        assert.equal(model.rowsCount, 5);
        model.collapse(model.getRowById(3));
        assert.deepEqual(names(model), ['src', 'main.js', 'widgets']);

        // Removing the filter restores the expansion of the user.
        model.removeFilter(filter);
        assert.deepEqual(names(model), ['src', 'docs', 'README.md']);
        assert.equal(model.filtersCount, 0);

        // Changed rows are filtered again.
        model.filters = [filter];
        filter.query = 'guide';
        assert.deepEqual(names(model), ['docs', 'guide.md']);
        model.updateRow(model.getRowById(4), { name: 'guide.js' });
        assert.deepEqual(names(model), ['src', 'widgets', 'guide.js', 'docs', 'guide.md']);
    });

    test('sorts every level again when the locale changes', () => {
        const model = new TreeModel({
            rows: [
                { name: 'z' },
                { name: 'a', children: [{ name: 'z' }, { name: 'ä' }] },
                { name: 'ä' },
            ],
            sortColumn: 'name',
        });
        model.expandAll();

        try {
            // Swedish sorts 'ä' after 'z'.
            getLocaleManager().locale = 'sv-SE';
            assert.deepEqual(
                model.rows.map((x) => x.name),
                ['a', 'z', 'ä', 'z', 'ä']
            );
        } finally {
            getLocaleManager().locale = 'en-US';
        }

        assert.deepEqual(
            model.rows.map((x) => x.name),
            ['a', 'ä', 'z', 'ä', 'z']
        );
    });

    test('filters once when many rows are inserted at once', () => {
        const filter = new SearchFilter({ query: 'row' });
        const isVisibleRow = filter.isVisibleRow.bind(filter);
        let calls = 0;
        filter.isVisibleRow = (row) => (++calls, isVisibleRow(row));

        const model = new TreeModel({
            rows: Array.from({ length: 1000 }, (_x, i) => ({ id: i, name: `row ${i}` })),
            idColumn: 'id',
            filters: [filter],
        });

        calls = 0;
        model.insertRows(0, [
            ...Array.from({ length: 100 }, (_x, i) => ({ id: 1000 + i, name: `row ${1000 + i}` })),
            { id: 2000, name: 'other' },
        ]);

        // Filtering the whole tree after every row would take 100,000 calls.
        assert.ok(calls <= 2 * 1101);
        assert.equal(model.rowsCount, 1100);
        assert.equal(model.getRowIndex(model.getRowById(1000)), 0);
    });

    test('signals many changes at once as a reorder', () => {
        const children = Array.from({ length: 1000 }, (_x, i) => ({ id: i + 1, name: `${i}` }));
        const model = new TreeModel({ rows: [{ id: 0, name: 'root', children }], idColumn: 'id' });
        const log = record(model);

        model.expand(0);
        assert.equal(model.rowsCount, 1001);
        assert.deepEqual(log[0], ['rows-reorder']);

        log.length = 0;
        model.collapse(0);
        assert.equal(model.rowsCount, 1);
        assert.deepEqual(log[0], ['rows-reorder']);
    });

    test('keeps selections across expanding, collapsing and sorting', () => {
        for (const idColumn of ['id', null]) {
            const model = createModel({ idColumn });
            const selection = new Selection({ model, selectionMode: SelectionMode.MULTIPLE });

            model.expandAll();
            const label = model.getRowById(idColumn ? 5 : model.getRowByPath([0, 1, 1]));
            const readme = model.getRowByPath([2]);

            selection.select(model.getRowIndex(label));
            selection.select(model.getRowIndex(readme));

            model.collapse(model.getRowById(idColumn ? 6 : model.getRowByPath([1])));
            model.sortByColumn('name', SortOrder.DESCENDING);
            assert.deepEqual(selection.selectedRows, [label, readme]);
            assert.deepEqual(selection.selectedIndices, [
                model.getRowIndex(label),
                model.getRowIndex(readme),
            ]);

            // Rows hidden in a collapsed row are unselected, like in GTK.
            model.collapse(model.getRowByPath([0]));
            assert.deepEqual(selection.selectedRows, [readme]);
        }
    });

    test('reads the children from another column', () => {
        const model = new TreeModel({
            childrenColumn: 'items',
            rows: [{ name: 'a', items: [{ name: 'b' }] }],
        });

        model.expand(0);
        assert.deepEqual(names(model), ['a', 'b']);
    });
});
