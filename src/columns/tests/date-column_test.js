// Browser tests of date columns: value types and Intl formats.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('DateColumn', () => {
    test('accepts dates, timestamps and ISO strings', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { DateColumn, toDate } = await import('/src/columns/date-column.js');
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');

            getLocaleManager().locale = 'en-US';

            const column = new DateColumn({ name: 'date', format: 'date' });
            const text = (date) => column.getCellText({ date }, 0);

            const date = new Date(2013, 8, 19, 14, 30);
            const values = [
                text(date),
                text(date.getTime()),
                text('2013-09-19'),
                text('2013-09-19T14:30:00'),
                text('soon'),
                text(null),
            ];

            column.format = 'long-date';
            const long = text(date);

            column.format = { year: 'numeric', month: 'long' };
            const custom = text(date);

            column.format = { timeStyle: 'short', timeZone: 'UTC' };
            const utc = text(Date.UTC(2013, 8, 19, 9, 5));

            column.format = 'date-time';
            const dateTime = text(date);

            let error = null;
            try {
                column.format = 'fancy';
            } catch (e) {
                error = e.constructor.name;
            }

            return {
                values,
                long,
                custom,
                utc,
                dateTime,
                error,
                local: toDate('2013-09-19').getDate(),
                alignment: column.alignment,
            };
        });

        expect(result.values).toEqual([
            'Sep 19, 2013',
            'Sep 19, 2013',
            'Sep 19, 2013',
            'Sep 19, 2013',
            '',
            '',
        ]);
        expect(result.long).toBe('Thu, Sep 19, 2013');
        expect(result.custom).toBe('September 2013');
        expect(result.utc).toMatch(/^9:05\sAM$/);
        expect(result.dateTime).toMatch(/^Sep 19, 2013, 2:30\sPM$/);
        expect(result.error).toBe('RangeError');
        expect(result.local).toBe(19);
        expect(result.alignment).toBe('end');
    });

    test('sorts dates in the model', async ({ page }) => {
        await openHarness(page);

        const order = await page.evaluate(async () => {
            const { ListModel } = await import('/src/data/list-model.js');

            const model = new ListModel({
                rows: [
                    { date: '2013-09-19' },
                    { date: new Date(2013, 0, 1) },
                    { date: Date.UTC(2014, 0, 1) },
                ],
                columnsInfo: { date: { type: 'date' } },
                sortColumn: 'date',
            });

            return model.rows.map(
                (x) => new Date(x.date).getFullYear() * 100 + new Date(x.date).getMonth()
            );
        });

        expect(order).toEqual([201300, 201308, 201400]);
    });
});
