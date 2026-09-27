// Browser tests of number columns: Intl formatting, styles and alignment.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('NumberColumn', () => {
    test('formats numbers for the locale', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { NumberColumn } = await import('/src/columns/number-column.js');
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');

            const locales = getLocaleManager();
            locales.locale = 'en-US';

            const column = new NumberColumn({ name: 'value' });
            const text = (value) => column.getCellText({ value }, 0);

            const english = [text(1234.5), text('7'), text(null), text('abc'), text(NaN)];

            column.digits = 0;
            const rounded = text(2.5);

            column.set({ style: 'percent', digits: 1 });
            const percent = text(0.256);

            column.set({ style: 'currency', currency: 'USD', digits: 2 });
            const currency = text(-3);

            column.set({
                style: 'decimal',
                maximumFractionDigits: 4,
                minimumFractionDigits: 0,
                useGrouping: false,
            });
            const precise = text(12345.67891);

            locales.locale = 'nl-NL';
            const dutch = text(1234.5);
            locales.locale = 'en-US';

            let error = null;
            try {
                column.style = 'fancy';
            } catch (e) {
                error = e.constructor.name;
            }

            return {
                english,
                rounded,
                percent,
                currency,
                precise,
                dutch,
                alignment: column.alignment,
                error,
            };
        });

        expect(result.english).toEqual(['1,234.50', '7.00', '', '', '']);
        expect(result.rounded).toBe('3');
        expect(result.percent).toBe('25.6%');
        expect(result.currency).toBe('-$3.00');
        expect(result.precise).toBe('12345.6789');
        expect(result.dutch).toBe('1234,5');
        expect(result.alignment).toBe('end');
        expect(result.error).toBe('RangeError');
    });

    test('is right aligned in a table and updates when the locale changes', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Table } = await import('/src/widgets/table.js');
            const { ListModel } = await import('/src/data/list-model.js');
            const { NumberColumn } = await import('/src/columns/number-column.js');
            const { flushLayout } = await import('/src/widgets/widget.js');
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');

            getLocaleManager().locale = 'en-US';

            const host = document.createElement('div');
            host.style.cssText = 'position: fixed; left: 0; top: 0; width: 400px; height: 200px;';
            document.body.append(host);

            const window = new MainWindow({ host });
            const table = new Table({ model: new ListModel({ rows: [{ value: 1234.5 }] }) });
            table.addColumn(new NumberColumn({ name: 'value', label: 'Value' }));
            window.addChild(table);
            window.show();

            await new Promise((resolve) => requestAnimationFrame(resolve));
            flushLayout();

            const cell = () => document.querySelector('.wy-table-body .wy-table-cell');
            const before = {
                text: cell().textContent,
                align: getComputedStyle(cell()).textAlign,
                numeric: getComputedStyle(cell()).fontVariantNumeric,
            };

            getLocaleManager().locale = 'de-DE';
            flushLayout();
            const after = cell().textContent;
            getLocaleManager().locale = 'en-US';

            return { before, after };
        });

        expect(result.before).toEqual({ text: '1,234.50', align: 'end', numeric: 'tabular-nums' });
        expect(result.after).toBe('1.234,50');
    });
});
