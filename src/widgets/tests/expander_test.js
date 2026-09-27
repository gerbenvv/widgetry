// Browser tests of the Expander.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows an expander with a focusable child in a main window, and a focusable block after it.
async function setUp(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { Widget, flushLayout } = await import('/src/widgets/widget.js');
        const { defineProperties } = await import('/src/core/instance.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');
        const { Expander } = await import('/src/widgets/expander.js');

        class Block extends Widget {
            _render() {
                const element = document.createElement('div');
                element.style.cssText = 'min-width: 60px; min-height: 40px; background: #ccc;';

                return element;
            }
        }

        defineProperties(Block, { canFocus: { value: true } });

        const host = document.createElement('div');
        host.style.cssText = 'width: 400px; height: 300px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const box = new Box({ orientation: 'vertical' });
        const expander = new Expander({ label: 'Details', ...properties });
        const child = new Block({ name: 'child', vExpand: true });
        expander.addChild(child);
        box.addChild(expander);
        box.addChild(new Block({ name: 'after' }));
        window.addChild(box);
        window.show();
        flushLayout();

        globalThis.expander = expander;
        globalThis.child = child;
        globalThis.window_ = window;
        globalThis.activations = 0;
        expander.connect('activate', () => (globalThis.activations += 1));
    }, properties);
}

const state = (page) =>
    page.evaluate(() => ({
        expanded: globalThis.expander.expanded,
        aria: globalThis.expander.focusElement.getAttribute('aria-expanded'),
        childShown: globalThis.child.el.getBoundingClientRect().height > 0,
        activations: globalThis.activations,
    }));

test.describe('expander', () => {
    test('clicking the title shows and hides the child', async ({ page }) => {
        const errors = await openHarness(page);
        await setUp(page);

        expect(errors).toEqual([]);
        expect(await state(page)).toEqual({
            expanded: false,
            aria: 'false',
            childShown: false,
            activations: 0,
        });

        await page.locator('.wy-expander-header').click();
        expect(await state(page)).toEqual({
            expanded: true,
            aria: 'true',
            childShown: true,
            activations: 1,
        });

        await page.locator('.wy-expander-header').click();
        expect((await state(page)).expanded).toBe(false);
    });

    test('the keyboard toggles, and the hidden child is out of the focus chain', async ({
        page,
    }) => {
        await openHarness(page);
        await setUp(page);

        await expect.poll(() => page.evaluate(() => globalThis.expander.hasFocus)).toBe(true);

        const chain = () =>
            page.evaluate(() => globalThis.window_._getFocusChain().map((x) => x.name || 'exp'));

        expect(await chain()).toEqual(['exp', 'after']);

        await page.keyboard.press('Enter');
        expect((await state(page)).expanded).toBe(true);
        expect(await chain()).toEqual(['exp', 'child', 'after']);

        await page.keyboard.press('Space');
        expect((await state(page)).expanded).toBe(false);

        await page.keyboard.press('ArrowRight');
        expect((await state(page)).expanded).toBe(true);

        // Collapsing while the child has the focus moves the focus to the title.
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => globalThis.child.hasFocus)).toBe(true);
        await page.evaluate(() => (globalThis.expander.expanded = false));
        expect(await page.evaluate(() => globalThis.expander.hasFocus)).toBe(true);

        expect((await state(page)).activations).toBe(3);
    });

    test('a collapsed expander does not expand', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(() => {
            const collapsed = globalThis.expander.isVExpand;
            globalThis.expander.expanded = true;

            return [collapsed, globalThis.expander.isVExpand];
        });

        expect(result).toEqual([false, true]);
    });

    test('a label widget replaces the text', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { spacing: 8, expanded: true });

        const result = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const expander = globalThis.expander;

            const label = new Label({ text: '<b>Bold</b>', useMarkup: true });
            expander.labelWidget = label;

            const states = {
                label: expander.label,
                parent: label.parent === expander,
                gap: getComputedStyle(expander.el).rowGap,
            };

            expander.destroy();
            states.destroyed = label.destroyed;

            return states;
        });

        expect(result).toEqual({ label: null, parent: true, gap: '8px', destroyed: true });
    });
});
