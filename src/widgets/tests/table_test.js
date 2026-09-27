// Browser tests of the table: rendering, virtualization, sorting, selection, keyboard, resizing and
// model changes.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Creates a table with the given number of rows in a main window, as globalThis.table.
async function createTable(
    page,
    { count = 50, selectionMode = 'multiple', height = 300, sorted = false } = {}
) {
    await page.evaluate(
        async ({ count, selectionMode, height, sorted }) => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Table } = await import('/src/widgets/table.js');
            const { ListModel } = await import('/src/data/list-model.js');
            const { IndexColumn } = await import('/src/columns/index-column.js');
            const { TextColumn } = await import('/src/columns/text-column.js');
            const { NumberColumn } = await import('/src/columns/number-column.js');
            const { CheckBoxColumn } = await import('/src/columns/check-box-column.js');
            const { flushLayout } = await import('/src/widgets/widget.js');
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');

            getLocaleManager().locale = 'en-US';

            const host = document.createElement('div');
            host.style.cssText = `position: fixed; left: 0; top: 0; width: 600px; height: ${height}px;`;
            document.body.append(host);

            const names = ['delta', 'alpha', 'echo', 'charlie', 'bravo'];
            const rows = Array.from({ length: count }, (_x, i) => ({
                id: i,
                name: `${names[i % names.length]} ${i}`,
                value: (i * 37) % 100,
                done: i % 2 === 0,
            }));

            const model = new ListModel({
                rows,
                idColumn: 'id',
                sortColumn: sorted ? 'name' : null,
            });
            const window = new MainWindow({ host });
            const table = new Table({ model, selectionMode });

            table.addColumn(new IndexColumn());
            table.addColumn(new TextColumn({ name: 'name', label: 'Name', expand: true }));
            table.addColumn(new NumberColumn({ name: 'value', label: 'Value', digits: 0 }));
            table.addColumn(new CheckBoxColumn({ name: 'done', label: 'Done' }));

            window.addChild(table);
            window.show();
            flushLayout();

            globalThis.table = table;
            globalThis.model = model;
            globalThis.flushLayout = flushLayout;
        },
        { count, selectionMode, height, sorted }
    );

    // Wait until the rows are measured and rendered.
    await page.waitForFunction(
        () => globalThis.table.rowHeight > 0 && document.querySelector('.wy-table-row')
    );
}

function row(page, index) {
    return page.locator(`.wy-table-body > .wy-table-row[aria-rowindex="${index + 2}"]`);
}

function header(page, label) {
    return page.locator('.wy-table-view .wy-table-column-header', { hasText: label });
}

async function selectedIds(page) {
    return page.evaluate(() => globalThis.table.selection.selectedRowIds);
}

test.describe('Table', () => {
    test('renders rows with ARIA grid semantics', async ({ page }) => {
        const errors = await openHarness(page);
        await createTable(page, { count: 5 });

        const result = await page.evaluate(() => {
            const table = globalThis.table;
            const cells = [
                ...document.querySelectorAll('.wy-table-row[aria-rowindex="3"] .wy-table-cell'),
            ];

            return {
                role: table.el.getAttribute('role'),
                rowCount: table.el.getAttribute('aria-rowcount'),
                multi: table.el.getAttribute('aria-multiselectable'),
                headers: [...document.querySelectorAll('.wy-table-view [role="columnheader"]')].map(
                    (x) => x.textContent.trim()
                ),
                texts: cells.map((x) => x.textContent),
                roles: cells.map((x) => x.getAttribute('role')),
                check: cells[3].querySelector('[role="checkbox"]').getAttribute('aria-checked'),
                odd: document
                    .querySelector('.wy-table-row[aria-rowindex="3"]')
                    .classList.contains('wy-odd'),
                rowHeight: table.rowHeight,
                tabIndex: table.el.tabIndex,
            };
        });

        expect(errors).toEqual([]);
        expect(result.role).toBe('grid');
        expect(result.rowCount).toBe('6');
        expect(result.multi).toBe('true');
        expect(result.headers).toEqual(['#', 'Name', 'Value', 'Done']);
        expect(result.texts).toEqual(['2', 'alpha 1', '37', '']);
        expect(result.roles).toEqual(['gridcell', 'gridcell', 'gridcell', 'gridcell']);
        expect(result.check).toBe('false');
        expect(result.odd).toBe(true);
        expect(result.rowHeight).toBe(24);
        expect(result.tabIndex).toBe(0);
    });

    test('renders only the visible rows of 100,000 rows and follows scrolling', async ({
        page,
    }) => {
        await openHarness(page);
        await createTable(page, { count: 100000 });

        const initial = await page.evaluate(() => ({
            rows: document.querySelectorAll('.wy-table-body > .wy-table-row:not([hidden])').length,
            height: document.querySelector('.wy-table-body').offsetHeight,
        }));

        expect(initial.rows).toBeLessThan(40);
        expect(initial.height).toBe(100000 * 24);

        // Scroll with the wheel, and check that the viewport is fully covered by rows.
        await page.mouse.move(300, 150);
        for (let i = 0; i < 5; ++i) {
            await page.mouse.wheel(0, 700);
        }

        await page.waitForTimeout(100);

        const scrolled = await page.evaluate(() => {
            const view = document.querySelector('.wy-table-view');
            const rows = [
                ...document.querySelectorAll('.wy-table-body > .wy-table-row:not([hidden])'),
            ];
            const indices = rows
                .map((x) => Number(x.getAttribute('aria-rowindex')) - 2)
                .sort((a, b) => a - b);
            const first = Math.floor(view.scrollTop / 24);
            const last = Math.floor((view.scrollTop + view.clientHeight - 25) / 24);

            return {
                scrollTop: view.scrollTop,
                count: rows.length,
                covered: indices[0] <= first && indices.at(-1) >= last,
                text: document.querySelector(
                    `.wy-table-row[aria-rowindex="${first + 2}"] .wy-table-cell`
                ).textContent,
                first,
            };
        });

        expect(scrolled.scrollTop).toBeGreaterThan(1000);
        expect(scrolled.count).toBeLessThan(40);
        expect(scrolled.covered).toBe(true);
        expect(scrolled.text).toBe(String(scrolled.first + 1));

        // Jump to the end.
        const end = await page.evaluate(() => {
            globalThis.table.scrollToRow(99999);

            return document.querySelector('.wy-table-row[aria-rowindex="100001"] .wy-table-cell')
                ?.textContent;
        });

        expect(end).toBe('100000');
    });

    test('sorts by clicking headers and shows the sort indicator', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 10 });

        const name = header(page, 'Name');
        await name.click();

        const ascending = await page.evaluate(() => ({
            sortColumn: globalThis.model.sortColumn,
            order: globalThis.model.sortOrder,
            first: globalThis.model.getRow(0).name,
            text: document.querySelector(
                '.wy-table-row[aria-rowindex="2"] .wy-table-cell:nth-child(2)'
            ).textContent,
        }));

        expect(ascending).toEqual({
            sortColumn: 'name',
            order: 'ascending',
            first: 'alpha 1',
            text: 'alpha 1',
        });
        await expect(name).toHaveAttribute('aria-sort', 'ascending');
        await expect(name).toHaveClass(/wy-sort-ascending/);
        expect(await page.evaluate(() => globalThis.table.getColumn(1).sortIndicator)).toBe(
            'ascending'
        );

        await name.click();
        await expect(name).toHaveAttribute('aria-sort', 'descending');
        expect(await page.evaluate(() => globalThis.model.getRow(0).name)).toBe('echo 7');

        // Like the original, a third click sorts ascending again.
        await name.click();
        await expect(name).toHaveAttribute('aria-sort', 'ascending');

        // With allowUnsorted, descending is followed by unsorted.
        await page.evaluate(() => (globalThis.table.allowUnsorted = true));
        await name.click();
        await name.click();
        await expect(name).toHaveAttribute('aria-sort', 'none');
        expect(await page.evaluate(() => globalThis.model.sortColumn)).toBe(null);

        // Sorting on another column moves the indicator.
        await header(page, 'Value').click();
        await expect(header(page, 'Value')).toHaveAttribute('aria-sort', 'ascending');
        await expect(name).toHaveAttribute('aria-sort', 'none');

        // The index column is not sortable.
        await expect(header(page, '#')).not.toHaveAttribute('aria-sort');
    });

    test('selects with click, shift and control', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 20 });

        await row(page, 2).click();
        expect(await selectedIds(page)).toEqual([2]);

        await row(page, 5).click({ modifiers: ['Shift'] });
        expect((await selectedIds(page)).sort()).toEqual([2, 3, 4, 5]);

        await row(page, 8).click({ modifiers: ['Control'] });
        await row(page, 3).click({ modifiers: ['Control'] });
        expect((await selectedIds(page)).sort((a, b) => a - b)).toEqual([2, 4, 5, 8]);

        // Control+Shift extends from the anchor (row 3) without dropping the selection.
        await row(page, 1).click({ modifiers: ['Control', 'Shift'] });
        expect((await selectedIds(page)).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 8]);

        await row(page, 6).click();
        expect(await selectedIds(page)).toEqual([6]);

        await expect(row(page, 6)).toHaveClass(/wy-selected/);
        await expect(row(page, 6)).toHaveAttribute('aria-selected', 'true');
        await expect(row(page, 5)).toHaveAttribute('aria-selected', 'false');

        const cursor = await page.evaluate(() => globalThis.table.cursor);
        expect(cursor).toBe(6);
    });

    test('selects one row by default, like GTK', async ({ page }) => {
        await openHarness(page);
        await page.evaluate(async () => {
            const { Table } = await import('/src/widgets/table.js');
            const { SelectionMode } = await import('/src/core/enums.js');
            const table = new Table();

            globalThis.defaults = {
                table: table.selectionMode,
                selection: table.selection.selectionMode,
                toggle: table.toggleSelection,
                single: SelectionMode.SINGLE,
            };

            let error = null;
            try {
                table.selectionMode = 2;
            } catch (caught) {
                error = caught.name;
            }

            globalThis.defaults.error = error;
            globalThis.defaults.after = table.selectionMode;
        });

        expect(await page.evaluate(() => globalThis.defaults)).toEqual({
            table: 'single',
            selection: 'single',
            toggle: false,
            single: 'single',
            error: 'RangeError',
            after: 'single',
        });
    });

    test('supports the single, browse and none selection modes', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 10, selectionMode: 'single' });

        await expect(page.locator('.wy-table')).not.toHaveAttribute('aria-multiselectable');

        await row(page, 1).click();
        await row(page, 3).click({ modifiers: ['Shift'] });
        expect(await selectedIds(page)).toEqual([3]);

        // A click keeps a selected row selected, and a Control+click unselects it.
        await row(page, 3).click();
        expect(await selectedIds(page)).toEqual([3]);
        await row(page, 3).click({ modifiers: ['Control'] });
        expect(await selectedIds(page)).toEqual([]);

        // With browse, the row cannot be unselected, and the cursor row is always selected.
        await page.evaluate(() => (globalThis.table.selectionMode = 'browse'));
        expect(await page.evaluate(() => globalThis.table.selection.selectionMode)).toBe('browse');

        await row(page, 2).click();
        await row(page, 2).click({ modifiers: ['Control'] });
        expect(await selectedIds(page)).toEqual([2]);

        await page.keyboard.press('Control+Space');
        expect(await selectedIds(page)).toEqual([2]);

        await page.keyboard.press('Control+ArrowDown');
        expect(await selectedIds(page)).toEqual([3]);
        expect(await page.evaluate(() => globalThis.table.cursor)).toBe(3);

        await page.keyboard.press('Control+a');
        expect(await selectedIds(page)).toEqual([3]);

        await page.evaluate(() => (globalThis.table.selectionMode = 'none'));
        expect(await selectedIds(page)).toEqual([]);
        await row(page, 2).click();
        expect(await selectedIds(page)).toEqual([]);
        await expect(row(page, 2)).not.toHaveAttribute('aria-selected');
    });

    test('toggles the selection with a click with toggleSelection', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 10, selectionMode: 'single' });

        await page.evaluate(() => (globalThis.table.toggleSelection = true));
        expect(await page.evaluate(() => globalThis.table.selection.toggleSelection)).toBe(true);

        await row(page, 3).click();
        expect(await selectedIds(page)).toEqual([3]);
        await row(page, 3).click();
        expect(await selectedIds(page)).toEqual([]);

        // With browse, a click never unselects.
        await page.evaluate(() => (globalThis.table.selectionMode = 'browse'));
        await row(page, 4).click();
        await row(page, 4).click();
        expect(await selectedIds(page)).toEqual([4]);

        // With multiple, a click adds or removes a row.
        await page.evaluate(() => (globalThis.table.selectionMode = 'multiple'));
        await expect(page.locator('.wy-table')).toHaveAttribute('aria-multiselectable', 'true');

        await row(page, 1).click();
        await row(page, 6).click();
        await row(page, 1).click();
        expect((await selectedIds(page)).sort((a, b) => a - b)).toEqual([4, 6]);

        await page.evaluate(() => (globalThis.table.toggleSelection = false));
        await row(page, 1).click();
        expect(await selectedIds(page)).toEqual([1]);
    });

    test('navigates with the keyboard', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 100 });

        await row(page, 0).click();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        expect(await selectedIds(page)).toEqual([2]);

        await page.keyboard.press('Shift+ArrowDown');
        await page.keyboard.press('Shift+ArrowDown');
        expect((await selectedIds(page)).sort()).toEqual([2, 3, 4]);

        // Control moves only the cursor; Control+Space toggles the cursor row.
        await page.keyboard.press('Control+ArrowDown');
        await page.keyboard.press('Control+ArrowDown');
        await page.keyboard.press('Control+Space');
        expect((await selectedIds(page)).sort()).toEqual([2, 3, 4, 6]);
        await expect(row(page, 6)).toHaveClass(/wy-cursor/);
        await expect(page.locator('.wy-table')).toHaveAttribute(
            'aria-activedescendant',
            await row(page, 6).getAttribute('id')
        );

        await page.keyboard.press('End');
        expect(await selectedIds(page)).toEqual([99]);
        await expect(row(page, 99)).toBeVisible();

        await page.keyboard.press('Home');
        await page.keyboard.press('PageDown');
        const page1 = await page.evaluate(() => globalThis.table.cursor);
        expect(page1).toBeGreaterThan(5);

        await page.keyboard.press('Shift+PageUp');
        expect((await selectedIds(page)).length).toBe(page1 + 1);

        await page.keyboard.press('Control+a');
        expect((await selectedIds(page)).length).toBe(100);

        // Enter activates the cursor row.
        await page.evaluate(() => {
            globalThis.activated = [];
            globalThis.table.connect('row-activate', (_table, index, row) =>
                globalThis.activated.push([index, row.id])
            );
        });
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => globalThis.activated)).toEqual([[1, 1]]);
    });

    test('moves the focus to the headers and sorts from them', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 10 });

        await row(page, 0).click();
        await page.keyboard.press('ArrowUp');

        await expect(header(page, '#')).toBeFocused();
        await page.keyboard.press('ArrowRight');
        await expect(header(page, 'Name')).toBeFocused();
        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => globalThis.model.sortColumn)).toBe('name');

        // The table keeps the focus state while a header has the focus.
        await expect(page.locator('.wy-table')).toHaveClass(/wy-focus/);

        const before = await header(page, 'Value').evaluate((x) => x.getBoundingClientRect().width);
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Shift+ArrowRight');
        const after = await header(page, 'Value').evaluate((x) => x.getBoundingClientRect().width);
        expect(after).toBe(before + 10);

        await page.keyboard.press('ArrowDown');
        await expect(page.locator('.wy-table')).toBeFocused();
    });

    test('searches by typing', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 20, sorted: true });

        await row(page, 0).click();
        await page.keyboard.type('ch');
        const found = await page.evaluate(
            () => globalThis.model.getRow(globalThis.table.cursor).name
        );
        expect(found.startsWith('charlie')).toBe(true);

        // Typing the same letter again moves to the next match.
        await page.waitForTimeout(1100);
        await page.keyboard.type('e');
        const first = await page.evaluate(() => globalThis.table.cursor);
        await page.keyboard.type('e');
        const second = await page.evaluate(() => globalThis.table.cursor);

        expect(second).toBe(first + 1);
        expect(
            await page.evaluate(
                (index) => globalThis.model.getRow(index).name.startsWith('echo'),
                second
            )
        ).toBe(true);
    });

    test('searches without the slow locale-aware lower-casing when it is not needed', async ({
        page,
    }) => {
        await openHarness(page);
        await createTable(page, { count: 1000 });

        await row(page, 0).click();

        const calls = await page.evaluate(() => {
            const original = String.prototype.toLocaleLowerCase;
            let count = 0;

            // Lower-casing every row with the locale made a search of 100,000 rows take 170 ms.
            String.prototype.toLocaleLowerCase = function (...args) {
                ++count;

                return original.apply(this, args);
            };

            try {
                globalThis.table._typeAhead('q');
            } finally {
                String.prototype.toLocaleLowerCase = original;
            }

            return count;
        });

        expect(calls).toBe(0);
    });

    test('activates rows by double click', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 10 });

        await page.evaluate(() => {
            globalThis.activated = [];
            globalThis.table.connect('row-activate', (_table, index) =>
                globalThis.activated.push(index)
            );
        });

        await row(page, 4).dblclick();
        expect(await page.evaluate(() => globalThis.activated)).toEqual([4]);
    });

    test('resizes columns by dragging and sizes them to fit by double clicking', async ({
        page,
    }) => {
        await openHarness(page);
        await createTable(page, { count: 10 });

        const value = header(page, 'Value');
        const box = await value.boundingBox();

        await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width + 40, box.y + box.height / 2, { steps: 4 });
        await page.mouse.up();

        const resized = await value.boundingBox();
        expect(Math.round(resized.width)).toBe(Math.round(box.width + 41));

        const cellWidth = await page
            .locator('.wy-table-row[aria-rowindex="2"] .wy-table-cell:nth-child(3)')
            .evaluate((x) => x.getBoundingClientRect().width);
        expect(Math.round(cellWidth)).toBe(Math.round(resized.width));

        // The sort did not change by resizing.
        expect(await page.evaluate(() => globalThis.model.sortColumn)).toBe(null);

        await page.mouse.dblclick(resized.x + resized.width - 1, resized.y + resized.height / 2);
        const fitted = await value.boundingBox();
        expect(fitted.width).toBeLessThan(resized.width);
        expect(await page.evaluate(() => globalThis.table.getColumn(2).width)).toBe(
            Math.round(fitted.width)
        );

        // A resized column never gets smaller than its minimum width.
        await page.evaluate(() => (globalThis.table.getColumn(2).minWidth = 80));
        await page.mouse.move(fitted.x + fitted.width - 1, fitted.y + 5);
        await page.mouse.down();
        await page.mouse.move(fitted.x, fitted.y + 5, { steps: 3 });
        await page.mouse.up();
        expect(Math.round((await value.boundingBox()).width)).toBe(80);
    });

    test('scrolls horizontally when the columns are wider than the table', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 10 });

        const result = await page.evaluate(async () => {
            globalThis.table.getColumn(1).width = 900;
            globalThis.flushLayout();
            await new Promise((resolve) => requestAnimationFrame(resolve));

            const view = document.querySelector('.wy-table-view');
            view.scrollLeft = 200;
            await new Promise((resolve) => requestAnimationFrame(resolve));

            const headerCell = document.querySelector(
                '.wy-table-view .wy-table-column-header:nth-child(2)'
            );
            const cell = document.querySelector(
                '.wy-table-row[aria-rowindex="2"] .wy-table-cell:nth-child(2)'
            );

            return {
                scrollWidth: view.scrollWidth,
                clientWidth: view.clientWidth,
                headerLeft: headerCell.getBoundingClientRect().left,
                cellLeft: cell.getBoundingClientRect().left,
                adjustment: globalThis.table.hAdjustment.value,
                upper: globalThis.table.hAdjustment.upper,
            };
        });

        expect(result.scrollWidth).toBeGreaterThan(result.clientWidth);
        expect(result.headerLeft).toBe(result.cellLeft);
        expect(result.adjustment).toBe(200);
        expect(result.upper).toBeGreaterThan(900);
    });

    test('reflects inserted, removed and updated rows, and keeps the cursor on its row', async ({
        page,
    }) => {
        await openHarness(page);
        await createTable(page, { count: 10 });

        await row(page, 3).click();

        const result = await page.evaluate(async () => {
            const { flushLayout } = globalThis;
            const table = globalThis.table;
            const model = globalThis.model;
            const text = (index) =>
                document.querySelector(
                    `.wy-table-row[aria-rowindex="${index + 2}"] .wy-table-cell:nth-child(2)`
                )?.textContent;

            model.insertRow(0, { id: 100, name: 'new', value: 1, done: false });
            flushLayout();
            const inserted = {
                first: text(0),
                cursor: table.cursor,
                selected: table.selection.selectedIndices,
            };

            model.removeRow(1);
            model.updateRowById(5, { name: 'changed' });
            flushLayout();

            return {
                inserted,
                cursor: table.cursor,
                second: text(1),
                changed: text(model.getRowIndexById(5)),
                rowCount: table.el.getAttribute('aria-rowcount'),
            };
        });

        expect(result.inserted).toEqual({ first: 'new', cursor: 4, selected: [4] });
        expect(result.cursor).toBe(3);
        expect(result.second).toBe('alpha 1');
        expect(result.changed).toBe('changed');
        expect(result.rowCount).toBe('11');
    });

    test('keeps the cursor on the row that took the place of a removed cursor row', async ({
        page,
    }) => {
        await openHarness(page);
        await createTable(page, { count: 10 });

        const result = await page.evaluate(async () => {
            const { SortOrder } = await import('/src/core/enums.js');
            const table = globalThis.table;
            const model = globalThis.model;

            table.cursor = 5;
            model.removeRow(5);
            const removed = model.getRow(table.cursor).id;

            model.sortByColumn('name', SortOrder.DESCENDING);
            const sorted = table.cursor >= 0 ? model.getRow(table.cursor).id : null;

            // A new id of the cursor row is followed too.
            model.updateRow(table.cursor, { id: 60 });
            model.sortByColumn('name', SortOrder.ASCENDING);

            return {
                removed,
                sorted,
                renamed: table.cursor >= 0 ? model.getRow(table.cursor).id : null,
            };
        });

        expect(result).toEqual({ removed: 6, sorted: 6, renamed: 60 });
    });

    test('renders the rows in view at once after rows were removed while scrolled', async ({
        page,
    }) => {
        await openHarness(page);
        await createTable(page, { count: 1000 });

        const result = await page.evaluate(async () => {
            const { flushLayout } = globalThis;
            const table = globalThis.table;
            const view = document.querySelector('.wy-table-view');

            view.scrollTop = 900 * table.rowHeight;
            await new Promise((resolve) =>
                view.addEventListener('scroll', resolve, { once: true })
            );
            await new Promise((resolve) => setTimeout(resolve, 20));

            globalThis.model.rows = globalThis.model.rows.slice(0, 100);
            flushLayout();

            // Without waiting for the scroll event of the clamped scroll position.
            return [...document.querySelectorAll('.wy-table-body > .wy-table-row:not([hidden])')]
                .map((x) => Number(x.getAttribute('aria-rowindex')) - 2)
                .sort((first, second) => first - second)
                .at(-1);
        });

        expect(result).toBe(99);
    });

    test('keeps the selection while sorting and filtering', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 20 });

        await row(page, 1).click();
        await row(page, 2).click({ modifiers: ['Control'] });

        const result = await page.evaluate(async () => {
            const { FilteredListModel } = await import('/src/data/filtered-list-model.js');
            const { SearchFilter } = await import('/src/data/filters/search-filter.js');
            const table = globalThis.table;
            const filter = new SearchFilter({ columns: ['name'] });
            const filtered = new FilteredListModel(globalThis.model, filter);

            table.model = filtered;
            table.selection.selectedRowIds = [1, 2];

            globalThis.model.sortByColumn('value');
            const sorted = table.selection.selectedRowIds;

            filter.query = 'alpha';
            globalThis.flushLayout();

            return {
                sorted,
                rows: filtered.rowsCount,
                selected: table.selection.selectedRowIds,
                texts: [
                    ...document.querySelectorAll(
                        '.wy-table-body > .wy-table-row:not([hidden]) .wy-table-cell:nth-child(2)'
                    ),
                ]
                    .map((x) => x.textContent)
                    .sort(),
            };
        });

        expect(result.sorted).toEqual([1, 2]);
        expect(result.rows).toBe(4);
        expect(result.selected).toEqual([1]);
        expect(result.texts).toEqual(['alpha 1', 'alpha 11', 'alpha 16', 'alpha 6']);
    });

    test('toggles check boxes by click and Space, writing to the model', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 10 });

        await page.evaluate(() => {
            globalThis.toggles = [];
            globalThis.table
                .getColumn(3)
                .connect('toggle', (_column, index, row, active) =>
                    globalThis.toggles.push([index, row.id, active])
                );
        });

        const check = row(page, 1).locator('[role="checkbox"]');
        await expect(check).toHaveAttribute('aria-checked', 'false');
        await check.click();
        await expect(check).toHaveAttribute('aria-checked', 'true');

        await page.keyboard.press('Space');
        await expect(check).toHaveAttribute('aria-checked', 'false');

        const result = await page.evaluate(() => ({
            value: globalThis.model.getRowById(1).done,
            toggles: globalThis.toggles,
            selected: globalThis.table.selection.selectedRowIds,
        }));

        expect(result.value).toBe(false);
        expect(result.toggles).toEqual([
            [1, 1, true],
            [1, 1, false],
        ]);
        expect(result.selected).toEqual([1]);

        // Not editable: clicks only select.
        await page.evaluate(() => (globalThis.table.getColumn(3).editable = false));
        await row(page, 2).locator('[role="checkbox"]').click();
        await expect(row(page, 2).locator('[role="checkbox"]')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        await expect(row(page, 2).locator('[role="checkbox"]')).toHaveAttribute(
            'aria-readonly',
            'true'
        );
    });

    test('shows a placeholder and can hide the headers', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 0 });

        await page.evaluate(() => (globalThis.table.placeholder = 'No signals'));
        const placeholder = page.locator('.wy-table-placeholder');
        await expect(placeholder).toBeVisible();
        await expect(placeholder).toHaveText('No signals');

        await page.evaluate(() => globalThis.model.appendRow({ id: 1, name: 'x', value: 1 }));
        await expect(placeholder).toBeHidden();

        await page.evaluate(() => (globalThis.table.showHeaders = false));
        await expect(page.locator('.wy-table-view > .wy-table-header')).toBeHidden();

        const top = await page.evaluate(() => {
            globalThis.flushLayout();
            const view = document.querySelector('.wy-table-view').getBoundingClientRect();

            return (
                document.querySelector('.wy-table-row[aria-rowindex="2"]').getBoundingClientRect()
                    .top - view.top
            );
        });
        expect(top).toBe(0);
        expect(await page.evaluate(() => globalThis.table.headerVisible)).toBe(false);
    });

    test('manages columns', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 5 });

        const result = await page.evaluate(async () => {
            const { TextColumn } = await import('/src/columns/text-column.js');
            const table = globalThis.table;
            const headers = () =>
                [...document.querySelectorAll('.wy-table-view [role="columnheader"]')].map((x) =>
                    x.textContent.trim()
                );
            const log = [];
            table.connect('column-add', (_table, column) => log.push(['add', column.label]));
            table.connect('column-remove', (_table, column) => log.push(['remove', column.label]));

            const extra = table.insertColumn(new TextColumn({ name: 'id', label: 'Id' }), 1);
            globalThis.flushLayout();
            const inserted = headers();

            table.getColumn(2).visible = false;
            globalThis.flushLayout();
            const hidden = headers();
            const cells = document.querySelector('.wy-table-row').children.length;

            table.reorderColumn(extra, 0);
            globalThis.flushLayout();
            const reordered = headers();

            extra.destroy();
            globalThis.flushLayout();

            let error = null;
            try {
                table.addColumn(table.getColumn(0));
            } catch (e) {
                error = e.message;
            }

            return {
                inserted,
                hidden,
                cells,
                reordered,
                afterDestroy: headers(),
                count: table.columnsCount,
                index: table.indexOfColumn(table.getColumnByName('value')),
                byIndex: table.removeColumnByIndex(0).label,
                log,
                error,
            };
        });

        expect(result.inserted).toEqual(['#', 'Id', 'Name', 'Value', 'Done']);
        expect(result.hidden).toEqual(['#', 'Id', 'Value', 'Done']);
        expect(result.cells).toBe(4);
        expect(result.reordered).toEqual(['Id', '#', 'Value', 'Done']);
        expect(result.afterDestroy).toEqual(['#', 'Value', 'Done']);
        expect(result.count).toBe(4);
        expect(result.index).toBe(2);
        expect(result.byIndex).toBe('#');
        expect(result.log).toEqual([
            ['add', 'Id'],
            ['remove', 'Id'],
            ['remove', '#'],
        ]);
        expect(result.error).toMatch(/already been added/);
    });

    test('lets go of a destroyed model and cleans up when destroyed', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 5 });

        const result = await page.evaluate(() => {
            const table = globalThis.table;
            const model = globalThis.model;
            const column = table.getColumn(1);

            model.destroy();
            globalThis.flushLayout();
            const afterModel = {
                model: table.model,
                rows: document.querySelectorAll('.wy-table-body > .wy-table-row:not([hidden])')
                    .length,
            };

            table.destroy();

            return {
                afterModel,
                columnDestroyed: column.destroyed,
                element: document.querySelector('.wy-table'),
            };
        });

        expect(result.afterModel).toEqual({ model: null, rows: 0 });
        expect(result.columnDestroyed).toBe(true);
        expect(result.element).toBe(null);
    });

    test('measures the row height again when the theme changes', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 50 });

        const result = await page.evaluate(async () => {
            document.documentElement.style.setProperty('--wy-row-height', '30px');
            await new Promise((resolve) => setTimeout(resolve, 50));
            globalThis.flushLayout();

            const body = document.querySelector('.wy-table-body');
            const second = document
                .querySelector('.wy-table-row[aria-rowindex="3"]')
                .getBoundingClientRect().top;
            const first = document
                .querySelector('.wy-table-row[aria-rowindex="2"]')
                .getBoundingClientRect().top;

            document.documentElement.style.removeProperty('--wy-row-height');

            return {
                rowHeight: globalThis.table.rowHeight,
                height: body.offsetHeight,
                step: second - first,
            };
        });

        expect(result).toEqual({ rowHeight: 30, height: 1500, step: 30 });
    });

    test('scrolls rows into view and finds rows at a position', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { count: 1000 });

        const result = await page.evaluate(() => {
            const table = globalThis.table;
            table.scrollToRow(500, 'start');

            const row = document
                .querySelector('.wy-table-row[aria-rowindex="502"]')
                .getBoundingClientRect();
            const found = table.getRowAtPosition(
                row.left + 5 + window.scrollX,
                row.top + 5 + window.scrollY
            );
            const header = table.getRowAtPosition(10, 5);

            return {
                found,
                header,
                scrollTop: table.vAdjustment.value,
                upper: table.vAdjustment.upper,
            };
        });

        expect(result.found).toBe(500);
        expect(result.header).toBe(-1);
        expect(result.scrollTop).toBe(500 * 24);
        expect(result.upper).toBe(1000 * 24);
    });

    test('builds its columns with the builder properties', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Table } = await import('/src/widgets/table.js');
            const { getType } = await import('/src/core/registry.js');
            await import('/src/columns/text-column.js');

            // A minimal builder that builds typed objects.
            const builder = {
                build: (specs) =>
                    specs.map(({ type, ...properties }) => new (getType(type).cls)(properties)),
            };

            const table = new Table();
            Table.builderProperties.columns(builder, table, [
                { type: 'text-column', name: 'a', label: 'A' },
            ]);

            let error = null;
            try {
                Table.builderProperties.columns(builder, table, 'text-column');
            } catch (e) {
                error = e.message;
            }

            return {
                labels: table.columns.map((x) => x.label),
                error,
                type: getType('table').cls === Table,
            };
        });

        expect(result).toEqual({
            labels: ['A'],
            error: 'Table columns must be an array.',
            type: true,
        });
    });
});
