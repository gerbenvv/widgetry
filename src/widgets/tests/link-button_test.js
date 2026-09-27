// Browser tests of LinkButton.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a link button, available as `globalThis.link`; opened URIs are in `globalThis.opened`.
async function openWindow(page, properties) {
    const errors = await openHarness(page);

    const rect = await page.evaluate(async (properties) => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');
        const { LinkButton } = await import('/src/widgets/link-button.js');
        const { flushLayout } = await import('/src/widgets/widget.js');

        globalThis.opened = [];
        globalThis.open = (uri, target, features) =>
            globalThis.opened.push([uri, target, features]);

        const window = new MainWindow();
        const box = new Box({ margin: 10, vAlign: 'start', hAlign: 'start' });
        window.addChild(box);
        globalThis.link = box.addChild(new LinkButton(properties));
        window.show();
        flushLayout();

        const r = globalThis.link.el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, properties);

    return { errors, rect };
}

test.describe('LinkButton', () => {
    test('the label defaults to the URI, and clicking opens it', async ({ page }) => {
        const { errors, rect } = await openWindow(page, { uri: 'https://example.com/' });

        const before = await page.evaluate(() => [
            globalThis.link.child.text,
            globalThis.link.el.getAttribute('role'),
            globalThis.link.visited,
        ]);
        expect(before).toEqual(['https://example.com/', 'link', false]);

        await page.mouse.click(rect.x, rect.y);

        const after = await page.evaluate(() => [
            globalThis.opened,
            globalThis.link.visited,
            globalThis.link.hasStyleClass('wy-visited'),
        ]);
        expect(after).toEqual([
            [['https://example.com/', '_blank', 'noopener,noreferrer']],
            true,
            true,
        ]);
        expect(errors).toEqual([]);
    });

    test('a handler returning true keeps the URI from opening', async ({ page }) => {
        await openWindow(page, { uri: 'https://example.com/', label: 'Example' });

        const result = await page.evaluate(() => {
            globalThis.link.connect('activate', () => true);
            globalThis.link.activate();

            return [globalThis.opened.length, globalThis.link.visited, globalThis.link.child.text];
        });

        expect(result).toEqual([0, false, 'Example']);
    });

    test('links look like hyperlinks and the keyboard opens them', async ({ page }) => {
        await openWindow(page, { uri: 'https://example.com/a', label: 'A link' });

        const style = await page.evaluate(() => {
            const link = globalThis.link;

            return [
                getComputedStyle(link.el).borderTopColor,
                getComputedStyle(link.child.el).textDecorationLine,
                getComputedStyle(link.el).cursor,
                getComputedStyle(link.child.el).color === getComputedStyle(link.el).color,
            ];
        });
        expect(style).toEqual(['rgba(0, 0, 0, 0)', 'underline', 'pointer', true]);

        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
        await expect.poll(() => page.evaluate(() => globalThis.opened.length)).toBe(1);
    });
});
