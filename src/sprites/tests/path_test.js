// Browser tests of path sprites.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test('Path draws path data and is translated by its position', async ({ page }) => {
    await openHarness(page);

    const result = await page.evaluate(async () => {
        const { Path } = await import('/src/sprites/path.js');
        const { Matrix } = await import('/src/data/matrix.js');

        const path = new Path({ path: 'M 0 0 L 10 10' });
        const initial = {
            d: path.el.getAttribute('d'),
            fill: path.el.getAttribute('fill'),
            transform: path.el.getAttribute('transform'),
        };

        path.position = { x: 5, y: 6 };
        const moved = path.el.getAttribute('transform');

        path.transformation = Matrix.fromScaling(2);
        const both = path.el.getAttribute('transform');

        path.path = null;

        return { initial, moved, both, cleared: path.el.hasAttribute('d') };
    });

    expect(result.initial).toEqual({ d: 'M 0 0 L 10 10', fill: 'none', transform: null });
    expect(result.moved).toBe('translate(5 6)');
    expect(result.both).toBe('translate(5 6) matrix(2, 0, 0, 2, 0, 0)');
    expect(result.cleared).toBe(false);
});
