// Browser tests of check box columns.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('CheckBoxColumn', () => {
    test('draws check boxes and toggles values in the model', async ({ page }) => {
        await openHarness(page);

        await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Table } = await import('/src/widgets/table.js');
            const { ListModel } = await import('/src/data/list-model.js');
            const { CheckBoxColumn } = await import('/src/columns/check-box-column.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const host = document.createElement('div');
            host.style.cssText = 'position: fixed; left: 0; top: 0; width: 300px; height: 200px;';
            document.body.append(host);

            const model = new ListModel({
                rows: [
                    { id: 'a', active: true },
                    { id: 'b', active: false },
                    { id: 'c', active: false },
                ],
                idColumn: 'id',
                sortColumn: 'active',
            });

            const window = new MainWindow({ host });
            const table = new Table({ model });
            const column = new CheckBoxColumn({ name: 'active', label: 'Active' });
            table.addColumn(column);
            window.addChild(table);
            window.show();
            flushLayout();

            globalThis.model = model;
            globalThis.column = column;
            globalThis.toggles = [];
            column.connect('toggle', (_column, index, row, active) =>
                globalThis.toggles.push([index, row.id, active])
            );
        });

        const checks = page.locator('.wy-table-body [role="checkbox"]');
        await expect(checks).toHaveCount(3);

        const box = await checks.first().boundingBox();
        expect(Math.round(box.width)).toBe(13);
        expect(Math.round(box.height)).toBe(13);

        // Rows are sorted on the value, so toggling moves the row; the signal has the new index.
        await page.locator('.wy-table-row[aria-rowindex="2"] [role="checkbox"]').click();

        const result = await page.evaluate(() => ({
            values: globalThis.model.rows.map((x) => `${x.id}:${x.active}`),
            toggles: globalThis.toggles,
            checked: [...document.querySelectorAll('.wy-table-body > .wy-table-row')]
                .sort((a, b) => a.getAttribute('aria-rowindex') - b.getAttribute('aria-rowindex'))
                .map((x) => x.querySelector('[role="checkbox"]').getAttribute('aria-checked')),
        }));

        // A re-sorted row goes after the rows it is equal to.
        expect(result.values).toEqual(['c:false', 'a:true', 'b:true']);
        expect(result.toggles).toEqual([[2, 'b', true]]);
        expect(result.checked).toEqual(['false', 'true', 'true']);

        const programmatic = await page.evaluate(() => [
            globalThis.column.toggle(0),
            globalThis.column.getCellText({ active: true }),
        ]);
        expect(programmatic).toEqual([true, '✓']);
    });
});
