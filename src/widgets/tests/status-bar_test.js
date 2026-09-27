// Browser tests of the StatusBar.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a status bar at the bottom of a vertical box of 300 by 200 pixels.
async function setUp(page) {
    await page.evaluate(async () => {
        const { flushLayout } = await import('/src/widgets/widget.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');
        const { Label } = await import('/src/widgets/label.js');
        const { StatusBar } = await import('/src/widgets/status-bar.js');

        const host = document.createElement('div');
        host.style.cssText = 'width: 300px; height: 200px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const box = new Box({ orientation: 'vertical' });
        box.addChild(new Label({ text: 'Content', vExpand: true }));
        const bar = new StatusBar();
        box.addChild(bar);
        window.addChild(box);
        window.show();
        flushLayout();

        globalThis.bar = bar;
        globalThis.Label = Label;
        globalThis.flush = flushLayout;
        globalThis.events = [];
        bar.connect('text-push', (_bar, context, text) =>
            globalThis.events.push(['push', context, text])
        );
        bar.connect('text-pop', (_bar, context, text) =>
            globalThis.events.push(['pop', context, text])
        );
    });
}

test.describe('status bar', () => {
    test('messages form a stack with sub-stacks per context', async ({ page }) => {
        const errors = await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(() => {
            const bar = globalThis.bar;
            const texts = [];

            const loading = bar.getContextId('loading');
            const saving = bar.getContextId('saving');
            texts.push([loading, saving, bar.getContextId('loading')]);

            bar.push(loading, 'Loading...');
            const saveId = bar.push(saving, 'Saving...');
            bar.push(loading, 'Still loading...');
            texts.push(bar.text);

            // Popping a context removes its most recent message, wherever it is.
            bar.pop(saving);
            texts.push(bar.text);

            bar.pop(loading);
            texts.push(bar.text);

            // Removing by message id, and all messages of a context.
            const id = bar.push(saving, 'Saving again');
            bar.push(0, 'Default');
            bar.remove(id);
            texts.push(bar.messages.map((x) => x.text));

            bar.removeAll(loading);
            texts.push(bar.text);

            bar.pop();
            texts.push(bar.text);

            let error = '';
            try {
                bar.push(99, 'Nope');
            } catch (e) {
                error = e.message;
            }

            return { texts, saveId, error, events: globalThis.events.length };
        });

        expect(errors).toEqual([]);
        expect(result.texts).toEqual([
            [1, 2, 1],
            'Still loading...',
            'Still loading...',
            'Loading...',
            ['Loading...', 'Default'],
            'Default',
            '',
        ]);
        expect(result.saveId).toBe(2);
        expect(result.error).toMatch(/Unknown status bar context id/);
        expect(result.events).toBe(8);
    });

    test('the original method names and argument order work', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(() => {
            const bar = globalThis.bar;
            const context = bar.getContextId('original');

            const first = bar.pushMessage('First', context);
            bar.pushMessage('Second', context);
            bar.pushMessage('Default');

            bar.removeMessage(context, first);
            const afterRemove = bar.messages.map((x) => x.text);

            bar.popMessage();
            const afterPop = bar.text;

            bar.removeAllMessages(context);

            return { afterRemove, afterPop, text: bar.text };
        });

        expect(result).toEqual({
            afterRemove: ['Second', 'Default'],
            afterPop: 'Second',
            text: '',
        });
    });

    test('the message is ellipsized, and extra widgets are packed at the end', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(() => {
            const bar = globalThis.bar;
            const version = bar.addChild(new globalThis.Label({ text: 'Viewer 2.0' }));
            bar.push(0, 'A very long message that certainly does not fit in the status bar');
            globalThis.flush();

            const label = bar.labelElement;
            const own = bar.el.getBoundingClientRect();
            const versionRect = version.el.getBoundingClientRect();

            return {
                ellipsis: getComputedStyle(label).textOverflow,
                overflows: label.scrollWidth > label.clientWidth,
                title: label.title,
                versionAtEnd: Math.round(own.right - versionRect.right),
                labelFirst: bar.el.firstElementChild === label,
                width: own.width,
                height: own.height,
                bottom: Math.round(own.bottom),
                role: bar.el.getAttribute('role'),
            };
        });

        expect(result.ellipsis).toBe('ellipsis');
        expect(result.overflows).toBe(true);
        expect(result.title).toMatch(/^A very long message/);
        expect(result.versionAtEnd).toBeLessThanOrEqual(4);
        expect(result.labelFirst).toBe(true);
        expect(result.width).toBe(300);
        expect(result.height).toBeGreaterThanOrEqual(22);
        expect(result.role).toBe('status');
    });

    test('the resize grip resizes the window', async ({ page }) => {
        await openHarness(page);

        await page.evaluate(async () => {
            const { Window } = await import('/src/widgets/window.js');
            const { Box } = await import('/src/widgets/box.js');
            const { Label } = await import('/src/widgets/label.js');
            const { StatusBar } = await import('/src/widgets/status-bar.js');

            const window = new Window({
                title: 'Grip',
                x: 50,
                y: 50,
                width: 300,
                height: 200,
                hasResizeGrip: false,
            });
            const box = new Box({ orientation: 'vertical' });
            box.addChild(new Label({ text: 'Content', vExpand: true }));
            const bar = new StatusBar({ hasResizeGrip: true });
            box.addChild(bar);
            window.addChild(box);
            window.show();

            globalThis.window_ = window;
            globalThis.bar = bar;
        });

        const grip = await page.locator('.wy-status-bar-grip').boundingBox();
        expect(grip.width).toBeGreaterThan(0);

        await page.mouse.move(grip.x + grip.width - 3, grip.y + grip.height - 3);
        await page.mouse.down();
        await page.mouse.move(grip.x + grip.width + 97, grip.y + grip.height + 47, { steps: 4 });
        await page.mouse.up();

        const size = await page.evaluate(() => {
            const r = globalThis.window_.el.getBoundingClientRect();

            return [Math.round(r.width), Math.round(r.height)];
        });

        expect(size).toEqual([400, 250]);
    });
});
