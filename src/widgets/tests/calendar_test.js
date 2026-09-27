// Browser tests of the Calendar widget.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a calendar in a main window, as `globalThis.widget`.
async function mount(page, properties = {}, locale = 'en-US') {
    await page.evaluate(
        async ({ properties, locale }) => {
            const { Box } = await import('/src/widgets/box.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Calendar } = await import('/src/widgets/calendar.js');
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');

            getLocaleManager().locale = locale;

            const host = document.createElement('div');
            host.style.cssText =
                'position: absolute; inset: 0 auto auto 0; width: 600px; height: 500px;';
            document.body.append(host);

            const window = new MainWindow({ host });
            const box = new Box({
                orientation: 'vertical',
                margin: 20,
                vAlign: 'start',
                hAlign: 'start',
            });
            const widget = new Calendar(properties);

            box.addChild(widget);
            window.addChild(box);
            window.show();

            globalThis.widget = widget;
            globalThis.events = [];
            for (const name of ['day-selected', 'day-activate', 'month-change']) {
                widget.connect(name, () => globalThis.events.push(name));
            }
        },
        { properties, locale }
    );
}

// The visible state: the heading, the day names, the cursor and the selected day.
const view = (page) =>
    page.evaluate(() => {
        const el = globalThis.widget.el;
        const date = globalThis.widget.date;

        return {
            month: el.querySelector('.wy-calendar-month').textContent,
            year: el.querySelector('.wy-calendar-year').textContent,
            names: [...el.querySelectorAll('.wy-calendar-day-name')].map((x) => x.textContent),
            first: el.querySelector('.wy-calendar-day').textContent,
            cursor: el.querySelector('.wy-cursor').dataset.date,
            selected: date
                ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
                : null,
        };
    });

test.describe('Calendar', () => {
    test('shows a month with the locale names and first day of the week', async ({ page }) => {
        const errors = await openHarness(page);
        await mount(page, { date: new Date(2026, 8, 27) });

        expect(errors).toEqual([]);
        expect(await view(page)).toEqual({
            month: 'September',
            year: '2026',
            names: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            first: '30',
            cursor: '2026-9-27',
            selected: '2026-9-27',
        });

        const dutch = await page.evaluate(async () => {
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');
            getLocaleManager().locale = 'nl-NL';

            const el = globalThis.widget.el;

            return {
                month: el.querySelector('.wy-calendar-month').textContent,
                name: el.querySelector('.wy-calendar-day-name').textContent,
                first: el.querySelector('.wy-calendar-day').textContent,
                grid: el.querySelector('[role="grid"]').getAttribute('aria-activedescendant'),
                label: el.querySelector('.wy-cursor').getAttribute('aria-label'),
            };
        });

        expect(dutch.month).toBe('september');
        expect(dutch.name).toMatch(/^ma/);
        expect(dutch.first).toBe('31');
        expect(dutch.grid).toMatch(/^wy-calendar-day/);
        expect(dutch.label).toContain('27 september 2026');
    });

    test('the keyboard moves the cursor, selects and activates', async ({ page }) => {
        await openHarness(page);
        await mount(page, { date: new Date(2026, 8, 27) });

        await page.evaluate(() => globalThis.widget.focus());

        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        expect((await view(page)).cursor).toBe('2026-10-5');

        await page.keyboard.press('Home');
        expect((await view(page)).cursor).toBe('2026-10-4');

        await page.keyboard.press('End');
        await page.keyboard.press('PageUp');
        expect((await view(page)).cursor).toBe('2026-9-10');

        await page.keyboard.press('Shift+PageDown');
        expect(await view(page)).toMatchObject({ month: 'September', year: '2027' });

        await page.keyboard.press('Space');
        expect((await view(page)).selected).toBe('2027-9-10');

        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('Enter');
        expect((await view(page)).selected).toBe('2027-9-9');

        // Moving the cursor to the 31st of a month that has fewer days clamps it.
        await page.evaluate(() => (globalThis.widget.cursor = new Date(2026, 0, 31)));
        await page.keyboard.press('PageDown');
        expect((await view(page)).cursor).toBe('2026-2-28');

        const events = await page.evaluate(() => globalThis.events);
        expect(events).toEqual([
            'month-change',
            'month-change',
            'month-change',
            'day-selected',
            'day-selected',
            'day-activate',
            'month-change',
            'month-change',
        ]);
    });

    test('clicking selects, double-clicking activates, and the headings navigate', async ({
        page,
    }) => {
        await openHarness(page);
        await mount(page, { date: new Date(2026, 8, 27) });

        await page.click('.wy-calendar-day >> text=/^15$/');
        expect((await view(page)).selected).toBe('2026-9-15');

        await page.dblclick('.wy-calendar-day >> text=/^16$/');
        expect((await view(page)).selected).toBe('2026-9-16');

        // A day of the next month shows that month.
        await page.click('.wy-calendar-day.wy-other-month >> nth=-1');
        expect(await view(page)).toMatchObject({ month: 'October', selected: '2026-10-10' });

        await page.click('[data-action="previous-month"]');
        await page.click('[data-action="previous-month"]');
        await page.click('[data-action="next-year"]');
        expect(await view(page)).toMatchObject({ month: 'August', year: '2027' });

        // The wheel changes the month.
        const box = await page.locator('.wy-calendar-grid').boundingBox();
        await page.mouse.move(box.x + 20, box.y + 40);
        await page.mouse.wheel(0, 100);
        await expect.poll(async () => (await view(page)).month).toBe('September');

        const result = await page.evaluate(() => ({
            activations: globalThis.events.filter((x) => x === 'day-activate').length,
            focused: globalThis.widget.hasFocus,
        }));
        expect(result).toEqual({ activations: 1, focused: true });
    });

    test('days outside the date range cannot be chosen', async ({ page }) => {
        await openHarness(page);
        await mount(page, {
            date: new Date(2026, 8, 15),
            minDate: new Date(2026, 8, 10),
            maxDate: new Date(2026, 9, 5),
            showWeekNumbers: true,
        });

        await page.click('.wy-calendar-day >> text=/^8$/', { force: true });
        expect((await view(page)).selected).toBe('2026-9-15');

        const state = await page.evaluate(() => {
            const el = globalThis.widget.el;
            const navigation = (action) =>
                el.querySelector(`[data-action="${action}"]`).classList.contains('wy-disabled');

            return {
                disabled: el.querySelectorAll('.wy-calendar-day.wy-disabled').length,
                previous: navigation('previous-month'),
                next: navigation('next-month'),
                weeks: [...el.querySelectorAll('.wy-calendar-week-number')]
                    .slice(1)
                    .map((x) => x.textContent),
                selectable: globalThis.widget.selectDay(new Date(2026, 9, 6)),
            };
        });

        expect(state).toEqual({
            disabled: 42 - 26,
            previous: true,
            next: false,
            weeks: ['36', '37', '38', '39', '40', '41'],
            selectable: false,
        });

        // The cursor stays in the range.
        await page.evaluate(() => globalThis.widget.focus());
        await page.keyboard.press('PageDown');
        await page.keyboard.press('PageDown');
        expect((await view(page)).cursor).toBe('2026-10-5');
    });
});
