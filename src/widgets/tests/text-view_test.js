// Browser tests of the TextView widget.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a text view in a main window, as `globalThis.widget`.
async function mount(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { Box } = await import('/src/widgets/box.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { TextView } = await import('/src/widgets/text-view.js');

        const host = document.createElement('div');
        host.style.cssText =
            'position: absolute; inset: 0 auto auto 0; width: 600px; height: 400px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const box = new Box({ orientation: 'vertical', spacing: 8, margin: 20 });
        const widget = new TextView(properties);

        box.addChild(widget);
        window.addChild(box);
        window.show();

        globalThis.widget = widget;
        globalThis.changes = 0;
        widget.connect('change', () => (globalThis.changes += 1));
    }, properties);
}

test.describe('TextView', () => {
    test('typing multiple lines changes the text', async ({ page }) => {
        const errors = await openHarness(page);
        await mount(page);

        await page.click('.wy-text-view-input');
        await page.keyboard.type('First line');
        await page.keyboard.press('Enter');
        await page.keyboard.type('Second');

        const result = await page.evaluate(() => ({
            text: globalThis.widget.text,
            changes: globalThis.changes,
            hasFocus: globalThis.widget.hasFocus,
        }));

        expect(errors).toEqual([]);
        expect(result).toEqual({ text: 'First line\nSecond', changes: 17, hasFocus: true });
    });

    test('has wrap modes, a monospace font and a selection API', async ({ page }) => {
        await openHarness(page);
        await mount(page, { text: 'Some text\r\nwith lines', wrapMode: 'none', monospace: true });

        const result = await page.evaluate(() => {
            const widget = globalThis.widget;
            const area = widget.focusElement;
            const style = () => getComputedStyle(area).whiteSpace;

            const states = [widget.text, area.wrap, style()];

            widget.wrapMode = 'word';
            states.push(area.wrap, style());

            states.push(getComputedStyle(area).fontFamily.includes('mono'));

            widget.selectRegion(5, 9);
            states.push(widget.getSelectedText());

            widget.focus();
            widget.insertAtCursor('words');
            states.push(widget.text);

            widget.selectAll();
            states.push(widget.getSelectionBounds());

            let error = null;
            try {
                widget.wrapMode = 'lines';
            } catch (e) {
                error = e.name;
            }
            states.push(error);

            return states;
        });

        expect(result).toEqual([
            'Some text\nwith lines',
            'off',
            'pre',
            'soft',
            'pre-wrap',
            true,
            'text',
            'Some words\nwith lines',
            { start: 0, end: 21 },
            'RangeError',
        ]);
    });

    test('is read-only when not editable or insensitive, and can accept tabs', async ({ page }) => {
        await openHarness(page);
        await mount(page, { text: 'fixed', editable: false });

        await page.click('.wy-text-view-input');
        await page.keyboard.type('xyz');

        const readOnly = await page.evaluate(() => [
            globalThis.widget.text,
            globalThis.widget.isEditable,
            globalThis.widget.el.classList.contains('wy-read-only'),
        ]);
        expect(readOnly).toEqual(['fixed', false, true]);

        await page.evaluate(() => {
            globalThis.widget.editable = true;
            globalThis.widget.acceptsTab = true;
            globalThis.widget.text = '';
        });

        await page.click('.wy-text-view-input');
        await page.keyboard.press('Tab');
        await page.keyboard.type('indented');

        const tabbed = await page.evaluate(() => {
            const states = [globalThis.widget.text, globalThis.widget.hasFocus];

            globalThis.widget.sensitive = false;
            states.push(globalThis.widget.isEditable, globalThis.widget.focusElement.readOnly);

            return states;
        });
        expect(tabbed).toEqual(['\tindented', true, false, true]);
    });
});
