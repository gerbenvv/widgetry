// Browser tests of rectangle sprites.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test('Rectangle has a position, a size and rounded corners', async ({ page }) => {
    await openHarness(page);

    const result = await page.evaluate(async () => {
        const { Rectangle } = await import('/src/sprites/rectangle.js');

        const rectangle = new Rectangle({
            position: { x: 5, y: 6 },
            size: { width: 30, height: 20 },
            cornerRadius: 3,
        });
        const attributes = () =>
            ['x', 'y', 'width', 'height', 'rx', 'ry'].map((x) => rectangle.el.getAttribute(x));

        const initial = attributes();

        rectangle.set({ x: 7, width: 40, height: 10 });
        const changed = attributes();

        let error = null;
        try {
            rectangle.width = -1;
        } catch (e) {
            error = e.constructor.name;
        }

        return { initial, changed, size: rectangle.size, tag: rectangle.el.tagName, error };
    });

    expect(result.initial).toEqual(['5', '6', '30', '20', '3', '3']);
    expect(result.changed).toEqual(['7', '6', '40', '10', '3', '3']);
    expect(result.size).toEqual({ width: 40, height: 10 });
    expect(result.tag).toBe('rect');
    expect(result.error).toBe('RangeError');
});
