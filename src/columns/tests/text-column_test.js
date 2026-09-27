// Browser tests of text columns and the shared column behavior: formatters, renderers, class
// names, alignment and ellipsizing.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Creates a table with one text column (and more given), as globalThis.table.
async function createTable(page, columnProperties = {}) {
    await page.evaluate(async (columnProperties) => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Table } = await import('/src/widgets/table.js');
        const { ListModel } = await import('/src/data/list-model.js');
        const { TextColumn } = await import('/src/columns/text-column.js');
        const { flushLayout } = await import('/src/widgets/widget.js');

        const host = document.createElement('div');
        host.style.cssText = 'position: fixed; left: 0; top: 0; width: 400px; height: 200px;';
        document.body.append(host);

        const model = new ListModel({
            rows: [
                { name: 'Stocks', amount: -5 },
                { name: null, amount: 3 },
                {
                    name: 'A very long name that certainly does not fit in the column at all',
                    amount: 1,
                },
            ],
        });

        const window = new MainWindow({ host });
        const table = new Table({ model });
        const column = new TextColumn({ name: 'name', label: 'Name', ...columnProperties });
        table.addColumn(column);
        window.addChild(table);
        window.show();
        flushLayout();

        globalThis.table = table;
        globalThis.column = column;
        globalThis.flushLayout = flushLayout;
    }, columnProperties);

    await page.waitForFunction(() => globalThis.table.rowHeight > 0);
}

function cellTexts(page) {
    return page.evaluate(() => {
        globalThis.flushLayout();

        return [...document.querySelectorAll('.wy-table-body > .wy-table-row')]
            .sort((a, b) => a.getAttribute('aria-rowindex') - b.getAttribute('aria-rowindex'))
            .map((x) => x.firstElementChild.textContent);
    });
}

test.describe('TextColumn', () => {
    test('shows values as text, and nothing for missing values', async ({ page }) => {
        await openHarness(page);
        await createTable(page);

        expect((await cellTexts(page)).slice(0, 2)).toEqual(['Stocks', '']);
        expect(await page.evaluate(() => globalThis.column.title)).toBe('Name');
    });

    test('uses a formatter and a renderer', async ({ page }) => {
        await openHarness(page);
        await createTable(page);

        await page.evaluate(() => {
            globalThis.column.formatter = (value, row) => `${value ?? '?'} (${row.amount})`;
        });
        expect((await cellTexts(page)).slice(0, 2)).toEqual(['Stocks (-5)', '? (3)']);

        await page.evaluate(() => {
            globalThis.column.renderer = (cell, value) => {
                cell.innerHTML = `<b>${value ?? '-'}</b>`;
            };
        });
        expect((await cellTexts(page)).slice(0, 2)).toEqual(['Stocks', '-']);
        await expect(page.locator('.wy-table-row b').first()).toBeVisible();

        await expect(page.evaluate(() => (globalThis.column.formatter = 'x'))).rejects.toThrow(
            /function/
        );
    });

    test('adds class names to cells', async ({ page }) => {
        await openHarness(page);
        await createTable(page);

        const classes = await page.evaluate(() => {
            globalThis.column.cellClassName = (row) => (row.amount < 0 ? 'negative' : '');
            globalThis.flushLayout();

            return [...document.querySelectorAll('.wy-table-body > .wy-table-row')]
                .sort((a, b) => a.getAttribute('aria-rowindex') - b.getAttribute('aria-rowindex'))
                .map((x) => x.firstElementChild.className);
        });

        expect(classes[0]).toBe('wy-table-cell wy-align-start wy-ellipsize-end negative');
        expect(classes[1]).toBe('wy-table-cell wy-align-start wy-ellipsize-end');
    });

    test('aligns and ellipsizes', async ({ page }) => {
        await openHarness(page);
        await createTable(page, { width: 120 });

        const result = await page.evaluate(() => {
            const cell = () =>
                document.querySelector('.wy-table-row[aria-rowindex="4"] .wy-table-cell');
            const end = {
                overflow: getComputedStyle(cell()).textOverflow,
                scroll: cell().scrollWidth > cell().clientWidth,
            };

            globalThis.column.alignment = 'end';
            globalThis.flushLayout();
            const align = getComputedStyle(cell()).textAlign;

            globalThis.column.ellipsize = 'middle';
            globalThis.flushLayout();
            const middle = cell().textContent;

            globalThis.column.ellipsize = 'start';
            globalThis.flushLayout();
            const start = {
                direction: getComputedStyle(cell()).direction,
                isolated: cell().firstElementChild?.tagName,
            };

            return { end, align, middle, start };
        });

        expect(result.end).toEqual({ overflow: 'ellipsis', scroll: true });
        expect(result.align).toBe('end');
        expect(result.middle).toMatch(/^A very.*….*at all$/);
        expect(result.middle.length).toBeLessThan(40);
        expect(result.start).toEqual({ direction: 'rtl', isolated: 'BDI' });
    });

    test('grows to fit its content, and can expand', async ({ page }) => {
        await openHarness(page);
        await createTable(page);

        const result = await page.evaluate(() => {
            const header = () =>
                document
                    .querySelector('.wy-table-view .wy-table-column-header')
                    .getBoundingClientRect().width;
            const natural = header();

            globalThis.column.expand = true;
            globalThis.flushLayout();

            return {
                natural,
                expanded: header(),
                filler: document.querySelector('.wy-filler').hidden,
            };
        });

        expect(result.natural).toBeGreaterThan(300);
        expect(result.expanded).toBeGreaterThanOrEqual(result.natural);
        expect(result.filler).toBe(true);
    });
});
