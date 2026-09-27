// Browser tests of drag and drop.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Builds a main window with a drag source on the left and a drop target on the right.
async function setUp(page) {
    await page.evaluate(async () => {
        const { Widget } = await import('/src/widgets/widget.js');
        const { Box } = await import('/src/widgets/box.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Events } = await import('/src/events/constants.js');
        await import('/src/events/drag-manager.js');

        class Block extends Widget {
            _render() {
                const element = document.createElement('div');
                element.style.cssText = 'width: 200px; height: 200px; background: #ccc;';

                return element;
            }
        }

        const window = new MainWindow();
        const box = new Box({ spacing: 100 });
        const source = new Block({
            draggable: true,
            events: Events.DRAG_START | Events.DRAG_END | Events.DRAG_DATA_REQUEST,
        });
        const target = new Block({
            droppable: true,
            events: Events.DRAG_ENTER | Events.DRAG_LEAVE | Events.DRAG_MOTION | Events.DRAG_DROP,
        });

        box.addChild(source);
        box.addChild(target);
        window.addChild(box);
        window.show();

        const log = [];
        globalThis.log = log;

        source.connect('drag-start-event', (_widget, event) => {
            log.push('start');
            event.context.addType('text/plain');
            event.context.icon = 'Dragging';

            return true;
        });
        source.connect('drag-data-request-event', (_widget, event) => {
            log.push(`request:${event.dataType}`);
            event.context.setData('text/plain', 'hello');
        });
        source.connect('drag-end-event', (_widget, event) => {
            log.push(`end:${event.context.accepted}:${event.context.canceled}`);
        });

        target.connect('drag-enter-event', () => log.push('enter'));
        target.connect('drag-leave-event', () => log.push('leave'));
        target.connect('drag-motion-event', () => {
            if (log.at(-1) !== 'motion') {
                log.push('motion');
            }
        });
        target.connect('drag-drop-event', (_widget, event) => {
            log.push(`drop:${event.context.getData('text/plain')}`);

            return true;
        });
    });
}

test.describe('drag and drop', () => {
    test('drags data from a source to a target', async ({ page }) => {
        const errors = await openHarness(page);
        await setUp(page);

        await page.mouse.move(100, 100);
        await page.mouse.down();
        await page.mouse.move(102, 101);

        // Not dragging yet below the threshold.
        expect(await page.evaluate(() => globalThis.log)).toEqual([]);

        await page.mouse.move(400, 100, { steps: 5 });
        expect(await page.locator('.wy-drag-icon').textContent()).toBe('Dragging');

        await page.mouse.up();

        expect(errors).toEqual([]);
        expect(await page.evaluate(() => globalThis.log)).toEqual([
            'start',
            'enter',
            'motion',
            'request:text/plain',
            'drop:hello',
            'end:true:false',
        ]);
        expect(await page.locator('.wy-drag-icon').count()).toBe(0);
    });

    test('escape cancels a drag and leaving the target sends drag-leave', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        await page.mouse.move(100, 100);
        await page.mouse.down();
        await page.mouse.move(400, 100, { steps: 5 });
        await page.mouse.move(100, 300, { steps: 3 });
        await page.keyboard.press('Escape');
        await page.mouse.up();

        expect(await page.evaluate(() => globalThis.log)).toEqual([
            'start',
            'enter',
            'motion',
            'leave',
            'end:false:true',
        ]);
    });
});
