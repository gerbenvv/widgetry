// Browser tests of the vector canvas: sprites, z-order, hit-testing, view box, pan and zoom.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

async function createCanvas(page) {
    await page.evaluate(async () => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { VectorCanvas } = await import('/src/widgets/vector-canvas.js');
        const { Rectangle } = await import('/src/sprites/rectangle.js');

        const host = document.createElement('div');
        host.style.cssText = 'position: fixed; left: 0; top: 0; width: 400px; height: 300px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const canvas = new VectorCanvas();
        window.addChild(canvas);
        window.show();

        const make = (name, x, fill) =>
            new Rectangle({ name, position: { x, y: 10 }, size: { width: 60, height: 60 }, fill });

        globalThis.canvas = canvas;
        globalThis.sprites = [make('a', 10, 'red'), make('b', 40, 'green'), make('c', 70, 'blue')];
        globalThis.sprites.forEach((x) => canvas.addSprite(x));
    });
}

function order(page) {
    return page.evaluate(() =>
        [...globalThis.canvas.svgElement.querySelectorAll('.wy-sprite')].map((x) => x.dataset.name)
    );
}

test.describe('VectorCanvas', () => {
    test('manages sprites', async ({ page }) => {
        const errors = await openHarness(page);
        await createCanvas(page);

        const result = await page.evaluate(async () => {
            const { Circle } = await import('/src/sprites/circle.js');
            const canvas = globalThis.canvas;
            const log = [];
            canvas.connect('sprite-add', (_canvas, sprite) => log.push(['add', sprite.name]));
            canvas.connect('sprite-remove', (_canvas, sprite) => log.push(['remove', sprite.name]));

            const circle = canvas.insertSprite(new Circle({ name: 'd' }), 1);
            const index = canvas.indexOfSprite(circle);
            const removed = canvas.removeSpriteByIndex(1).name;

            let error = null;
            try {
                canvas.addSprite(globalThis.sprites[0]);
            } catch (e) {
                error = e.message;
            }

            return {
                index,
                removed,
                count: canvas.spritesCount,
                first: canvas.getSprite(0).name,
                log,
                error,
            };
        });

        expect(errors).toEqual([]);
        expect(result).toEqual({
            index: 1,
            removed: 'd',
            count: 3,
            first: 'a',
            log: [
                ['add', 'd'],
                ['remove', 'd'],
            ],
            error: 'The sprite has already been added to a canvas.',
        });
    });

    test('draws sprites in z-order', async ({ page }) => {
        await openHarness(page);
        await createCanvas(page);

        expect(await order(page)).toEqual(['a', 'b', 'c']);

        await page.evaluate(() => globalThis.sprites[0].raise());
        expect(await order(page)).toEqual(['b', 'c', 'a']);

        await page.evaluate(() => globalThis.canvas.lowerSprite(globalThis.sprites[2]));
        expect(await order(page)).toEqual(['c', 'b', 'a']);

        await page.evaluate(() => (globalThis.sprites[1].zIndex = 5));
        expect(await order(page)).toEqual(['c', 'a', 'b']);

        // Raising stays below sprites with a higher z-index.
        await page.evaluate(() => globalThis.sprites[2].raise());
        expect(await order(page)).toEqual(['a', 'c', 'b']);
    });

    test('hit-tests the topmost sprite and converts points', async ({ page }) => {
        await openHarness(page);
        await createCanvas(page);

        const result = await page.evaluate(() => {
            const canvas = globalThis.canvas;
            const at = (x, y) => canvas.getSpriteAtPosition(x, y)?.name ?? null;

            const before = [at(20, 20), at(55, 20), at(90, 20), at(200, 200)];

            globalThis.sprites[2].hide();
            const hidden = at(90, 20);
            globalThis.sprites[2].show();

            canvas.viewBox = { x: 0, y: 0, width: 200, height: 150 };
            const point = canvas.getCanvasPoint(100, 100);
            const zoomedIn = at(40, 40);

            canvas.viewBox = null;
            canvas.zoom(2, { x: 0, y: 0 });
            canvas.pan(-20, 0);
            const transformed = {
                point: canvas.getCanvasPoint(100, 40),
                attribute: canvas.svgElement.querySelector('g').getAttribute('transform'),
            };

            return {
                before,
                hidden,
                point,
                zoomedIn,
                transformed,
                viewBox: canvas.svgElement.getAttribute('viewBox'),
            };
        });

        expect(result.before).toEqual(['a', 'b', 'c', null]);
        expect(result.hidden).toBe('b');
        expect(result.point).toEqual({ x: 50, y: 50 });
        expect(result.zoomedIn).toBe('a');
        expect(result.transformed.point).toEqual({ x: 60, y: 20 });
        expect(result.transformed.attribute).toBe('matrix(2, 0, 0, 2, -20, 0)');
        expect(result.viewBox).toBe(null);
    });

    test('updates the visibility of sprites and destroys them', async ({ page }) => {
        await openHarness(page);
        await createCanvas(page);

        const result = await page.evaluate(() => {
            const canvas = globalThis.canvas;
            const sprites = globalThis.sprites;

            canvas.hide();
            const hidden = sprites.map((x) => x.isVisible);
            canvas.show();
            const shown = sprites.map((x) => x.isVisible);

            canvas.removeAllSprites();
            const afterRemove = {
                count: canvas.spritesCount,
                destroyed: sprites.map((x) => x.destroyed),
            };

            return { hidden, shown, afterRemove };
        });

        expect(result.hidden).toEqual([false, false, false]);
        expect(result.shown).toEqual([true, true, true]);
        expect(result.afterRemove).toEqual({ count: 0, destroyed: [true, true, true] });
    });

    test('builds its sprites with the builder properties and has an accessible label', async ({
        page,
    }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { VectorCanvas } = await import('/src/widgets/vector-canvas.js');
            const { getType } = await import('/src/core/registry.js');
            await import('/src/sprites/circle.js');

            const builder = {
                build: (specs) =>
                    specs.map(({ type, ...properties }) => new (getType(type).cls)(properties)),
            };

            const canvas = new VectorCanvas({ label: 'A chart' });
            VectorCanvas.builderProperties.sprites(builder, canvas, [
                { type: 'circle-sprite', radius: 4 },
            ]);

            let error = null;
            try {
                VectorCanvas.builderProperties.sprites(builder, canvas, {});
            } catch (e) {
                error = e.message;
            }

            return {
                radius: canvas.getSprite(0).radius,
                error,
                label: canvas.svgElement.getAttribute('aria-label'),
                hidden: canvas.svgElement.getAttribute('aria-hidden'),
            };
        });

        expect(result).toEqual({
            radius: 4,
            error: 'Vector canvas sprites must be an array.',
            label: 'A chart',
            hidden: null,
        });
    });
});
