// Browser tests of the shared sprite behavior: visibility, style classes, paint, transformation,
// events and hit-testing.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Creates a 300 by 200 canvas at the top left of the page, as globalThis.canvas.
async function createCanvas(page) {
    await page.evaluate(async () => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { VectorCanvas } = await import('/src/widgets/vector-canvas.js');

        const host = document.createElement('div');
        host.style.cssText = 'position: fixed; left: 0; top: 0; width: 300px; height: 200px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const canvas = new VectorCanvas();
        window.addChild(canvas);
        window.show();

        globalThis.canvas = canvas;
    });
}

test.describe('Sprite', () => {
    test('is visible when it and its canvas are', async ({ page }) => {
        await openHarness(page);
        await createCanvas(page);

        const result = await page.evaluate(async () => {
            const { RectangleSprite } = await import('/src/sprites/rectangle.js');
            const canvas = globalThis.canvas;
            const sprite = new RectangleSprite({ size: { width: 10, height: 10 } });
            const log = [];
            sprite.connect('is-visible-change', () => log.push(sprite.isVisible));
            sprite.connect('parent-change', () =>
                log.push(sprite.parent === canvas ? 'parent' : 'none')
            );

            const before = sprite.isVisible;
            canvas.addSprite(sprite);
            sprite.hide();
            const display = sprite.el.getAttribute('display');
            sprite.show();
            canvas.visible = false;
            canvas.visible = true;
            canvas.removeSprite(sprite);

            return { before, display, log, window: sprite.window, topLevel: sprite.isTopLevel };
        });

        expect(result.before).toBe(false);
        expect(result.display).toBe('none');
        expect(result.log).toEqual([true, 'parent', false, true, false, true, false, 'none']);
        expect(result.window).toBe(null);
        expect(result.topLevel).toBe(false);
    });

    test('has style classes, a name, a title and paint', async ({ page }) => {
        await openHarness(page);
        await createCanvas(page);

        const result = await page.evaluate(async () => {
            const { RectangleSprite } = await import('/src/sprites/rectangle.js');
            const { StrokeStyle } = await import('/src/sprites/sprite.js');

            const sprite = new RectangleSprite({
                name: 'bar',
                title: 'A bar',
                fill: '#5699d8',
                fillOpacity: 0.5,
                strokeWidth: 2,
                strokeStyle: StrokeStyle.DASHED,
                opacity: 0.8,
            });
            sprite.addStyleClass('highlight');
            globalThis.canvas.addSprite(sprite);

            const attributes = Object.fromEntries(
                [
                    'fill',
                    'fill-opacity',
                    'stroke',
                    'stroke-width',
                    'stroke-dasharray',
                    'opacity',
                    'data-name',
                ].map((x) => [x, sprite.el.getAttribute(x)])
            );

            const classes = [...sprite.el.classList];
            const has = sprite.hasStyleClass('highlight');
            sprite.removeStyleClass('highlight');

            sprite.strokeWidth = 0;
            const noStroke = sprite.el.getAttribute('stroke');

            let error = null;
            try {
                sprite.opacity = 2;
            } catch (e) {
                error = e.constructor.name;
            }

            // Stroke styles are strings; the old numbers are rejected.
            sprite.strokeStyle = 'dotted';
            const dotted = sprite.strokeStyle === StrokeStyle.DOTTED;

            let styleError = null;
            try {
                sprite.strokeStyle = 1;
            } catch (e) {
                styleError = e.constructor.name;
            }

            return {
                attributes,
                dotted,
                styleError,
                classes,
                has,
                after: sprite.hasStyleClass('highlight'),
                noStroke,
                title: sprite.el.querySelector('title').textContent,
                error,
            };
        });

        expect(result.attributes).toEqual({
            fill: '#5699d8',
            'fill-opacity': '0.5',
            stroke: 'currentColor',
            'stroke-width': '2',
            'stroke-dasharray': '8 4',
            opacity: '0.8',
            'data-name': 'bar',
        });
        expect(result.classes).toEqual(['wy-sprite-rectangle', 'wy-sprite', 'highlight']);
        expect(result.has).toBe(true);
        expect(result.after).toBe(false);
        expect(result.noStroke).toBe('none');
        expect(result.title).toBe('A bar');
        expect(result.error).toBe('RangeError');
        expect(result.dotted).toBe(true);
        expect(result.styleError).toBe('RangeError');
    });

    test('applies its transformation', async ({ page }) => {
        await openHarness(page);
        await createCanvas(page);

        const result = await page.evaluate(async () => {
            const { RectangleSprite } = await import('/src/sprites/rectangle.js');
            const { Matrix } = await import('/src/data/matrix.js');

            // Without a stroke, as browsers differ in whether bounding boxes include it.
            const sprite = new RectangleSprite({
                size: { width: 20, height: 10 },
                fill: 'red',
                strokeWidth: 0,
            });
            globalThis.canvas.addSprite(sprite);

            sprite.transformation = Matrix.identity.scale(2).translate(10, 20);
            const rect = sprite.el.getBoundingClientRect();
            const attribute = sprite.el.getAttribute('transform');

            sprite.transformation = Matrix.identity;

            return {
                attribute,
                rect: [rect.left, rect.top, rect.width, rect.height],
                cleared: sprite.el.hasAttribute('transform'),
            };
        });

        expect(result.attribute).toBe('matrix(2, 0, 0, 2, 10, 20)');
        expect(result.rect).toEqual([10, 20, 40, 20]);
        expect(result.cleared).toBe(false);
    });

    test('emits event signals for its event mask, hit-tested on the painted shape', async ({
        page,
    }) => {
        await openHarness(page);
        await createCanvas(page);

        await page.evaluate(async () => {
            const { RectangleSprite } = await import('/src/sprites/rectangle.js');
            const { CircleSprite } = await import('/src/sprites/circle.js');
            const { Events } = await import('/src/events/constants.js');

            const canvas = globalThis.canvas;
            const box = new RectangleSprite({
                position: { x: 10, y: 10 },
                size: { width: 100, height: 100 },
                fill: '#ccc',
                name: 'box',
            });
            const ring = new CircleSprite({
                position: { x: 200, y: 60 },
                radius: 40,
                strokeWidth: 6,
                name: 'ring',
            });
            canvas.addSprite(box);
            canvas.addSprite(ring);

            globalThis.log = [];
            for (const sprite of [box, ring]) {
                sprite.events =
                    Events.BUTTON_PRESS | Events.BUTTON_RELEASE | Events.ENTER | Events.LEAVE;
                for (const type of ['button-press', 'button-release', 'enter', 'leave']) {
                    sprite.connect(`${type}-event`, (source, event) => {
                        globalThis.log.push([
                            source.name,
                            type,
                            event.source === source,
                            event.count ?? null,
                        ]);
                    });
                }
            }
        });

        await page.mouse.move(50, 50);
        await page.mouse.down();
        await page.mouse.up();

        // The center of the ring has no fill, so it gets no events; its stroke does.
        await page.mouse.move(200, 60);
        await page.mouse.click(200, 60);
        await page.mouse.move(200, 22);
        await page.mouse.click(200, 22);

        expect(await page.evaluate(() => globalThis.log)).toEqual([
            ['box', 'enter', true, null],
            ['box', 'button-press', true, 1],
            ['box', 'button-release', true, 1],
            ['box', 'leave', true, null],
            ['ring', 'enter', true, null],
            ['ring', 'button-press', true, 1],
            ['ring', 'button-release', true, 1],
        ]);

        // Disabling the events stops the signals.
        await page.evaluate(async () => {
            const { Events } = await import('/src/events/constants.js');
            globalThis.canvas.getSprite(0).disableEvents(Events.BUTTON_PRESS);
            globalThis.log = [];
        });
        await page.mouse.click(50, 50);
        expect((await page.evaluate(() => globalThis.log)).map((x) => x[1])).not.toContain(
            'button-press'
        );
    });

    test('counts double presses, grabs the pointer for dragging and respects the canvas sensitivity', async ({
        page,
    }) => {
        await openHarness(page);
        await createCanvas(page);

        await page.evaluate(async () => {
            const { RectangleSprite } = await import('/src/sprites/rectangle.js');
            const { Events } = await import('/src/events/constants.js');

            const sprite = new RectangleSprite({
                position: { x: 10, y: 10 },
                size: { width: 40, height: 40 },
                fill: '#ccc',
            });
            globalThis.canvas.addSprite(sprite);
            globalThis.sprite = sprite;
            globalThis.counts = [];
            globalThis.moves = 0;

            sprite.events = Events.BUTTON_PRESS | Events.MOTION | Events.BUTTON_RELEASE;
            sprite.connect('button-press-event', (_sprite, event) =>
                globalThis.counts.push(event.count)
            );

            // Drag the sprite by its motion events.
            let start = null;
            sprite.connect('button-press-event', (_sprite, event) => {
                start = { x: event.x - sprite.x, y: event.y - sprite.y };
            });
            sprite.connect('motion-event', (_sprite, event) => {
                globalThis.moves += 1;
                if (start) {
                    sprite.position = { x: event.x - start.x, y: event.y - start.y };
                }
            });
            sprite.connect('button-release-event', () => {
                start = null;
            });
        });

        await page.mouse.dblclick(30, 30);
        expect(await page.evaluate(() => globalThis.counts)).toEqual([1, 2]);

        await page.mouse.move(30, 30);
        await page.mouse.down();
        await page.mouse.move(150, 120, { steps: 5 });
        await page.mouse.up();

        const position = await page.evaluate(() => globalThis.sprite.position);
        expect(position).toEqual({ x: 130, y: 100 });

        await page.evaluate(() => {
            globalThis.canvas.sensitive = false;
            globalThis.counts = [];
        });
        await page.mouse.click(150, 120);
        expect(await page.evaluate(() => globalThis.counts)).toEqual([]);
    });

    test('keeps the pointer grab when raised while dragging, also when released outside the canvas', async ({
        page,
    }) => {
        await openHarness(page);
        await createCanvas(page);

        await page.evaluate(async () => {
            const { RectangleSprite } = await import('/src/sprites/rectangle.js');
            const { Events, Modifiers } = await import('/src/events/constants.js');
            const canvas = globalThis.canvas;
            const log = [];

            const other = new RectangleSprite({
                position: { x: 100, y: 0 },
                size: { width: 50, height: 50 },
            });
            const sprite = new RectangleSprite({
                position: { x: 10, y: 10 },
                size: { width: 50, height: 50 },
                fill: 'red',
                events: Events.BUTTON_PRESS | Events.MOTION | Events.BUTTON_RELEASE,
            });

            canvas.addSprite(sprite);
            canvas.addSprite(other);

            // Raising the sprite on press moves its element, like a diagram editor does.
            sprite.connect('button-press-event', () => {
                canvas.raiseSprite(sprite);
                log.push('press');

                return true;
            });
            sprite.connect('motion-event', (_sprite, event) => {
                if (!event.hasModifier(Modifiers.PRIMARY_BUTTON)) {
                    log.push('hover');

                    return false;
                }

                log.push(event.x > 300 ? 'motion outside' : 'motion');

                return true;
            });
            sprite.connect('button-release-event', () => {
                log.push('release');

                return true;
            });

            globalThis.log = log;
        });

        await page.mouse.move(30, 30);
        await page.mouse.down();
        await page.mouse.move(200, 100, { steps: 3 });
        await page.mouse.move(600, 400, { steps: 3 });
        await page.mouse.up();

        // After the release, moving the pointer over the sprite's old place no longer drags it.
        await page.mouse.move(640, 420, { steps: 2 });

        const log = await page.evaluate(() => [
            ...new Set(globalThis.log.filter((x) => x !== 'hover')),
        ]);
        expect(log).toEqual(['press', 'motion', 'motion outside', 'release']);

        // Exactly one release, and no dragging motion after it.
        const events = await page.evaluate(() => globalThis.log);
        expect(events.filter((x) => x === 'release')).toHaveLength(1);
        expect(events.slice(events.indexOf('release') + 1).every((x) => x === 'hover')).toBe(true);
    });

    test('is removed from its canvas when destroyed', async ({ page }) => {
        await openHarness(page);
        await createCanvas(page);

        const result = await page.evaluate(async () => {
            const { PathSprite } = await import('/src/sprites/path.js');
            const sprite = globalThis.canvas.addSprite(new PathSprite({ path: 'M0 0L10 10' }));

            sprite.destroy();

            return {
                count: globalThis.canvas.spritesCount,
                inDocument: sprite.el.isConnected,
                parent: sprite.parent,
            };
        });

        expect(result).toEqual({ count: 0, inDocument: false, parent: null });
    });

    test('the shape classes are named after their builder types', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const w = await import('/src/index.js');

            return {
                names: ['rectangle', 'circle', 'path', 'label', 'image'].map((x) =>
                    w.getTypeName(w[`${x[0].toUpperCase()}${x.slice(1)}Sprite`])
                ),
                old: ['Rectangle', 'Circle', 'Path'].filter((x) => x in w),
            };
        });

        expect(result).toEqual({
            names: [
                'rectangle-sprite',
                'circle-sprite',
                'path-sprite',
                'label-sprite',
                'image-sprite',
            ],
            old: [],
        });
    });
});
