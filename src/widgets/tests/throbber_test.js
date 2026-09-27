// Browser tests of Throbber.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('Throbber', () => {
    test('spins while active and has a configurable size', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Box } = await import('/src/widgets/box.js');
            const { Throbber, Spinner } = await import('/src/widgets/throbber.js');
            const { getType } = await import('/src/core/registry.js');

            const window = new MainWindow();
            const box = new Box({ margin: 10, vAlign: 'start', hAlign: 'start' });
            window.addChild(box);
            window.show();

            const throbber = box.addChild(new Throbber());
            const state = () => [
                getComputedStyle(throbber.el).animationName,
                throbber.el.getAttribute('aria-busy'),
                throbber.el.getAttribute('aria-hidden'),
                throbber.allocation.width,
            ];

            const idle = state();
            throbber.start();
            const active = state();
            throbber.pixelSize = 16;
            const small = state();
            throbber.stop();
            const stopped = state();

            return {
                idle,
                active,
                small,
                stopped,
                alias: Spinner === Throbber && getType('spinner').cls === Throbber,
            };
        });

        expect(result.idle).toEqual(['none', 'false', 'true', 32]);
        expect(result.active).toEqual(['wy-throbber-spin', 'true', null, 32]);
        expect(result.small).toEqual(['wy-throbber-spin', 'true', null, 16]);
        expect(result.stopped).toEqual(['none', 'false', 'true', 16]);
        expect(result.alias).toBe(true);
        expect(errors).toEqual([]);
    });
});
