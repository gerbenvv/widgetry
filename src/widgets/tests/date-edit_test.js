// Browser tests of the DateEdit widget.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a date edit in a main window, as `globalThis.widget`.
async function mount(page, properties = {}, locale = 'en-US') {
    await page.evaluate(
        async ({ properties, locale }) => {
            const { Box } = await import('/src/widgets/box.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { DateEdit } = await import('/src/widgets/date-edit.js');
            const { LineEdit } = await import('/src/widgets/line-edit.js');
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');

            getLocaleManager().locale = locale;

            const host = document.createElement('div');
            host.style.cssText =
                'position: absolute; inset: 0 auto auto 0; width: 600px; height: 500px;';
            document.body.append(host);

            const window = new MainWindow({ host });
            const box = new Box({
                orientation: 'vertical',
                spacing: 8,
                margin: 20,
                vAlign: 'start',
            });
            const widget = new DateEdit({ hAlign: 'start', ...properties });

            box.addChild(widget);
            box.addChild(new LineEdit({ name: 'next' }));
            window.addChild(box);
            window.show();

            globalThis.widget = widget;
            globalThis.changes = [];
            globalThis.textChanges = 0;
            widget.connect('date-change', () => {
                const date = widget.date;
                globalThis.changes.push(date ? date.toDateString() : null);
            });
            widget.connect('change', () => globalThis.textChanges++);
        },
        { properties, locale }
    );
}

const state = (page) =>
    page.evaluate(() => ({
        date: globalThis.widget.date?.toDateString() ?? null,
        text: globalThis.widget.text,
        valid: globalThis.widget.isValid,
    }));

test.describe('DateEdit', () => {
    test('shows the date in the locale format', async ({ page }) => {
        const errors = await openHarness(page);
        await mount(page, { date: new Date(2026, 8, 27, 15, 30) });

        expect(errors).toEqual([]);
        expect(await state(page)).toEqual({
            date: 'Sun Sep 27 2026',
            text: 'Sep 27, 2026',
            valid: true,
        });

        const formats = await page.evaluate(async () => {
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');
            const widget = globalThis.widget;
            const texts = [];

            widget.format = { dateStyle: 'short' };
            texts.push(widget.text);

            getLocaleManager().locale = 'de-DE';
            texts.push(widget.text);

            widget.date = '2024-02-29';
            texts.push(widget.text, widget.value.getDate());

            widget.date = null;
            texts.push(widget.text);

            return texts;
        });

        expect(formats).toEqual(['9/27/26', '27.09.26', '29.02.24', 29, '']);
    });

    test('typed dates are parsed in the locale order, and as ISO dates', async ({ page }) => {
        await openHarness(page);
        await mount(page);

        const input = page.locator('.wy-date-edit input');

        await input.fill('3/14/2025');
        expect(await state(page)).toMatchObject({ date: 'Fri Mar 14 2025', valid: true });

        await input.fill('2025-12-01');
        expect(await state(page)).toMatchObject({ date: 'Mon Dec 01 2025', valid: true });

        await input.fill('Jan 5 2024');
        expect(await state(page)).toMatchObject({ date: 'Fri Jan 05 2024', valid: true });

        // An invalid text keeps the last date and shows the invalid state.
        await input.fill('2/30/2025');
        const invalid = await page.evaluate(() => [
            globalThis.widget.isValid,
            globalThis.widget.el.classList.contains('wy-invalid'),
        ]);
        expect(await state(page)).toMatchObject({ date: 'Fri Jan 05 2024' });
        expect(invalid).toEqual([false, true]);

        // Leaving a valid text shows it in the format again.
        await input.fill('7/4/25');
        await page.keyboard.press('Tab');
        expect(await state(page)).toEqual({
            date: 'Fri Jul 04 2025',
            text: 'Jul 4, 2025',
            valid: true,
        });

        await input.fill('');
        expect(await state(page)).toMatchObject({ date: null, valid: true });

        const changes = await page.evaluate(() => globalThis.changes);
        expect(changes).toEqual([
            'Fri Mar 14 2025',
            'Mon Dec 01 2025',
            'Fri Jan 05 2024',
            'Fri Jul 04 2025',
            null,
        ]);

        const parsed = await page.evaluate(async () => {
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');
            const widget = globalThis.widget;
            const parse = (text, locale) => {
                getLocaleManager().locale = locale;

                return widget.parseDate(text)?.toDateString() ?? null;
            };

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const result = {
                dutch: parse('27-9-2026', 'nl-NL'),
                dutchName: parse('27 sep. 2026', 'nl-NL'),
                noYear: parse('14.3.', 'de-DE'),
                japanese: parse('2026/09/27', 'ja-JP'),
                twoDigits: parse('1/2/99', 'en-US'),
                nonsense: parse('hello', 'en-US'),
                tomorrow: parse('tomorrow', 'en-US') === tomorrow.toDateString(),
                now: widget.parseDate('now').getHours(),
            };

            getLocaleManager().locale = 'en-US';

            return result;
        });

        expect(parsed).toEqual({
            dutch: 'Sun Sep 27 2026',
            dutchName: 'Sun Sep 27 2026',
            noYear: new Date(new Date().getFullYear(), 2, 14).toDateString(),
            japanese: 'Sun Sep 27 2026',
            twoDigits: 'Sat Jan 02 1999',
            nonsense: null,
            tomorrow: true,
            now: 0,
        });

        // The `change` signal is about the text, like that of a line edit.
        const textChanges = await page.evaluate(() => {
            const widget = globalThis.widget;
            const before = globalThis.textChanges;
            const dates = globalThis.changes.length;

            widget.text = '3/1';
            widget.text = '3/14';

            return {
                texts: globalThis.textChanges - before,
                dates: globalThis.changes.length - dates,
            };
        });

        expect(textChanges).toEqual({ texts: 2, dates: 2 });
    });

    test('reads back the dates it shows in every locale and date style', async ({ page }) => {
        await openHarness(page);
        await mount(page, { date: '2026-09-27' });

        const failures = await page.evaluate(async () => {
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');
            const widget = globalThis.widget;
            const failures = [];

            const locales = [
                ...['en-US', 'nl-NL', 'de-DE', 'fr-FR', 'pl-PL', 'ru-RU', 'uk-UA', 'fi-FI'],
                ...['lt-LT', 'el-GR', 'cs-CZ', 'ca-ES', 'vi-VN', 'hi-IN', 'he-IL', 'th-TH'],
                ...['ar-EG', 'fa-IR', 'bn-BD', 'ja-JP', 'ko-KR', 'zh-CN'],
            ];

            for (const locale of locales) {
                getLocaleManager().locale = locale;

                for (const dateStyle of ['short', 'medium', 'long', 'full']) {
                    widget.format = { dateStyle };

                    const text = widget.text;
                    widget.date = null;
                    widget.text = text;

                    const date = widget.date?.toDateString();
                    if (!widget.isValid || date !== 'Sun Sep 27 2026') {
                        failures.push(`${locale} ${dateStyle}: ${text} -> ${date}`);
                    }

                    widget.date = '2026-09-27';
                }
            }

            return failures;
        });

        expect(failures).toEqual([]);
    });

    test('the date range limits the dates', async ({ page }) => {
        await openHarness(page);
        await mount(page, {
            minDate: new Date(2026, 0, 1),
            maxDate: new Date(2026, 11, 31),
            date: new Date(2026, 5, 1),
        });

        await page.locator('.wy-date-edit input').fill('1/1/2027');
        expect(await state(page)).toMatchObject({ date: 'Mon Jun 01 2026', valid: false });

        const error = await page.evaluate(() => {
            try {
                globalThis.widget.date = new Date(2025, 0, 1);
            } catch (e) {
                return e.name;
            }

            return null;
        });
        expect(error).toBe('RangeError');
    });

    test('the button opens a calendar, and a click chooses a day', async ({ page }) => {
        await openHarness(page);
        await mount(page, { date: new Date(2026, 8, 27) });

        await page.click('.wy-date-edit-button');

        const open = await page.evaluate(() => {
            const widget = globalThis.widget;
            const calendar = widget.calendar;

            return {
                open: widget.popupOpen,
                focused: document.activeElement === widget.focusElement,
                expanded: widget.focusElement.getAttribute('aria-expanded'),
                role: widget.focusElement.getAttribute('role'),
                shown: calendar.isVisible,
                selected: calendar.el.querySelector('.wy-selected').textContent,
            };
        });

        expect(open).toEqual({
            open: true,
            focused: true,
            expanded: 'true',
            role: 'combobox',
            shown: true,
            selected: '27',
        });

        await page.click('.wy-date-edit-popover .wy-calendar-day >> text=/^12$/');

        const result = await page.evaluate(() => ({
            open: globalThis.widget.popupOpen,
            focused: globalThis.widget.hasFocus,
            changes: globalThis.changes,
        }));

        expect(await state(page)).toMatchObject({ date: 'Sat Sep 12 2026', text: 'Sep 12, 2026' });
        expect(result).toEqual({ open: false, focused: true, changes: ['Sat Sep 12 2026'] });
    });

    test('the keyboard opens the calendar and moves through the days', async ({ page }) => {
        await openHarness(page);
        await mount(page, { date: new Date(2026, 8, 27) });

        await page.click('.wy-date-edit input');
        await page.keyboard.press('Alt+ArrowDown');
        expect(await page.evaluate(() => globalThis.widget.popupOpen)).toBe(true);

        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('PageDown');

        const cursor = await page.evaluate(() => ({
            cursor: globalThis.widget.calendar.cursor.toDateString(),
            descendant: globalThis.widget.focusElement.getAttribute('aria-activedescendant'),
            date: globalThis.widget.date.toDateString(),
        }));

        expect(cursor.cursor).toBe('Thu Nov 05 2026');
        expect(cursor.descendant).toMatch(/^wy-calendar-day/);
        expect(cursor.date).toBe('Sun Sep 27 2026');

        // Escape closes without choosing; Enter chooses.
        await page.keyboard.press('Escape');
        expect(await state(page)).toMatchObject({ date: 'Sun Sep 27 2026' });

        await page.keyboard.press('F4');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('Enter');

        const result = await page.evaluate(() => ({
            open: globalThis.widget.popupOpen,
            focused: globalThis.widget.hasFocus,
        }));

        expect(await state(page)).toMatchObject({ date: 'Sat Sep 26 2026', text: 'Sep 26, 2026' });
        expect(result).toEqual({ open: false, focused: true });

        // Tabbing away closes the calendar.
        await page.keyboard.press('F4');
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => globalThis.widget.popupOpen)).toBe(false);
    });

    test('popup() and popdown() open and close the calendar', async ({ page }) => {
        await openHarness(page);
        await mount(page, { date: new Date(2026, 8, 27) });

        const states = await page.evaluate(() => {
            const widget = globalThis.widget;
            const states = [];
            widget.connect('popup-open-change', () => states.push(widget.popupOpen));

            widget.popup();
            widget.popdown();
            widget.togglePopup();
            widget.popupOpen = false;

            return states;
        });

        expect(states).toEqual([true, false, true, false]);
    });
});
