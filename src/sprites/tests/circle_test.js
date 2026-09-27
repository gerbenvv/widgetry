// Browser tests of circle sprites.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test('Circle is positioned by its center', async ({ page }) => {
    await openHarness(page);

    const result = await page.evaluate(async () => {
        const { Circle } = await import('/src/sprites/circle.js');

        const circle = new Circle({ position: { x: 50, y: 40 }, radius: 10 });
        const before = ['cx', 'cy', 'r', 'x'].map((x) => circle.el.getAttribute(x));

        circle.y = 45;
        circle.radius = 12;

        return { before, after: ['cx', 'cy', 'r'].map((x) => circle.el.getAttribute(x)) };
    });

    expect(result.before).toEqual(['50', '40', '10', null]);
    expect(result.after).toEqual(['50', '45', '12']);
});
