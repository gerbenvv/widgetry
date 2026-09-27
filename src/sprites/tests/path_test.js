// Browser tests of path sprites.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test('PathSprite draws path data and is translated by its position', async ({ page }) => {
    await openHarness(page);

    const result = await page.evaluate(async () => {
        const { PathSprite } = await import('/src/sprites/path.js');
        const { Matrix } = await import('/src/data/matrix.js');

        const path = new PathSprite({ path: 'M 0 0 L 10 10' });
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
    // The transformation applies to the positioned path, like to the other sprites.
    expect(result.both).toBe('matrix(2, 0, 0, 2, 0, 0) translate(5 6)');
    expect(result.cleared).toBe(false);
});

test('PathSprite is transformed like the other sprites', async ({ page }) => {
    await openHarness(page);

    const result = await page.evaluate(async () => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { VectorCanvas } = await import('/src/widgets/vector-canvas.js');
        const { PathSprite } = await import('/src/sprites/path.js');
        const { RectangleSprite } = await import('/src/sprites/rectangle.js');
        const { Matrix } = await import('/src/data/matrix.js');

        const host = document.createElement('div');
        host.style.cssText = 'position: fixed; left: 0; top: 0; width: 300px; height: 200px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const canvas = new VectorCanvas();
        window.addChild(canvas);
        window.show();

        const transformation = Matrix.fromRotation(Math.PI / 2, { x: 30, y: 30 }).scale(2);
        const paint = { fill: 'red', strokeWidth: 0, position: { x: 20, y: 20 }, transformation };

        const path = canvas.addSprite(new PathSprite({ path: 'M 0 0 H 10 V 10 H 0 Z', ...paint }));
        const rectangle = canvas.addSprite(
            new RectangleSprite({ size: { width: 10, height: 10 }, ...paint })
        );

        const box = (sprite) => {
            const rect = sprite.el.getBoundingClientRect();

            return [rect.left, rect.top, rect.width, rect.height].map(Math.round);
        };

        return { path: box(path), rectangle: box(rectangle) };
    });

    expect(result.rectangle).toEqual([60, 40, 20, 20]);
    expect(result.path).toEqual(result.rectangle);
});
