// Browser tests of tables with tree models (tree views): rendering, ARIA, mouse, keyboard, lazy
// loading, filtering, sorting and virtualization of large trees.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Creates a tree view of a small file system in a main window, as globalThis.table and
// globalThis.model. With `lazy`, the "lazy" folder loads its children after a delay.
async function createTree(page, { lazy = false, sorted = false } = {}) {
    await page.evaluate(
        async ({ lazy, sorted }) => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Table } = await import('/src/widgets/table.js');
            const { TreeModel } = await import('/src/data/tree-model.js');
            const { TextColumn } = await import('/src/columns/text-column.js');
            const { NumberColumn } = await import('/src/columns/number-column.js');
            const { SelectionModes } = await import('/src/core/enums.js');
            const { flushLayout } = await import('/src/widgets/widget.js');
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');

            getLocaleManager().locale = 'en-US';

            const host = document.createElement('div');
            host.style.cssText = 'position: fixed; left: 0; top: 0; width: 500px; height: 400px;';
            document.body.append(host);

            const rows = [
                {
                    id: 1,
                    name: 'src',
                    children: [
                        { id: 2, name: 'main.js', size: 10 },
                        {
                            id: 3,
                            name: 'widgets',
                            children: [
                                { id: 4, name: 'button.js', size: 30 },
                                { id: 5, name: 'label.js', size: 20 },
                            ],
                        },
                    ],
                },
                { id: 6, name: 'docs', children: [{ id: 7, name: 'guide.md', size: 5 }] },
                { id: 8, name: 'lazy', hasChildren: true },
                { id: 9, name: 'README.md', size: 1 },
            ];

            globalThis.loads = [];
            globalThis.release = null;

            const model = new TreeModel({
                rows,
                idColumn: 'id',
                sortColumn: sorted ? 'name' : null,
                loadChildren: lazy
                    ? (row) => {
                          globalThis.loads.push(row.name);

                          return new Promise((resolve) => {
                              globalThis.release = () =>
                                  resolve([
                                      { id: 10, name: 'first', size: 1 },
                                      { id: 11, name: 'second', size: 2 },
                                  ]);
                          });
                      }
                    : null,
            });

            const window = new MainWindow({ host });
            const table = new Table({ model, selectionModes: SelectionModes.MULTI });

            table.addColumn(new TextColumn({ name: 'name', label: 'Name', expand: true }));
            table.addColumn(new NumberColumn({ name: 'size', label: 'Size', digits: 0 }));

            window.addChild(table);
            window.show();
            flushLayout();

            globalThis.activated = [];
            table.connect('row-activate', (_table, _index, row) =>
                globalThis.activated.push(row.name)
            );

            globalThis.table = table;
            globalThis.model = model;
            globalThis.flushLayout = flushLayout;
        },
        { lazy, sorted }
    );

    await page.waitForFunction(
        () => globalThis.table.rowHeight > 0 && document.querySelector('.wy-table-row')
    );
}

function row(page, name) {
    return page.locator('.wy-table-body > .wy-table-row:not([hidden])', {
        has: page.locator('.wy-table-tree-content', { hasText: new RegExp(`^${name}$`) }),
    });
}

function expander(page, name) {
    return row(page, name).locator('.wy-table-expander');
}

// The names of the shown rows, in order.
async function shownNames(page) {
    return page.evaluate(() => {
        globalThis.flushLayout();

        return globalThis.model.rows.map((x) => x.name);
    });
}

async function cursorName(page) {
    return page.evaluate(() => globalThis.model.getRow(globalThis.table.cursor).name);
}

test.describe('Tree view', () => {
    test('renders a tree with ARIA treegrid semantics and indentation', async ({ page }) => {
        const errors = await openHarness(page);
        await createTree(page);

        await page.evaluate(() => {
            globalThis.model.expand(0);
            globalThis.model.expand(globalThis.model.getRowById(3));
            globalThis.flushLayout();
        });

        const result = await page.evaluate(() => {
            const rows = [...document.querySelectorAll('.wy-table-body > .wy-table-row')]
                .filter((x) => !x.hidden)
                .sort((a, b) => a.ariaRowIndex - b.ariaRowIndex);

            return {
                role: document.querySelector('.wy-table').getAttribute('role'),
                rows: rows.map((x) => [
                    x.querySelector('.wy-table-tree-content').textContent,
                    x.getAttribute('aria-level'),
                    x.getAttribute('aria-expanded'),
                    x.getAttribute('aria-posinset'),
                    x.getAttribute('aria-setsize'),
                ]),
                indents: rows.map(
                    (x) =>
                        x.querySelector('.wy-table-tree-content').getBoundingClientRect().left -
                        x.getBoundingClientRect().left
                ),
                leaf: rows[1].querySelector('.wy-table-expander').classList.contains('wy-leaf'),
            };
        });

        expect(errors).toEqual([]);
        expect(result.role).toBe('treegrid');
        expect(result.rows).toEqual([
            ['src', '1', 'true', '1', '4'],
            ['main.js', '2', null, '1', '2'],
            ['widgets', '2', 'true', '2', '2'],
            ['button.js', '3', null, '1', '2'],
            ['label.js', '3', null, '2', '2'],
            ['docs', '1', 'false', '2', '4'],
            ['lazy', '1', 'false', '3', '4'],
            ['README.md', '1', null, '4', '4'],
        ]);
        expect(result.indents[1] - result.indents[0]).toBe(16);
        expect(result.indents[3] - result.indents[0]).toBe(32);
        expect(result.indents[7]).toBe(result.indents[0]);
        expect(result.leaf).toBe(true);

        // More indentation per level, and no expanders.
        const indents = await page.evaluate(() => {
            const table = globalThis.table;
            table.levelIndentation = 8;
            globalThis.flushLayout();

            const left = (name) => {
                const element = [...document.querySelectorAll('.wy-table-tree-content')].find(
                    (x) => x.textContent === name
                );

                return element.getBoundingClientRect().left;
            };

            const withExpanders = left('button.js') - left('src');

            table.showExpanders = false;
            globalThis.flushLayout();

            return { withExpanders, withoutExpanders: left('button.js') - left('src') };
        });

        expect(indents).toEqual({ withExpanders: 48, withoutExpanders: 16 });
    });

    test('toggles rows by clicking expanders, without selecting them', async ({ page }) => {
        await openHarness(page);
        await createTree(page);

        await expander(page, 'src').click();
        expect(await shownNames(page)).toEqual([
            'src',
            'main.js',
            'widgets',
            'docs',
            'lazy',
            'README.md',
        ]);
        expect(await page.evaluate(() => globalThis.table.selection.selectedRowIds)).toEqual([]);
        await expect(row(page, 'src')).toHaveAttribute('aria-expanded', 'true');
        await expect(expander(page, 'src')).toHaveClass(/wy-expanded/);

        // Shift+click collapses recursively, and expands recursively.
        await expander(page, 'src').click({ modifiers: ['Shift'] });
        expect(await shownNames(page)).toEqual(['src', 'docs', 'lazy', 'README.md']);

        await expander(page, 'src').click({ modifiers: ['Shift'] });
        expect((await shownNames(page)).slice(0, 5)).toEqual([
            'src',
            'main.js',
            'widgets',
            'button.js',
            'label.js',
        ]);

        // Double clicking an expander toggles twice and does not activate the row.
        await expander(page, 'docs').dblclick();
        expect(await page.evaluate(() => globalThis.activated)).toEqual([]);
        expect(await page.evaluate(() => globalThis.model.isExpanded(5))).toBe(false);

        // Clicking a row selects it, and double clicking activates it.
        await row(page, 'widgets').click();
        expect(await page.evaluate(() => globalThis.table.selection.selectedRowIds)).toEqual([3]);

        await row(page, 'button.js').dblclick();
        expect(await page.evaluate(() => globalThis.activated)).toEqual(['button.js']);
    });

    test('expands, collapses and navigates with the keyboard like GTK', async ({ page }) => {
        await openHarness(page);
        await createTree(page);

        await row(page, 'src').click();

        // Right expands, and then moves to the first child.
        await page.keyboard.press('ArrowRight');
        expect(await page.evaluate(() => globalThis.model.isExpanded(0))).toBe(true);
        expect(await cursorName(page)).toBe('src');

        await page.keyboard.press('ArrowRight');
        expect(await cursorName(page)).toBe('main.js');

        // Right on a leaf does nothing; Left moves to the parent.
        await page.keyboard.press('ArrowRight');
        expect(await cursorName(page)).toBe('main.js');

        await page.keyboard.press('ArrowLeft');
        expect(await cursorName(page)).toBe('src');

        // Left collapses.
        await page.keyboard.press('ArrowLeft');
        expect(await shownNames(page)).toEqual(['src', 'docs', 'lazy', 'README.md']);

        // Shift+Right expands recursively, Shift+Left collapses recursively.
        await page.keyboard.press('Shift+ArrowRight');
        expect(await page.evaluate(() => globalThis.model.rowsCount)).toBe(8);

        await page.keyboard.press('Shift+ArrowLeft');
        expect(await page.evaluate(() => globalThis.model.rowsCount)).toBe(4);

        await page.keyboard.press('ArrowRight');
        expect(await page.evaluate(() => globalThis.model.isExpanded(2))).toBe(false);

        // +, - and * (also on the numeric keypad).
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        expect(await cursorName(page)).toBe('widgets');

        await page.keyboard.press('NumpadAdd');
        expect(await page.evaluate(() => globalThis.model.isExpanded(2))).toBe(true);

        await page.keyboard.press('-');
        expect(await page.evaluate(() => globalThis.model.isExpanded(2))).toBe(false);

        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('NumpadMultiply');
        expect(await page.evaluate(() => globalThis.model.rowsCount)).toBe(8);

        // Expanding again shows the descendants as they were.
        await page.keyboard.press('NumpadSubtract');
        expect(await page.evaluate(() => globalThis.model.rowsCount)).toBe(4);

        await page.keyboard.press('+');
        expect(await page.evaluate(() => globalThis.model.rowsCount)).toBe(8);

        // Collapsing a row with the cursor in it moves the cursor to the row.
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        expect(await cursorName(page)).toBe('label.js');

        await page.evaluate(() => globalThis.model.collapse(0));
        expect(await cursorName(page)).toBe('src');

        // Backspace moves to the parent; Enter activates.
        await page.evaluate(() => globalThis.model.expand(0));
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        expect(await cursorName(page)).toBe('widgets');

        await page.keyboard.press('Backspace');
        expect(await cursorName(page)).toBe('src');

        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => globalThis.activated)).toEqual(['src']);

        // Type-ahead search still works.
        await page.keyboard.type('d');
        expect(await cursorName(page)).toBe('docs');
    });

    test('keeps the selection while rows are expanded, collapsed and sorted', async ({ page }) => {
        await openHarness(page);
        await createTree(page);

        await page.evaluate(() => globalThis.model.expandAll());
        await row(page, 'main.js').click();
        await row(page, 'guide.md').click({ modifiers: ['Control'] });

        const result = await page.evaluate(() => {
            const { model, table } = globalThis;

            model.collapse(model.getRowById(3));
            const collapsed = table.selection.selectedRowIds;

            model.sortByColumn('name');
            const sorted = table.selection.selectedRowIds;
            const indices = table.selection.selectedIndices.map((x) => model.getRow(x).name);

            model.collapse(model.getRowById(6));

            return {
                collapsed,
                sorted,
                indices,
                hidden: table.selection.selectedRowIds,
            };
        });

        expect(result.collapsed).toEqual([2, 7]);
        expect(result.sorted).toEqual([2, 7]);
        expect(result.indices).toEqual(['guide.md', 'main.js']);
        expect(result.hidden).toEqual([2]);

        // Rows of each level are sorted by clicking the header.
        await page.locator('.wy-table-column-header', { hasText: 'Name' }).click();
        expect(await shownNames(page)).toEqual([
            'src',
            'widgets',
            'main.js',
            'README.md',
            'lazy',
            'docs',
        ]);
        await expect(row(page, 'main.js')).toHaveClass(/wy-selected/);
    });

    test('loads children lazily and shows the loading state', async ({ page }) => {
        await openHarness(page);
        await createTree(page, { lazy: true });

        await expect(row(page, 'lazy')).toHaveAttribute('aria-expanded', 'false');
        await expander(page, 'lazy').click();

        await expect(row(page, 'lazy')).toHaveAttribute('aria-busy', 'true');
        await expect(expander(page, 'lazy')).toHaveClass(/wy-loading/);
        expect(await page.evaluate(() => globalThis.loads)).toEqual(['lazy']);

        await page.evaluate(() => globalThis.release());
        await expect(row(page, 'second')).toBeVisible();
        await expect(row(page, 'lazy')).not.toHaveAttribute('aria-busy', 'true');
        await expect(row(page, 'first')).toHaveAttribute('aria-level', '2');
        expect(await shownNames(page)).toEqual([
            'src',
            'docs',
            'lazy',
            'first',
            'second',
            'README.md',
        ]);

        // The children are loaded once.
        await expander(page, 'lazy').click();
        await expander(page, 'lazy').click();
        expect(await page.evaluate(() => globalThis.loads)).toEqual(['lazy']);
    });

    test('filters rows, showing the ancestors of matches expanded', async ({ page }) => {
        await openHarness(page);
        await createTree(page);

        const result = await page.evaluate(async () => {
            const { SearchFilter } = await import('/src/data/filters/search-filter.js');
            const { model } = globalThis;
            const filter = new SearchFilter({ columns: ['name'] });

            model.addFilter(filter);
            const empty = model.rows.map((x) => x.name);

            filter.query = 'label';
            globalThis.flushLayout();

            const shown = [...document.querySelectorAll('.wy-table-body > .wy-table-row')]
                .filter((x) => !x.hidden)
                .map((x) => [
                    x.querySelector('.wy-table-tree-content').textContent,
                    x.getAttribute('aria-setsize'),
                    x.getAttribute('aria-expanded'),
                ])
                .sort();

            filter.query = '';

            return { empty, shown, restored: model.rows.map((x) => x.name) };
        });

        expect(result.empty).toEqual(['src', 'docs', 'lazy', 'README.md']);
        expect(result.shown).toEqual([
            ['label.js', '1', null],
            ['src', '1', 'true'],
            ['widgets', '1', 'true'],
        ]);
        expect(result.restored).toEqual(['src', 'docs', 'lazy', 'README.md']);
    });

    test('uses the tree column and switches between tree and list models', async ({ page }) => {
        await openHarness(page);
        await createTree(page);

        const result = await page.evaluate(async () => {
            const { ListModel } = await import('/src/data/list-model.js');
            const { table, model } = globalThis;

            table.treeColumn = table.getColumn(1);
            globalThis.flushLayout();

            const treeCells = [...document.querySelectorAll('.wy-table-tree-cell')].length;
            const inSize = document.querySelector(
                '.wy-table-row:not([hidden]) .wy-table-cell:nth-child(2) .wy-table-expander'
            );

            table.model = new ListModel({ rows: [{ name: 'a' }] });
            globalThis.flushLayout();

            const list = {
                role: table.el.getAttribute('role'),
                expanders: document.querySelectorAll('.wy-table-expander').length,
                level: document.querySelector('.wy-table-row').getAttribute('aria-level'),
            };

            table.model = model;
            globalThis.flushLayout();

            return {
                treeCells,
                inSize: Boolean(inSize),
                list,
                role: table.el.getAttribute('role'),
            };
        });

        expect(result.treeCells).toBeGreaterThan(0);
        expect(result.inSize).toBe(true);
        expect(result.list).toEqual({ role: 'grid', expanders: 0, level: null });
        expect(result.role).toBe('treegrid');
    });

    test('renders only the visible rows of a lazy tree of 100,000 rows', async ({ page }) => {
        await openHarness(page);

        await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Table } = await import('/src/widgets/table.js');
            const { TreeModel } = await import('/src/data/tree-model.js');
            const { TextColumn } = await import('/src/columns/text-column.js');
            const { SelectionModes } = await import('/src/core/enums.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const host = document.createElement('div');
            host.style.cssText = 'position: fixed; left: 0; top: 0; width: 500px; height: 400px;';
            document.body.append(host);

            // 100 folders of 999 files, loaded when expanded.
            const rows = Array.from({ length: 100 }, (_x, i) => ({
                id: `folder ${i}`,
                name: `folder ${i}`,
                hasChildren: true,
            }));

            globalThis.loaded = 0;
            const model = new TreeModel({
                rows,
                idColumn: 'id',
                loadChildren(row) {
                    ++globalThis.loaded;

                    return Array.from({ length: 999 }, (_x, i) => ({
                        id: `${row.id}/file ${i}`,
                        name: `file ${i}`,
                    }));
                },
            });

            const window = new MainWindow({ host });
            const table = new Table({ model, selectionModes: SelectionModes.MULTI });
            table.addColumn(new TextColumn({ name: 'name', label: 'Name', expand: true }));

            window.addChild(table);
            window.show();
            flushLayout();

            globalThis.table = table;
            globalThis.model = model;
            globalThis.flushLayout = flushLayout;
        });

        await page.waitForFunction(
            () => globalThis.table.rowHeight > 0 && document.querySelector('.wy-table-row')
        );

        const result = await page.evaluate(async () => {
            const { table, model } = globalThis;
            const start = performance.now();

            model.expandAll();
            globalThis.flushLayout();

            const expandTime = performance.now() - start;
            const count = model.rowsCount;

            table.scrollToRow(count - 1);
            table.cursor = count - 1;
            table.selection.selectOnly(count - 1);
            await new Promise((resolve) => requestAnimationFrame(resolve));

            const rendered = [...document.querySelectorAll('.wy-table-body > .wy-table-row')]
                .filter((x) => !x.hidden)
                .sort((a, b) => a.ariaRowIndex - b.ariaRowIndex);
            const last = rendered.at(-1);
            const height = document.querySelector('.wy-table-body').offsetHeight;

            // Collapsing the last folder moves the cursor and keeps the rendering in sync.
            const before = performance.now();
            model.collapse(model.getRowById('folder 99'));
            globalThis.flushLayout();
            const collapseTime = performance.now() - before;

            return {
                loaded: globalThis.loaded,
                count,
                rendered: rendered.length,
                lastText: last.querySelector('.wy-table-tree-content').textContent,
                lastLevel: last.getAttribute('aria-level'),
                lastPosition: last.getAttribute('aria-posinset'),
                lastSize: last.getAttribute('aria-setsize'),
                height,
                expandTime,
                collapseTime,
                cursor: model.getRow(table.cursor).name,
                countAfter: model.rowsCount,
                selected: table.selection.selectedRowIds,
            };
        });

        expect(result.loaded).toBe(100);
        expect(result.count).toBe(100000);
        expect(result.rendered).toBeLessThan(50);
        expect(result.lastText).toBe('file 998');
        expect(result.lastLevel).toBe('2');
        expect(result.lastPosition).toBe('999');
        expect(result.lastSize).toBe('999');
        expect(result.height).toBe(100000 * 24);
        expect(result.expandTime).toBeLessThan(2000);
        expect(result.collapseTime).toBeLessThan(500);
        expect(result.cursor).toBe('folder 99');
        expect(result.countAfter).toBe(100000 - 999);
        expect(result.selected).toEqual([]);

        // The rows in view are rendered after scrolling up.
        await page.mouse.move(250, 200);
        await page.mouse.wheel(0, -5000);
        await page.waitForTimeout(100);

        const covered = await page.evaluate(() => {
            const view = document.querySelector('.wy-table-view').getBoundingClientRect();
            const element = document.elementFromPoint(view.left + 50, view.top + 100);

            return Boolean(element?.closest('.wy-table-row'));
        });

        expect(covered).toBe(true);
    });
});
