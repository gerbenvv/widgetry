// Browser tests of tooltips: the appear delay, placement at the pointer, browse mode, hiding on
// leave and press, and cleanup.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Builds a main window with two widgets that have tooltips.
async function setup(page) {
    await page.evaluate(async () => {
        const { Application } = await import('/src/core/application.js');
        const { Box } = await import('/src/widgets/box.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Tooltip } = await import('/src/widgets/tooltip.js');
        const { Widget } = await import('/src/widgets/widget.js');

        class Block extends Widget {
            _render() {
                const element = document.createElement('div');
                element.className = 'test-block';
                element.style.cssText = 'width: 120px; height: 40px; margin: 40px;';

                return element;
            }
        }

        Application.tooltipAppearDelay = 200;

        const first = new Block({ name: 'first', tooltipLabel: 'The first block' });
        const second = new Block({ name: 'second', tooltipLabel: 'The second block' });
        const box = new Box();
        box.addChild(first);
        box.addChild(second);

        const window = new MainWindow();
        window.addChild(box);
        window.show();

        globalThis.t = { Application, Tooltip, first, second };
    });
}

test.describe('tooltip', () => {
    test('appears after the delay below the pointer and disappears on leave', async ({ page }) => {
        const errors = await openHarness(page);
        await setup(page);

        const box = await page.locator('[data-name="first"]').boundingBox();
        await page.mouse.move(box.x + 30, box.y + 10);

        await page.waitForTimeout(100);
        expect(await page.evaluate(() => globalThis.t.first.tooltip.visible)).toBe(false);

        await page.waitForTimeout(250);

        const state = await page.evaluate(() => {
            const tooltip = globalThis.t.first.tooltip;
            const rect = tooltip.el.getBoundingClientRect();

            return {
                visible: tooltip.visible,
                text: tooltip.el.textContent.trim(),
                role: tooltip.el.getAttribute('role'),
                describedBy:
                    globalThis.t.first.el.getAttribute('aria-describedby') === tooltip.el.id,
                x: rect.left,
                y: rect.top,
                shown: globalThis.t.Tooltip.shown === tooltip,
            };
        });

        expect(state.visible).toBe(true);
        expect(state.text).toBe('The first block');
        expect(state.role).toBe('tooltip');
        expect(state.describedBy).toBe(true);
        expect(Math.abs(state.x - (box.x + 30))).toBeLessThanOrEqual(1);
        expect(state.y).toBeGreaterThan(box.y + 10);
        expect(state.shown).toBe(true);

        await page.mouse.move(box.x + 30, box.y + box.height + 30);
        await page.waitForTimeout(250);

        expect(await page.evaluate(() => globalThis.t.first.tooltip.visible)).toBe(false);
        expect(errors).toEqual([]);
    });

    test('the pointer must rest: moving restarts the delay', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        const box = await page.locator('[data-name="first"]').boundingBox();
        for (let i = 0; i < 6; i++) {
            await page.mouse.move(box.x + 10 + i * 10, box.y + 10);
            await page.waitForTimeout(80);
        }

        expect(await page.evaluate(() => globalThis.t.first.tooltip.visible)).toBe(false);

        await page.waitForTimeout(250);
        expect(await page.evaluate(() => globalThis.t.first.tooltip.visible)).toBe(true);
    });

    test('moving to another widget switches instantly, one tooltip at a time', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.hover('[data-name="first"]');
        await page.waitForTimeout(350);
        await page.hover('[data-name="second"]');

        const state = await page.evaluate(() => ({
            first: globalThis.t.first.tooltip.visible,
            second: globalThis.t.second.tooltip.visible,
            shown: globalThis.t.Tooltip.shown === globalThis.t.second.tooltip,
        }));

        expect(state).toEqual({ first: false, second: true, shown: true });
    });

    test('pressing hides the tooltip until the pointer comes back', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        const box = await page.locator('[data-name="first"]').boundingBox();
        await page.mouse.move(box.x + 20, box.y + 10);
        await page.waitForTimeout(350);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(150);
        await page.mouse.move(box.x + 25, box.y + 12);
        await page.waitForTimeout(350);

        expect(await page.evaluate(() => globalThis.t.first.tooltip.visible)).toBe(false);
    });

    test('a key press hides the tooltip', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.hover('[data-name="first"]');
        await page.waitForTimeout(350);
        await page.keyboard.press('Shift');

        expect(await page.evaluate(() => globalThis.t.first.tooltip.visible)).toBe(false);
    });

    test('custom content, placement below the widget and cleanup on destroy', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.evaluate(async () => {
            const { Image } = await import('/src/widgets/image.js');

            const tooltip = globalThis.t.second.tooltip;
            tooltip.content = new Image({ icon: 'dialog-information' });
            tooltip.placement = 'widget';
            tooltip.appearDelay = 0;
        });

        await page.hover('[data-name="second"]');

        const state = await page.evaluate(() => {
            const tooltip = globalThis.t.second.tooltip;
            const widget = globalThis.t.second.el.getBoundingClientRect();
            const rect = tooltip.el.getBoundingClientRect();

            return {
                visible: tooltip.visible,
                image: Boolean(tooltip.el.querySelector('.wy-image svg')),
                label: tooltip.el.querySelector('.wy-tooltip-label').hidden,
                below: Math.round(rect.top - widget.bottom),
                left: Math.round(rect.left - widget.left),
            };
        });

        expect(state).toEqual({ visible: true, image: true, label: true, below: 2, left: 0 });

        const cleanup = await page.evaluate(() => {
            const tooltip = globalThis.t.second.tooltip;
            globalThis.t.second.destroy();

            return {
                destroyed: tooltip.destroyed,
                connected: tooltip.el.isConnected,
                shown: globalThis.t.Tooltip.shown,
            };
        });

        expect(cleanup).toEqual({ destroyed: true, connected: false, shown: null });
    });

    test('clearing the label hides the tooltip and stops it', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.hover('[data-name="first"]');
        await page.waitForTimeout(350);
        await page.evaluate(() => {
            globalThis.t.first.tooltipLabel = null;
        });

        const state = await page.evaluate(() => ({
            visible: globalThis.t.first.tooltip.visible,
            label: globalThis.t.first.tooltipLabel,
            show: globalThis.t.first.showTooltip,
        }));

        expect(state).toEqual({ visible: false, label: '', show: false });
    });
});
