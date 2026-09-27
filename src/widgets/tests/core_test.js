// Browser tests of the core widgets: Widget, Container, Box, MainWindow and Window.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Defines a minimal focusable widget in the page, for testing the core without other widgets.
async function defineTestWidget(page) {
    await page.evaluate(async () => {
        const { Widget } = await import('/src/widgets/widget.js');
        const { defineProperties } = await import('/src/core/instance.js');

        class Block extends Widget {
            _render() {
                const element = document.createElement('div');
                element.className = 'test-block';
                element.style.cssText = 'min-width: 40px; min-height: 20px; background: #ccc;';

                return element;
            }
        }

        defineProperties(Block, { canFocus: { value: true } });

        window.Block = Block;
    });
}

test.describe('core widgets', () => {
    test('properties emit change signals and set() applies late properties last', async ({
        page,
    }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');

            const box = new Box({ spacing: 4, visible: false, orientation: 'vertical' });

            const changes = [];
            box.connect('spacing-change', () => changes.push(box.spacing));

            box.spacing = 8;
            box.spacing = 8;
            box.setProperty('spacing', 10);

            return {
                changes,
                visible: box.visible,
                orientation: box.getProperty('orientation'),
                kebab: box.getProperty('orientation'),
                hasProperty: box.hasProperty('h-expand'),
            };
        });

        expect(result.changes).toEqual([8, 10]);
        expect(result.visible).toBe(false);
        expect(result.orientation).toBe('vertical');
        expect(result.hasProperty).toBe(true);
    });

    test('a box distributes extra space to expanding children', async ({ page }) => {
        const errors = await openHarness(page);
        await defineTestWidget(page);

        const widths = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const host = document.createElement('div');
            host.style.cssText = 'width: 400px; height: 100px;';
            document.body.append(host);

            const window = new MainWindow({ host });
            const box = new Box({ spacing: 10 });
            const fixed = new globalThis.Block({ width: 50 });
            const expanding = new globalThis.Block({ hExpand: true });
            const centered = new globalThis.Block({ hExpand: true, hAlign: 'center', width: 60 });

            box.addChild(fixed);
            box.addChild(expanding);
            box.addChild(centered);
            window.addChild(box);
            window.show();

            flushLayout();

            return {
                box: box.isHExpand,
                fixed: fixed.allocation.width,
                expanding: expanding.allocation.width,
                centered: centered.allocation.width,
                centeredX: centered.allocation.x - host.getBoundingClientRect().left,
            };
        });

        expect(errors).toEqual([]);
        expect(widths.box).toBe(true);
        expect(widths.fixed).toBe(50);
        expect(widths.centered).toBe(60);
        expect(widths.expanding).toBeGreaterThan(200);
    });

    test('homogeneous boxes give children equal sizes', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const widths = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const host = document.createElement('div');
            host.style.cssText = 'width: 300px; height: 50px;';
            document.body.append(host);

            const window = new MainWindow({ host });
            const box = new Box({ homogeneous: true });
            const children = [
                new globalThis.Block({ width: 20 }),
                new globalThis.Block({ width: 80 }),
                new globalThis.Block(),
            ];
            children.forEach((x) => box.addChild(x));
            window.addChild(box);
            window.show();

            flushLayout();

            return children.map((x) => Math.round(x.allocation.width));
        });

        expect(widths[0]).toBe(widths[2]);
        expect(widths[0]).toBeGreaterThanOrEqual(99);
    });

    test('visibility and sensitivity propagate to descendants', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');

            const window = new MainWindow();
            const outer = new Box();
            const inner = new Box();
            const block = new globalThis.Block();

            inner.addChild(block);
            outer.addChild(inner);
            window.addChild(outer);
            window.show();

            const states = [block.isVisible, block.isSensitive];

            outer.sensitive = false;
            states.push(block.isSensitive, block.el.classList.contains('wy-insensitive'));

            outer.sensitive = true;
            inner.visible = false;
            states.push(block.isVisible, block.visible);

            return states;
        });

        expect(result).toEqual([true, true, false, true, false, true]);
    });

    test('tab moves the focus through the window and wraps around', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');

            const window = new MainWindow();
            const box = new Box();
            window.blocks = ['a', 'b', 'c'].map((name) =>
                box.addChild(new globalThis.Block({ name }))
            );
            window.blocks[1].sensitive = false;
            window.addChild(box);
            window.show();

            globalThis.testWindow = window;
        });

        const focused = () => page.evaluate(() => globalThis.testWindow.focusWidget?.name ?? null);

        await expect.poll(focused).toBe('a');

        await page.keyboard.press('Tab');
        expect(await focused()).toBe('c');

        await page.keyboard.press('Tab');
        expect(await focused()).toBe('a');

        await page.keyboard.press('Shift+Tab');
        expect(await focused()).toBe('c');

        const hasFocus = await page.evaluate(() => globalThis.testWindow.blocks[2].hasFocus);
        expect(hasFocus).toBe(true);
    });

    test('windows remember their focus widget when activated again', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Window } = await import('/src/widgets/window.js');
            const { Application } = await import('/src/core/application.js');

            const main = new MainWindow();
            const box = new Box();
            const first = box.addChild(new globalThis.Block({ name: 'first' }));
            const second = box.addChild(new globalThis.Block({ name: 'second' }));
            main.addChild(box);
            main.show();
            second.focus();

            const dialog = new Window({ title: 'Dialog' });
            dialog.addChild(new globalThis.Block({ name: 'dialog-block' }));
            dialog.show();

            const whileDialog = [
                Application.activeWindow === dialog,
                second.isFocus,
                second.hasFocus,
            ];

            main.active = true;

            return {
                whileDialog,
                after: [Application.activeWindow === main, second.hasFocus, first.isFocus],
                dialogFocus: dialog.focusWidget?.name,
            };
        });

        expect(result.whileDialog).toEqual([true, true, false]);
        expect(result.after).toEqual([true, true, false]);
        expect(result.dialogFocus).toBe('dialog-block');
    });

    test('a window can be moved, resized, maximized and closed', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        await page.evaluate(async () => {
            const { Window } = await import('/src/widgets/window.js');

            const window = new Window({
                title: 'Test window',
                x: 100,
                y: 100,
                width: 300,
                height: 200,
            });
            window.addChild(new globalThis.Block());
            window.show();

            globalThis.testWindow = window;
        });

        const rect = () =>
            page.evaluate(() => {
                const r = globalThis.testWindow.el.getBoundingClientRect();

                return { x: r.left, y: r.top, width: r.width, height: r.height };
            });

        expect(await rect()).toEqual({ x: 100, y: 100, width: 300, height: 200 });

        // Move by dragging the title bar.
        await page.mouse.move(250, 110);
        await page.mouse.down();
        await page.mouse.move(300, 160, { steps: 4 });
        await page.mouse.up();

        expect(await rect()).toMatchObject({ x: 150, y: 150 });

        // Resize with the bottom-right grip.
        await page.mouse.move(150 + 300 - 4, 150 + 200 - 4);
        await page.mouse.down();
        await page.mouse.move(150 + 400 - 4, 150 + 260 - 4, { steps: 4 });
        await page.mouse.up();

        expect(await rect()).toMatchObject({ width: 400, height: 260 });

        // Maximize with a double click on the title bar, then restore.
        await page.mouse.dblclick(300, 160);
        expect(await rect()).toMatchObject({ x: 0, y: 0, width: 1280, height: 800 });

        await page.click('.wy-window-restore');
        expect(await rect()).toEqual({ x: 150, y: 150, width: 400, height: 260 });

        // Closing can be canceled, and destroys the window otherwise.
        const closed = await page.evaluate(() => {
            const window = globalThis.testWindow;
            const disconnect = window.connect('close-request', () => true);

            const first = window.close();
            disconnect();

            return [first, window.destroyed];
        });
        expect(closed).toEqual([false, false]);

        await page.click('.wy-window-close');
        expect(await page.evaluate(() => globalThis.testWindow.destroyed)).toBe(true);
    });

    test('a modal window blocks activating the windows below it', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { Window } = await import('/src/widgets/window.js');
            const { Application } = await import('/src/core/application.js');

            const below = new Window({ title: 'Below', x: 10, y: 10 });
            below.addChild(new globalThis.Block());
            below.show();

            const modal = new Window({ title: 'Modal', modal: true });
            modal.addChild(new globalThis.Block());
            modal.show();

            below.active = true;

            return {
                active: Application.activeWindow === modal,
                overlay: Boolean(document.querySelector('.wy-overlay')),
                above: modal.zIndex > below.zIndex,
            };
        });

        expect(result).toEqual({ active: true, overlay: true, above: true });
    });

    test('event masks emit toolkit event signals with a pointer grab', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Events, Modifiers } = await import('/src/events/constants.js');

            const window = new MainWindow();
            const block = new globalThis.Block({
                events: Events.BUTTON_PRESS | Events.MOTION | Events.BUTTON_RELEASE,
            });
            window.addChild(block);
            window.show();

            globalThis.received = [];
            block.connect('button-press-event', (_widget, event) => {
                globalThis.received.push(`press:${event.button}:${event.count}`);
            });
            block.connect('motion-event', (_widget, event) => {
                if (
                    event.hasModifier(Modifiers.PRIMARY_BUTTON) &&
                    !globalThis.received.includes('motion')
                ) {
                    globalThis.received.push('motion');
                }
            });
            block.connect('button-release-event', (_widget, event) => {
                globalThis.received.push(`release:${Math.round(event.x)}`);

                return true;
            });
        });

        await page.mouse.move(640, 400);
        await page.mouse.down();

        // Leave the page area of the widget; the grab keeps sending events to it.
        await page.mouse.move(1279, 799, { steps: 3 });
        await page.mouse.up();

        await page.mouse.dblclick(640, 400);

        const received = await page.evaluate(() => globalThis.received);
        expect(received.slice(0, 3)).toEqual(['press:1:1', 'motion', 'release:1279']);
        expect(received).toContain('press:1:2');
    });
});
