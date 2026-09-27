// Browser tests of ListBox and ListBoxRow.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a main window with a list box (`globalThis.list`) of labeled rows in a scroll area, and
// records its signals.
async function mount(page, { properties = {}, rows = 5, height = 300 } = {}) {
    const errors = await openHarness(page);

    await page.evaluate(
        async ({ properties, rows, height }) => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Box } = await import('/src/widgets/box.js');
            const { Label } = await import('/src/widgets/label.js');
            const { LineEdit } = await import('/src/widgets/line-edit.js');
            const { ScrollArea } = await import('/src/widgets/scroll-area.js');
            const { ListBox } = await import('/src/widgets/list-box.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const window = new MainWindow();
            const box = new Box({ orientation: 'vertical', spacing: 6, margin: 10 });
            const list = new ListBox(properties);
            const scroll = new ScrollArea({ shadowType: 'in', vExpand: false, height });

            for (let i = 0; i < rows; ++i) {
                list.addChild(new Label({ text: `Item ${i}`, margin: 4 }));
            }

            scroll.addChild(list);
            box.addChild(new LineEdit({ name: 'before' }));
            box.addChild(scroll);
            box.addChild(new LineEdit({ name: 'after' }));
            window.addChild(box);
            window.show();
            flushLayout();

            globalThis.list = list;
            globalThis.log = [];
            list.connect('row-activate', (_list, row) =>
                globalThis.log.push(`activate:${row.index}`)
            );
            list.connect('selected-rows-change', () =>
                globalThis.log.push(`selection:${list.selectedRows.map((x) => x.index).join(',')}`)
            );
            list.connect('row-select', (_list, row) =>
                globalThis.log.push(`select:${row ? row.index : 'none'}`)
            );
        },
        { properties, rows, height }
    );

    return errors;
}

// Returns the center of the body of a row.
function rowCenter(page, index) {
    return page.evaluate((index) => {
        const rect = globalThis.list.getRowAtIndex(index).focusElement.getBoundingClientRect();

        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, index);
}

async function clickRow(page, index, modifiers = []) {
    const point = await rowCenter(page, index);
    for (const modifier of modifiers) {
        await page.keyboard.down(modifier);
    }

    await page.mouse.click(point.x, point.y);

    for (const modifier of modifiers) {
        await page.keyboard.up(modifier);
    }
}

const selected = (page) => page.evaluate(() => globalThis.list.selectedRows.map((x) => x.index));

const cursor = (page) =>
    page.evaluate(() => {
        const row = globalThis.list.cursorRow;

        return row ? row.index : -1;
    });

const takeLog = (page) =>
    page.evaluate(() => {
        const log = globalThis.log;
        globalThis.log = [];

        return log;
    });

test.describe('ListBox', () => {
    test('wraps widgets in rows, with the listbox and option roles', async ({ page }) => {
        const errors = await mount(page, { rows: 3 });

        const result = await page.evaluate(async () => {
            const { ListBoxRow } = await import('/src/widgets/list-box.js');
            const { Label } = await import('/src/widgets/label.js');
            const list = globalThis.list;

            const row = new ListBoxRow();
            row.addChild(new Label({ text: 'Inserted' }));
            const inserted = list.insertChild(row, 1);

            const label = new Label({ text: 'Last' });
            const wrapped = list.addChild(label);

            const options = [...list.el.querySelectorAll('[role="option"]')];

            return {
                role: list.el.getAttribute('role'),
                count: list.childrenCount,
                same: inserted === row,
                wrapped: wrapped.constructor.name,
                parent: label.parent === wrapped,
                texts: options.map((x) => x.textContent.trim()),
                indexes: list.children.map((x) => x.index),
                selectedAttribute: options[0].getAttribute('aria-selected'),
                removed: list.removeChild(label),
                countAfter: list.childrenCount,
            };
        });

        expect(result).toEqual({
            role: 'listbox',
            count: 5,
            same: true,
            wrapped: 'ListBoxRow',
            parent: true,
            texts: ['Item 0', 'Inserted', 'Item 1', 'Item 2', 'Last'],
            indexes: [0, 1, 2, 3, 4],
            selectedAttribute: 'false',
            removed: 4,
            countAfter: 4,
        });
        expect(errors).toEqual([]);
    });

    test('single: a click selects and activates, Control+click deselects', async ({ page }) => {
        await mount(page);

        await clickRow(page, 1);
        expect(await selected(page)).toEqual([1]);
        expect(await takeLog(page)).toEqual(['selection:1', 'select:1', 'activate:1']);

        await clickRow(page, 3);
        expect(await selected(page)).toEqual([3]);
        expect(await takeLog(page)).toEqual(['selection:3', 'select:3', 'activate:3']);

        await clickRow(page, 3, ['Control']);
        expect(await selected(page)).toEqual([]);
        expect(await takeLog(page)).toEqual(['selection:', 'select:none']);

        const attributes = await page.evaluate(() =>
            globalThis.list.children.map((x) => x.focusElement.getAttribute('aria-selected'))
        );
        expect(attributes).toEqual(['false', 'false', 'false', 'false', 'false']);
        expect(await page.evaluate(() => globalThis.list.cursorRow.hasFocus)).toBe(true);
    });

    test('browse keeps a selected row, and none selects nothing', async ({ page }) => {
        await mount(page, { properties: { selectionMode: 'browse' } });

        await clickRow(page, 2);
        await clickRow(page, 2, ['Control']);
        expect(await selected(page)).toEqual([2]);

        await page.evaluate(() => globalThis.list.unselectAll());
        expect(await selected(page)).toEqual([2]);

        await page.evaluate(() => (globalThis.list.selectionMode = 'none'));
        expect(await selected(page)).toEqual([]);

        await clickRow(page, 1);
        expect(await selected(page)).toEqual([]);

        const result = await page.evaluate(() => ({
            attribute: globalThis.list.getRowAtIndex(1).focusElement.hasAttribute('aria-selected'),
            cursor: globalThis.list.cursorRow.index,
        }));
        expect(result).toEqual({ attribute: false, cursor: 1 });

        // Rows are still activated.
        expect((await takeLog(page)).at(-1)).toBe('activate:1');

        // Masks of SelectionModes are converted.
        const modes = await page.evaluate(async () => {
            const { SelectionModes } = await import('/src/core/enums.js');
            const list = globalThis.list;
            const result = [];

            for (const mode of [
                SelectionModes.MULTI,
                SelectionModes.SINGLE_TOGGLE,
                SelectionModes.SINGLE,
                SelectionModes.NONE,
            ]) {
                list.selectionMode = mode;
                result.push(list.selectionMode);
            }

            return result;
        });
        expect(modes).toEqual(['multiple', 'single', 'browse', 'none']);
    });

    test('multiple: Control toggles, Shift selects a range', async ({ page }) => {
        await mount(page, { properties: { selectionMode: 'multiple' }, rows: 8 });

        await clickRow(page, 1);
        await clickRow(page, 3, ['Control']);
        await clickRow(page, 5, ['Control']);
        expect(await selected(page)).toEqual([1, 3, 5]);

        await clickRow(page, 3, ['Control']);
        expect(await selected(page)).toEqual([1, 5]);

        // Shift selects from the anchor, the row last clicked without Shift.
        await clickRow(page, 1);
        await clickRow(page, 4, ['Shift']);
        expect(await selected(page)).toEqual([1, 2, 3, 4]);

        await clickRow(page, 2, ['Shift']);
        expect(await selected(page)).toEqual([1, 2]);

        await takeLog(page);
        await page.evaluate(() => globalThis.list.selectAll());
        expect(await selected(page)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

        // One signal per operation; row-select is only for single and browse.
        expect(await takeLog(page)).toEqual(['selection:0,1,2,3,4,5,6,7']);

        const aria = await page.evaluate(() =>
            globalThis.list.el.getAttribute('aria-multiselectable')
        );
        expect(aria).toBe('true');

        await page.evaluate(() => globalThis.list.unselectAll());
        expect(await selected(page)).toEqual([]);

        // Switching to single keeps the first selected row.
        await page.evaluate(() => {
            const list = globalThis.list;
            list.selectRow(list.getRowAtIndex(6));
            list.selectRow(list.getRowAtIndex(2));
            list.selectionMode = 'single';
        });
        expect(await selected(page)).toEqual([2]);
    });

    test('without single click activation, a double click activates', async ({ page }) => {
        await mount(page, { properties: { activateOnSingleClick: false } });

        await clickRow(page, 2);
        expect(await takeLog(page)).toEqual(['selection:2', 'select:2']);

        const point = await rowCenter(page, 2);
        await page.mouse.dblclick(point.x, point.y);
        expect(await takeLog(page)).toEqual(['activate:2']);

        // Rows that are not activatable are not activated.
        await page.evaluate(() => (globalThis.list.getRowAtIndex(2).activatable = false));
        await page.mouse.dblclick(point.x, point.y);
        await page.keyboard.press('Enter');
        expect(await takeLog(page)).toEqual([]);
    });

    test('the keyboard moves the cursor, selects and activates', async ({ page }) => {
        await mount(page, { properties: { selectionMode: 'multiple' }, rows: 40, height: 150 });

        // Tab enters the list at its first row, which is its only tab stop.
        await page.click('[data-name="before"] input');
        await page.keyboard.press('Tab');
        expect(await cursor(page)).toBe(0);

        const tabStops = await page.evaluate(
            () => globalThis.list.children.filter((x) => x.focusElement.tabIndex === 0).length
        );
        expect(tabStops).toBe(1);

        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        expect([await cursor(page), await selected(page)]).toEqual([2, [2]]);

        await page.keyboard.press('Shift+ArrowDown');
        await page.keyboard.press('Shift+ArrowDown');
        expect([await cursor(page), await selected(page)]).toEqual([4, [2, 3, 4]]);

        // Control moves only the cursor, and Control+Space toggles the cursor row.
        await page.keyboard.press('Control+ArrowDown');
        await page.keyboard.press('Control+ArrowDown');
        await page.keyboard.press('Control+Space');
        expect([await cursor(page), await selected(page)]).toEqual([6, [2, 3, 4, 6]]);

        await page.keyboard.press('End');
        expect([await cursor(page), await selected(page)]).toEqual([39, [39]]);

        await page.keyboard.press('Home');
        expect([await cursor(page), await selected(page)]).toEqual([0, [0]]);

        // Page Down moves by about the height of the scroll area.
        await page.keyboard.press('PageDown');
        const paged = await cursor(page);
        expect(paged).toBeGreaterThan(2);
        expect(paged).toBeLessThan(10);

        const visible = await page.evaluate(() => {
            const row = globalThis.list.cursorRow.focusElement.getBoundingClientRect();
            const view = globalThis.list.parent.el.getBoundingClientRect();

            return row.top >= view.top - 1 && row.bottom <= view.bottom + 1;
        });
        expect(visible).toBe(true);

        await page.keyboard.press('PageUp');
        expect(await cursor(page)).toBe(0);

        await page.keyboard.press('Control+a');
        expect((await selected(page)).length).toBe(40);

        await page.keyboard.press('Control+Shift+A');
        expect(await selected(page)).toEqual([]);

        await takeLog(page);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.keyboard.press(' ');
        expect(await takeLog(page)).toEqual(['selection:1', 'activate:1', 'activate:1']);

        // Tab leaves the list.
        await page.keyboard.press('Tab');
        expect(
            await page.evaluate(() => document.activeElement.closest('[data-name]')?.dataset.name)
        ).toBe('after');

        // Coming back, the cursor row has the focus again.
        await page.keyboard.press('Shift+Tab');
        expect(await page.evaluate(() => globalThis.list.cursorRow.hasFocus)).toBe(true);
    });

    test('the cursor row shows a focus ring and the selection uses the table colors', async ({
        page,
    }) => {
        await mount(page);

        await page.click('[data-name="before"] input');
        await page.keyboard.press('Tab');
        await page.keyboard.press('ArrowDown');

        const focused = await page.evaluate(() => {
            const row = globalThis.list.cursorRow;
            const style = getComputedStyle(row.focusElement);
            const probe = document.createElement('div');
            probe.style.background = 'var(--wy-table-selected)';
            document.body.append(probe);
            const expected = getComputedStyle(probe).backgroundColor;
            probe.remove();

            return {
                outline: style.outlineStyle,
                background: style.backgroundColor,
                expected,
                cursorClass: row.el.classList.contains('wy-cursor'),
            };
        });

        expect(focused.outline).toBe('dotted');
        expect(focused.background).toBe(focused.expected);
        expect(focused.cursorClass).toBe(true);

        // Without the focus, the selection is paler.
        await page.click('[data-name="after"] input');
        const unfocused = await page.evaluate(() => {
            const style = getComputedStyle(globalThis.list.getRowAtIndex(1).focusElement);

            return { outline: style.outlineStyle, background: style.backgroundColor };
        });

        expect(unfocused.outline).toBe('none');
        expect(unfocused.background).not.toBe(focused.expected);
        expect(unfocused.background).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('presses on widgets in a row are left to them', async ({ page }) => {
        await mount(page, { rows: 0 });

        const point = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const { Label } = await import('/src/widgets/label.js');
            const { Switch } = await import('/src/widgets/switch.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            for (const name of ['Wi-Fi', 'Bluetooth']) {
                const box = new Box({ spacing: 6, margin: 4 });
                box.addChild(new Label({ text: name, hExpand: true }));
                box.addChild(new Switch());
                globalThis.list.addChild(box);
            }

            flushLayout();

            const rect = globalThis.list.el
                .querySelectorAll('.wy-switch')[1]
                .getBoundingClientRect();

            return { x: rect.left + 5, y: rect.top + rect.height / 2 };
        });

        await page.mouse.click(point.x, point.y);

        const result = await page.evaluate(() => ({
            selected: globalThis.list.selectedRows.length,
            active: globalThis.list.el
                .querySelectorAll('.wy-switch')[1]
                .classList.contains('wy-active'),
            log: globalThis.log,
        }));
        expect(result).toEqual({ selected: 0, active: true, log: [] });

        // Tab goes from the row to the switch in it.
        await clickRow(page, 0);
        await page.keyboard.press('Tab');
        expect(
            await page.evaluate(() => document.activeElement.classList.contains('wy-switch'))
        ).toBe(true);
    });

    test('filters rows and shows the placeholder when none is left', async ({ page }) => {
        const errors = await mount(page, { properties: { selectionMode: 'multiple' }, rows: 6 });

        const result = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const list = globalThis.list;

            list.placeholder = new Label({ text: 'Nothing found' });
            list.selectAll();
            globalThis.log = [];

            const shown = () =>
                list.children
                    .filter((x) => getComputedStyle(x.el).display !== 'none')
                    .map((x) => x.index);

            let even = true;
            list.filterFunction = (row) => (row.index % 2 === 0) === even;

            const evenRows = shown();
            const selectedEven = list.selectedRows.map((x) => x.index);
            const log = [...globalThis.log];

            even = false;
            list.invalidateFilter();
            const oddRows = shown();

            list.setFilterFunction(() => false);
            const none = shown();
            const placeholder = !list.el.querySelector('.wy-list-box-placeholder').hidden;
            const placeholderText = list.el.querySelector('.wy-list-box-placeholder').textContent;

            list.filterFunction = null;
            const all = shown();
            const placeholderAfter = !list.el.querySelector('.wy-list-box-placeholder').hidden;

            return {
                evenRows,
                selectedEven,
                log,
                oddRows,
                none,
                placeholder,
                placeholderText,
                all,
                placeholderAfter,
            };
        });

        expect(result).toEqual({
            evenRows: [0, 2, 4],
            selectedEven: [0, 2, 4],
            log: ['selection:0,2,4'],
            oddRows: [1, 3, 5],
            none: [],
            placeholder: true,
            placeholderText: 'Nothing found',
            all: [0, 1, 2, 3, 4, 5],
            placeholderAfter: false,
        });

        // The keyboard skips filtered rows.
        await page.evaluate(() => (globalThis.list.filterFunction = (row) => row.index !== 1));
        await clickRow(page, 0);
        await page.keyboard.press('ArrowDown');
        expect(await cursor(page)).toBe(2);
        expect(errors).toEqual([]);
    });

    test('sorts rows and keeps them sorted', async ({ page }) => {
        await mount(page, { rows: 0 });

        const result = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const list = globalThis.list;
            const texts = () => list.children.map((x) => x.child.text);

            for (const name of ['pear', 'apple', 'fig']) {
                list.addChild(new Label({ text: name }));
            }

            const unsorted = texts();

            list.sortFunction = (a, b) => a.child.text.localeCompare(b.child.text);
            const sorted = texts();

            list.addChild(new Label({ text: 'banana' }));
            list.insertChild(new Label({ text: 'zucchini' }), 0);
            const inserted = texts();

            // A row whose sort key changed moves when it is marked changed.
            const fig = list.children.find((x) => x.child.text === 'fig');
            fig.child.text = 'aardvark';
            fig.changed();
            const changed = texts();

            list.setSortFunction((a, b) => b.child.text.localeCompare(a.child.text));
            const reversed = texts();

            return { unsorted, sorted, inserted, changed, reversed };
        });

        expect(result).toEqual({
            unsorted: ['pear', 'apple', 'fig'],
            sorted: ['apple', 'fig', 'pear'],
            inserted: ['apple', 'banana', 'fig', 'pear', 'zucchini'],
            changed: ['aardvark', 'apple', 'banana', 'pear', 'zucchini'],
            reversed: ['zucchini', 'pear', 'banana', 'apple', 'aardvark'],
        });
    });

    test('the header function adds section headers', async ({ page }) => {
        const errors = await mount(page, { rows: 0 });

        const result = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const { flushLayout } = await import('/src/widgets/widget.js');
            const list = globalThis.list;

            const items = [
                ['Fruit', 'Apple'],
                ['Fruit', 'Pear'],
                ['Vegetables', 'Leek'],
                ['Vegetables', 'Kale'],
                ['Nuts', 'Pecan'],
            ];

            for (const [section, name] of items) {
                const row = list.addChild(new Label({ text: name }));
                row.section = section;
            }

            let calls = 0;
            list.setHeaderFunction((row, before) => {
                calls += 1;

                if (before && before.section === row.section) {
                    row.header = null;
                } else if (!row.header) {
                    row.header = new Label({ text: row.section });
                }
            });

            const headers = () =>
                list.children.map((x) => (x.header && !x._filtered ? x.header.text : null));

            const initial = headers();
            const initialCalls = calls;
            const inBody = list.children[0].focusElement.contains(list.children[0].header.el);

            // Filtering updates the headers at the end of the task.
            list.filterFunction = (row) => row.child.text !== 'Apple';
            flushLayout();
            const filtered = headers();

            list.headerFunction = null;
            const removed = headers();

            return { initial, initialCalls, inBody, filtered, removed };
        });

        expect(result).toEqual({
            initial: ['Fruit', null, 'Vegetables', null, 'Nuts'],
            initialCalls: 5,
            inBody: false,
            filtered: [null, 'Fruit', 'Vegetables', null, 'Nuts'],
            removed: [null, null, null, null, null],
        });
        expect(errors).toEqual([]);
    });

    test('bindModel makes rows from a model and follows its changes', async ({ page }) => {
        const errors = await mount(page, { rows: 2 });

        const result = await page.evaluate(async () => {
            const { ListModel } = await import('/src/data/list-model.js');
            const { FilteredListModel } = await import('/src/data/filtered-list-model.js');
            const { SearchFilter } = await import('/src/data/filters/search-filter.js');
            const { Label } = await import('/src/widgets/label.js');
            const list = globalThis.list;

            const model = new ListModel({
                rows: [
                    { id: 1, name: 'Stocks' },
                    { id: 2, name: 'Bonds' },
                    { id: 3, name: 'Indices' },
                ],
                idColumn: 'id',
            });

            let created = 0;
            list.bindModel(model, (row) => {
                created += 1;

                return new Label({ text: row.name });
            });

            const texts = () => list.children.map((x) => x.child.text);
            const steps = { bound: texts(), created };

            list.selectRow(list.getRowAtIndex(1));

            model.appendRow({ id: 4, name: 'Futures' });
            model.insertRow(0, { id: 5, name: 'Cash' });
            steps.inserted = texts();
            steps.selectedAfterInsert = list.getSelectedRow().child.text;

            model.removeRow(1);
            steps.removed = texts();

            model.updateRow(1, { name: 'Government bonds' });
            steps.updated = texts();
            steps.selectedAfterUpdate = list.getSelectedRow()?.child.text;

            model.sortByColumn('name');
            steps.sorted = texts();
            steps.selectedAfterSort = list.getSelectedRow()?.child.text;

            try {
                list.addChild(new Label({ text: 'Manual' }));
            } catch (error) {
                steps.manual = error.message;
            }

            // A filtered model shows only its rows.
            const filtered = new FilteredListModel(model, new SearchFilter({ columns: ['name'] }));
            list.bindModel(filtered, (row) => new Label({ text: row.name }));
            filtered.filters[0].query = 'gov';
            steps.filtered = texts();

            list.bindModel(null);
            steps.unbound = list.childrenCount;
            steps.model = list.model;

            list.addChild(new Label({ text: 'Manual' }));
            steps.manualAfter = texts();

            return steps;
        });

        expect(result).toEqual({
            bound: ['Stocks', 'Bonds', 'Indices'],
            created: 3,
            inserted: ['Cash', 'Stocks', 'Bonds', 'Indices', 'Futures'],
            selectedAfterInsert: 'Bonds',
            removed: ['Cash', 'Bonds', 'Indices', 'Futures'],
            updated: ['Cash', 'Government bonds', 'Indices', 'Futures'],
            selectedAfterUpdate: 'Government bonds',
            sorted: ['Cash', 'Futures', 'Government bonds', 'Indices'],
            selectedAfterSort: 'Government bonds',
            manual: 'A list box bound to a model gets its rows from the model.',
            filtered: ['Government bonds'],
            unbound: 0,
            model: null,
            manualAfter: ['Manual'],
        });
        expect(errors).toEqual([]);
    });

    test('removing the focused row of a bound model moves the focus', async ({ page }) => {
        await mount(page, { rows: 0 });

        await page.evaluate(async () => {
            const { ListModel } = await import('/src/data/list-model.js');
            const { Label } = await import('/src/widgets/label.js');

            globalThis.model = new ListModel({
                rows: ['a', 'b', 'c'].map((name) => ({ name })),
            });
            globalThis.list.bindModel(globalThis.model, (row) => new Label({ text: row.name }));
        });

        await clickRow(page, 1);
        await page.evaluate(() => globalThis.model.removeRow(1));

        const result = await page.evaluate(() => ({
            cursor: globalThis.list.cursorRow?.child.text,
            focus: globalThis.list.cursorRow?.hasFocus,
            selected: globalThis.list.selectedRows.length,
        }));
        expect(result).toEqual({ cursor: 'c', focus: true, selected: 0 });
    });

    test('the builder creates list boxes with rows', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            await import('/src/widgets/list-box.js');
            await import('/src/widgets/label.js');
            const { Builder } = await import('/src/construction/builder.js');

            const [list] = new Builder().build({
                type: 'list-box',
                selectionMode: 'multiple',
                activateOnSingleClick: false,
                children: [
                    { type: 'label', text: 'Plain' },
                    {
                        type: 'list-box-row',
                        activatable: false,
                        child: { type: 'label', text: 'In a row' },
                    },
                ],
            });

            return {
                type: list.constructor.name,
                mode: list.selectionMode,
                single: list.activateOnSingleClick,
                rows: list.children.map((x) => [x.constructor.name, x.child.text, x.activatable]),
            };
        });

        expect(result).toEqual({
            type: 'ListBox',
            mode: 'multiple',
            single: false,
            rows: [
                ['ListBoxRow', 'Plain', true],
                ['ListBoxRow', 'In a row', false],
            ],
        });
        expect(errors).toEqual([]);
    });

    test('the README example works', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            const w = await import('/src/index.js');

            const window = new w.MainWindow();
            window.show();

            const model = new w.ListModel({ rows: [{ name: 'Wi-Fi' }, { name: 'Bluetooth' }] });
            const list = new w.ListBox({ selectionMode: w.SelectionMode.BROWSE });

            list.bindModel(model, (row) => {
                const box = new w.Box({ spacing: 6, margin: 6 });
                box.addChild(new w.Label({ text: row.name, hExpand: true }));
                box.addChild(new w.Switch({ active: true }));

                return box;
            });
            list.connect('row-activate', (_list, row) => (globalThis.opened = row.index));

            window.addChild(list);
            w.flushLayout();

            list.getRowAtIndex(1).activate();

            return {
                rows: list.childrenCount,
                switches: list.el.querySelectorAll('.wy-switch').length,
                opened: globalThis.opened,
            };
        });

        expect(result).toEqual({ rows: 2, switches: 2, opened: 1 });
        expect(errors).toEqual([]);
    });
});
