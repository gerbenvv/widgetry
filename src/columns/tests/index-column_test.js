// Browser tests of index columns.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('IndexColumn', () => {
    test('shows row numbers and grows with the number of rows', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Table } = await import('/src/widgets/table.js');
            const { ListModel } = await import('/src/data/list-model.js');
            const { IndexColumn } = await import('/src/columns/index-column.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const host = document.createElement('div');
            host.style.cssText = 'position: fixed; left: 0; top: 0; width: 400px; height: 200px;';
            document.body.append(host);

            const model = new ListModel({ rows: Array.from({ length: 5 }, () => ({})) });
            const window = new MainWindow({ host });
            const table = new Table({ model });
            const column = new IndexColumn();
            table.addColumn(column);
            window.addChild(table);
            window.show();

            await new Promise((resolve) => requestAnimationFrame(resolve));
            flushLayout();

            const width = () =>
                document
                    .querySelector('.wy-table-view .wy-table-column-header')
                    .getBoundingClientRect().width;
            const texts = () =>
                [...document.querySelectorAll('.wy-table-body .wy-table-cell')]
                    .map((x) => x.textContent)
                    .sort();

            const small = {
                width: width(),
                texts: texts(),
                label: column.label,
                sortable: column.isSortable,
            };

            model.appendRows(Array.from({ length: 99995 }, () => ({})));
            flushLayout();
            const large = width();

            column.offset = 0;
            flushLayout();

            return {
                small,
                large,
                first: document.querySelector('.wy-table-row[aria-rowindex="2"] .wy-table-cell')
                    .textContent,
            };
        });

        expect(result.small.texts).toEqual(['1', '2', '3', '4', '5']);
        expect(result.small.label).toBe('#');
        expect(result.small.sortable).toBe(false);
        expect(result.large).toBeGreaterThan(result.small.width);
        expect(result.first).toBe('0');
    });
});
