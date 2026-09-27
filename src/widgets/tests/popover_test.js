// Browser tests of the Popover helper.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a line edit (the owner) and a popover with plain content, as globals.
async function mount(page) {
    await page.evaluate(async () => {
        const { Box } = await import('/src/widgets/box.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { LineEdit } = await import('/src/widgets/line-edit.js');
        const { Popover } = await import('/src/widgets/popover.js');

        const host = document.createElement('div');
        host.style.cssText =
            'position: absolute; inset: 0 auto auto 0; width: 600px; height: 500px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const box = new Box({
            orientation: 'vertical',
            margin: 40,
            vAlign: 'start',
            hAlign: 'start',
        });
        const owner = new LineEdit({ text: 'owner' });

        box.addChild(owner);
        window.addChild(box);
        window.show();

        const popover = new Popover({ owner });
        const content = document.createElement('div');
        content.className = 'test-content';
        content.style.cssText = 'width: 120px; height: 80px;';
        popover.contentElement.append(content);

        globalThis.owner = owner;
        globalThis.popover = popover;
        globalThis.closes = [];
        popover.connect('close', (_popover, reason) => globalThis.closes.push(reason));
    });
}

test.describe('Popover', () => {
    test('opens next to its anchor in the screen layer', async ({ page }) => {
        const errors = await openHarness(page);
        await mount(page);

        const result = await page.evaluate(() => {
            const { popover, owner } = globalThis;
            const opens = [];
            popover.connect('open', () => opens.push(true));

            popover.popup();
            popover.popup();

            const rect = popover.el.getBoundingClientRect();
            const anchor = owner.el.getBoundingClientRect();

            return {
                opens: opens.length,
                isOpen: popover.isOpen,
                isVisible: popover.isVisible,
                parent: popover.el.parentElement.className,
                x: Math.round(rect.left - anchor.left),
                y: Math.round(rect.top - anchor.bottom),
                zIndex: Number(popover.el.style.zIndex) > 10,
                side: popover.el.dataset.side,
            };
        });

        expect(errors).toEqual([]);
        expect(result).toEqual({
            opens: 1,
            isOpen: true,
            isVisible: true,
            parent: 'wy-screen',
            x: 0,
            y: 1,
            zIndex: true,
            side: 'bottom',
        });

        const matched = await page.evaluate(() => {
            const { popover, owner } = globalThis;
            popover.matchAnchorWidth = true;
            popover.align = 'end';

            return [popover.el.offsetWidth >= owner.el.offsetWidth, popover.el.dataset.side];
        });
        expect(matched).toEqual([true, 'bottom']);
    });

    test('closes on Escape and on presses outside, but not on the owner', async ({ page }) => {
        await openHarness(page);
        await mount(page);

        await page.click('.wy-line-edit-input');
        await page.evaluate(() => globalThis.popover.popup());

        // Pressing on the popover keeps the focus on the owner.
        await page.click('.test-content');
        await page.click('.wy-line-edit-input');

        const inside = await page.evaluate(() => [
            globalThis.popover.isOpen,
            globalThis.owner.hasFocus,
        ]);
        expect(inside).toEqual([true, true]);

        await page.keyboard.press('Escape');
        expect(await page.evaluate(() => globalThis.popover.isOpen)).toBe(false);

        await page.evaluate(() => globalThis.popover.popup());
        await page.mouse.click(500, 450);

        const result = await page.evaluate(() => ({
            isOpen: globalThis.popover.isOpen,
            attached: globalThis.popover.el.isConnected,
            closes: globalThis.closes,
        }));
        expect(result).toEqual({ isOpen: false, attached: false, closes: ['escape', 'outside'] });
    });

    test('closes when the owner goes away or the screen changes', async ({ page }) => {
        await openHarness(page);
        await mount(page);

        const result = await page.evaluate(async () => {
            const { popover, owner } = globalThis;

            popover.popup();
            owner.sensitive = false;
            const afterInsensitive = popover.isOpen;
            owner.sensitive = true;

            popover.popup();
            window.dispatchEvent(new Event('blur'));
            const afterBlur = popover.isOpen;

            popover.popup();
            owner.hide();
            const afterHide = popover.isOpen;
            owner.show();

            popover.popup();
            popover.popdown();

            let error = null;
            popover.destroy();
            try {
                popover.popup();
            } catch (e) {
                error = e.name;
            }

            return { afterInsensitive, afterBlur, afterHide, closes: globalThis.closes, error };
        });

        expect(result).toEqual({
            afterInsensitive: false,
            afterBlur: false,
            afterHide: false,
            closes: ['owner', 'blur', 'owner', 'api'],
            error: 'Error',
        });
    });

    test('holds a child widget that is sensitive and visible while open', async ({ page }) => {
        await openHarness(page);
        await mount(page);

        const result = await page.evaluate(async () => {
            const { Calendar } = await import('/src/widgets/calendar.js');
            const { popover } = globalThis;

            const calendar = new Calendar();
            popover.contentElement.textContent = '';
            popover.child = calendar;

            const closed = [calendar.isVisible, calendar.isSensitive];
            popover.popup();
            const open = [calendar.isVisible, calendar.isSensitive];

            return { closed, open };
        });

        expect(result).toEqual({ closed: [false, true], open: [true, true] });
    });
});
