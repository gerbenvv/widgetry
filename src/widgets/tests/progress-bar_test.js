// Browser tests of ProgressBar.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a main window with a vertical box, available as `globalThis.box`.
async function openWindow(page) {
    const errors = await openHarness(page);

    await page.evaluate(async () => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');

        const window = new MainWindow();
        const box = new Box({
            orientation: 'vertical',
            spacing: 4,
            margin: 10,
            vAlign: 'start',
            hAlign: 'start',
        });
        window.addChild(box);
        window.show();

        globalThis.box = box;
    });

    return errors;
}

// Returns the filled range of a progress bar in pixels, relative to its inner edges.
async function measure(page) {
    return page.evaluate(async () => {
        const bar = globalThis.bar;
        const fill = bar.el.querySelector('.wy-progress-fill');

        // Skip the transition.
        fill.style.transition = 'none';
        void fill.offsetWidth;

        const outer = bar.el.getBoundingClientRect();
        const inner = fill.getBoundingClientRect();

        // The fill covers the 1 pixel border of the trough on every side.
        return {
            left: Math.round(inner.left - outer.left),
            right: Math.round(outer.right - inner.right),
            top: Math.round(inner.top - outer.top),
            bottom: Math.round(outer.bottom - inner.bottom),
            width: Math.round(outer.width - 2),
            height: Math.round(outer.height - 2),
            hidden: getComputedStyle(fill).visibility === 'hidden',
            now: bar.el.getAttribute('aria-valuenow'),
            text: bar.el.querySelector('.wy-progress-text').textContent,
        };
    });
}

test.describe('ProgressBar', () => {
    test('the bar fills up with the fraction', async ({ page }) => {
        const errors = await openWindow(page);

        await page.evaluate(async () => {
            const { ProgressBar } = await import('/src/widgets/progress-bar.js');
            globalThis.bar = globalThis.box.addChild(new ProgressBar({ width: 202 }));
        });

        let size = await measure(page);
        expect(size).toMatchObject({ width: 200, height: 18, hidden: true, now: '0', text: '' });

        await page.evaluate(() => (globalThis.bar.fraction = 0.25));
        size = await measure(page);
        expect(size).toMatchObject({ left: 0, right: 150, hidden: false, now: '25' });

        await page.evaluate(() => (globalThis.bar.fraction = 7));
        expect(await page.evaluate(() => globalThis.bar.fraction)).toBe(1);
        size = await measure(page);
        expect(size).toMatchObject({ left: 0, right: 0, now: '100' });

        await page.evaluate(() => {
            globalThis.bar.fraction = 0.25;
            globalThis.bar.inverted = true;
        });
        size = await measure(page);
        expect(size).toMatchObject({ left: 150, right: 0 });

        const role = await page.evaluate(() => [
            globalThis.bar.el.getAttribute('role'),
            globalThis.bar.el.getAttribute('aria-valuemin'),
            globalThis.bar.el.getAttribute('aria-valuemax'),
        ]);
        expect(role).toEqual(['progressbar', '0', '100']);
        expect(errors).toEqual([]);
    });

    test('vertical bars fill from the bottom, or from the top when inverted', async ({ page }) => {
        await openWindow(page);

        await page.evaluate(async () => {
            const { ProgressBar } = await import('/src/widgets/progress-bar.js');
            globalThis.bar = globalThis.box.addChild(
                new ProgressBar({
                    orientation: 'vertical',
                    fraction: 0.5,
                    height: 102,
                    vAlign: 'start',
                })
            );
        });

        let size = await measure(page);
        expect(size).toMatchObject({ top: 50, bottom: 0, width: 18, height: 100 });

        await page.evaluate(() => (globalThis.bar.inverted = true));
        size = await measure(page);
        expect(size).toMatchObject({ top: 0, bottom: 50 });
    });

    test('the text shows the percentage or the given text', async ({ page }) => {
        await openWindow(page);

        await page.evaluate(async () => {
            const { ProgressBar } = await import('/src/widgets/progress-bar.js');
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');

            getLocaleManager().locale = 'en-US';
            globalThis.bar = globalThis.box.addChild(new ProgressBar({ fraction: 0.42 }));
        });

        expect((await measure(page)).text).toBe('');

        await page.evaluate(() => (globalThis.bar.showText = true));
        expect((await measure(page)).text).toBe('42%');

        await page.evaluate(() => (globalThis.bar.text = 'Copying\nfiles'));
        const result = await measure(page);
        expect(result.text).toBe('Copying files');

        const valueText = await page.evaluate(() => [
            globalThis.bar.el.getAttribute('aria-valuetext'),
            globalThis.bar.el.querySelector('.wy-progress-text-filled').textContent,
        ]);
        expect(valueText).toEqual(['Copying files', 'Copying files']);
    });

    test('pulse() moves a bouncing block until the fraction is set', async ({ page }) => {
        await openWindow(page);

        await page.evaluate(async () => {
            const { ProgressBar } = await import('/src/widgets/progress-bar.js');
            globalThis.bar = globalThis.box.addChild(
                new ProgressBar({ width: 202, pulseStep: 0.5 })
            );
        });

        const lefts = [];
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => globalThis.bar.pulse());
            const size = await measure(page);
            lefts.push(size.left);

            expect(size.width - size.left - size.right).toBe(40);
            expect(size.now).toBeNull();
        }

        // The block moves by half the free space per pulse and bounces at the ends.
        expect(lefts).toEqual([0, 80, 160, 80, 0]);
        expect(await page.evaluate(() => globalThis.bar.isPulsing)).toBe(true);

        // Setting the fraction leaves activity mode, also when it does not change.
        await page.evaluate(() => (globalThis.bar.fraction = 0));
        const size = await measure(page);
        expect(size).toMatchObject({ hidden: true, now: '0' });
        expect(await page.evaluate(() => globalThis.bar.isPulsing)).toBe(false);
    });

    test('ellipsizing lets the bar shrink below its text', async ({ page }) => {
        await openWindow(page);

        const widths = await page.evaluate(async () => {
            const { ProgressBar } = await import('/src/widgets/progress-bar.js');
            const { Box } = await import('/src/widgets/box.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const text = 'A very long progress text that does not fit in the bar at all';
            const make = (ellipsize) => {
                const row = globalThis.box.addChild(new Box({ width: 160, hAlign: 'start' }));
                return row.addChild(
                    new ProgressBar({ showText: true, text, ellipsize, hExpand: true })
                );
            };

            const plain = make('none');
            const ellipsized = make('end');
            flushLayout();

            const textElement = ellipsized.el.querySelector('.wy-progress-text');

            return {
                plain: plain.allocation.width,
                ellipsized: ellipsized.allocation.width,
                overflow: getComputedStyle(textElement).textOverflow,
                clipped: textElement.scrollWidth > textElement.clientWidth,
            };
        });

        expect(widths.plain).toBeGreaterThan(300);
        expect(widths.ellipsized).toBe(160);
        expect(widths.overflow).toBe('ellipsis');
        expect(widths.clipped).toBe(true);
    });

    test('invalid values throw', async ({ page }) => {
        await openWindow(page);

        const errors = await page.evaluate(async () => {
            const { ProgressBar } = await import('/src/widgets/progress-bar.js');
            const bar = new ProgressBar();

            return [
                () => (bar.fraction = 'half'),
                () => (bar.pulseStep = 0),
                () => (bar.orientation = 'diagonal'),
                () => (bar.ellipsize = 'both'),
            ].map((attempt) => {
                try {
                    attempt();
                    return false;
                } catch (_error) {
                    return true;
                }
            });
        });

        expect(errors).toEqual([true, true, true, true]);
    });
});
