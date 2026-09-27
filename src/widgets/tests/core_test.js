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

        // moveFocus takes the strings of FocusDirection.
        const moves = await page.evaluate(async () => {
            const { FocusDirection } = await import('/src/core/enums.js');
            const window = globalThis.testWindow;
            const names = [];

            for (const direction of ['start', 'end', 'start', FocusDirection.FORWARD, 'backward']) {
                window.moveFocus(direction);
                names.push(window.focusWidget.name);
            }

            try {
                window.moveFocus(3);
            } catch (error) {
                names.push(error.name);
            }

            return names;
        });
        expect(moves).toEqual(['a', 'c', 'a', 'c', 'a', 'RangeError']);
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

    test('layout styles keep the widget own inline styles', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const box = new Box();
            const block = new globalThis.Block();
            block.el.style.marginTop = '7px';

            box.addChild(block);
            flushLayout();

            return block.el.style.marginTop;
        });

        expect(result).toBe('7px');
    });

    test('a removed child loses the layout styles of its old container', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const box = new Box();
            const block = new globalThis.Block({ hExpand: true, hAlign: 'center', margin: 3 });
            box.addChild(block);
            flushLayout();

            const before = [block.el.style.flex, block.el.style.marginLeft];

            box.removeChild(block);

            return {
                before,
                after: [block.el.style.flex, block.el.style.marginLeft, block.el.style.marginTop],
            };
        });

        // The box's flex and auto margins are gone; the widget's own margin is kept.
        expect(result.before).toEqual(['0 0 auto', 'auto']);
        expect(result.after).toEqual(['', '3px', '3px']);
    });

    test('homogeneous boxes set no margins of their own', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const box = new Box({ homogeneous: true });
            const plain = box.addChild(new globalThis.Block());
            const spaced = box.addChild(new globalThis.Block({ margin: 2 }));
            flushLayout();

            return [plain.el.style.margin, spaced.el.style.margin];
        });

        expect(result).toEqual(['', '2px']);
    });

    test('closing the active window activates the window below it', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Window } = await import('/src/widgets/window.js');
            const { Application } = await import('/src/core/application.js');

            const main = new MainWindow();
            const block = main.addChild(new globalThis.Block({ name: 'main-block' }));
            main.show();

            const other = new Window({ title: 'Other', x: 10, y: 10 });
            other.addChild(new globalThis.Block());
            other.show();

            const dialog = new Window({ title: 'Dialog', transientFor: other, modal: true });
            dialog.addChild(new globalThis.Block());
            dialog.show();

            const states = [Application.activeWindow === dialog];

            // The parent of the dialog gets the focus back.
            dialog.close();
            states.push(Application.activeWindow === other);

            // Then the topmost window that is left.
            other.hide();
            states.push(Application.activeWindow === main, block.hasFocus);

            return states;
        });

        expect(result).toEqual([true, true, true, true]);
    });

    test('a popover that took the focus gives it back to its owner', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Popover } = await import('/src/widgets/popover.js');

            const main = new MainWindow();
            const owner = main.addChild(new globalThis.Block({ name: 'owner' }));
            main.show();
            owner.focus();

            const popover = new Popover({ owner, takeFocus: true });
            const input = document.createElement('input');
            popover.contentElement.append(input);
            popover.popup();
            input.focus();

            const inside = document.activeElement === input;

            popover.popdown();
            await new Promise((resolve) => setTimeout(resolve));

            return [inside, document.activeElement === owner.el, owner.hasFocus];
        });

        expect(result).toEqual([true, true, true]);
    });

    test('reordering a child keeps the keyboard focus in it', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');

            const main = new MainWindow();
            const box = new Box();
            const first = box.addChild(new globalThis.Block({ name: 'first' }));
            box.addChild(new globalThis.Block({ name: 'second' }));
            main.addChild(box);
            main.show();
            first.focus();

            box.reorderChild(first, 1);
            await new Promise((resolve) => setTimeout(resolve));

            return [box.indexOf(first), document.activeElement === first.el, first.hasFocus];
        });

        expect(result).toEqual([1, true, true]);
    });

    test('pressing a title bar button keeps the focus widget', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        await page.evaluate(async () => {
            const { Window } = await import('/src/widgets/window.js');

            const window = new Window({ title: 'Window', x: 100, y: 100, width: 300 });
            globalThis.block = window.addChild(new globalThis.Block());
            window.show();
            globalThis.testWindow = window;
        });

        await page.click('.wy-window-maximize');

        const result = await page.evaluate(() => [
            globalThis.testWindow.maximized,
            document.activeElement === globalThis.block.el,
            globalThis.block.hasFocus,
        ]);

        expect(result).toEqual([true, true, true]);
    });

    test('a press is counted once, however many listeners count it', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { countPress } = await import('/src/widgets/widget.js');

            const init = { button: 0, clientX: 5, clientY: 5, bubbles: true };
            const first = new PointerEvent('pointerdown', init);
            const counts = [countPress(first), countPress(first)];

            // Like the double press of a title bar, 5 pixels away still counts.
            const second = new PointerEvent('pointerdown', { ...init, clientX: 10 });
            counts.push(countPress(second), countPress(second));

            return counts;
        });

        expect(result).toEqual([1, 1, 2, 2]);
    });

    test('resizing or moving a maximized window applies when it is restored', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { Window } = await import('/src/widgets/window.js');

            const window = new Window({ title: 'Window', x: 10, y: 10, width: 300, height: 200 });
            window.addChild(new globalThis.Block());
            window.show();

            window.maximized = true;
            window.resize(350, 250);
            window.move(40, 30);

            const maximized = window.el.getBoundingClientRect().width;

            window.maximized = false;
            const rect = window.el.getBoundingClientRect();

            return {
                maximized,
                restored: [rect.left, rect.top, rect.width, rect.height],
            };
        });

        expect(result.maximized).toBe(1280);
        expect(result.restored).toEqual([40, 30, 350, 250]);
    });

    test('blurring the focus widget keeps the keyboard focus in its window', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Box } = await import('/src/widgets/box.js');

            const window = new MainWindow();
            const box = new Box();
            globalThis.first = box.addChild(new globalThis.Block({ name: 'first' }));
            box.addChild(new globalThis.Block({ name: 'second' }));
            window.addChild(box);
            window.show();
            globalThis.first.focus();
            globalThis.first.blur();

            globalThis.testWindow = window;
        });

        const state = await page.evaluate(() => [
            globalThis.testWindow.focusWidget,
            document.activeElement === globalThis.testWindow.el,
            globalThis.testWindow.active,
        ]);
        expect(state).toEqual([null, true, true]);

        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => globalThis.testWindow.focusWidget?.name)).toBe('first');
    });

    test('a window shown above a modal window becomes active', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { Window } = await import('/src/widgets/window.js');
            const { Application } = await import('/src/core/application.js');

            const modal = new Window({ title: 'Modal', modal: true });
            modal.addChild(new globalThis.Block());
            modal.show();

            const child = new Window({ title: 'Child', transientFor: modal });
            child.addChild(new globalThis.Block());
            child.show();

            return {
                above: child.zIndex > modal.zIndex,
                active: Application.activeWindow === child,
                blinked: modal.el.classList.contains('wy-blink'),
            };
        });

        expect(result).toEqual({ above: true, active: true, blinked: false });
    });

    test('scrolling a nested popover keeps the outer popover open', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Popover } = await import('/src/widgets/popover.js');

            const main = new MainWindow();
            const owner = main.addChild(new globalThis.Block());
            main.show();

            const outer = new Popover({ owner });
            const inner = new Popover({ owner: (outer.child = new globalThis.Block()) });
            inner.contentElement.append(document.createElement('div'));

            outer.popup();
            inner.popup();

            inner.contentElement.firstChild.dispatchEvent(new Event('scroll'));
            const whileNested = [outer.isOpen, inner.isOpen];

            document.body.dispatchEvent(new Event('scroll'));

            return { whileNested, after: [outer.isOpen, inner.isOpen] };
        });

        expect(result).toEqual({ whileNested: [true, true], after: [false, false] });
    });

    test('reduced motion also stops transitions of pseudo-elements', async ({ page }) => {
        await openHarness(page);
        await page.emulateMedia({ reducedMotion: 'reduce' });

        const emulated = await page.evaluate(
            () => matchMedia('(prefers-reduced-motion: reduce)').matches
        );
        test.skip(!emulated, 'The browser does not emulate reduced motion.');

        const durations = await page.evaluate(() => {
            const style = document.createElement('style');
            style.textContent =
                '.probe::before, .probe::after { content: ""; transition: opacity 1s; }';
            document.head.append(style);

            const widget = document.createElement('div');
            widget.className = 'wy-widget probe';
            widget.innerHTML = '<span class="probe"></span>';
            document.body.append(widget);

            return [widget, widget.firstChild].flatMap((x) => [
                getComputedStyle(x, '::before').transitionDuration,
                getComputedStyle(x, '::after').transitionDuration,
            ]);
        });

        expect(durations).toEqual(['0s', '0s', '0s', '0s']);
    });

    test('a press whose release got lost does not block later presses', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { attachButtonBehavior } = await import('/src/widgets/button-behavior.js');
            const { attachPressRepeat } = await import('/src/widgets/auto-repeat.js');
            const { Box } = await import('/src/widgets/box.js');

            const main = new MainWindow();
            const box = main.addChild(new Box());
            const button = box.addChild(new globalThis.Block({ width: 100, height: 40 }));
            const stepper = box.addChild(new globalThis.Block({ width: 100, height: 40 }));
            main.show();

            globalThis.log = [];
            attachButtonBehavior(button, { onActivate: () => globalThis.log.push('activate') });
            attachPressRepeat(stepper.el, {
                onStep: (count) => {
                    if (count === 0) {
                        globalThis.log.push('step');
                    }
                },
            });

            globalThis.targets = [button.el, stepper.el];
            document.addEventListener('pointermove', (event) => {
                globalThis.mouseId = event.pointerId;
            });
        });

        // Presses of the mouse whose releases never arrive, e.g. because the element was moved.
        await page.mouse.move(300, 300);
        await page.evaluate(() => {
            for (const target of globalThis.targets) {
                const init = { pointerId: globalThis.mouseId, button: 0, bubbles: true };
                target.dispatchEvent(new PointerEvent('pointerdown', init));
            }
        });

        await page.mouse.click(50, 20);
        await page.mouse.click(150, 20);

        expect(await page.evaluate(() => globalThis.log)).toEqual(['step', 'activate', 'step']);
    });

    test('a modal window takes back a focus that moved below it', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Window } = await import('/src/widgets/window.js');
            const { Application } = await import('/src/core/application.js');

            const main = new MainWindow();
            const below = main.addChild(new globalThis.Block({ name: 'below' }));
            main.show();

            const modal = new Window({ title: 'Modal', modal: true });
            const inside = modal.addChild(new globalThis.Block({ name: 'inside' }));
            modal.show();

            // As when tabbing into the page from outside of it.
            below.el.focus();

            return [
                Application.activeWindow === modal,
                document.activeElement === inside.el,
                inside.hasFocus,
                below.hasFocus,
            ];
        });

        expect(result).toEqual([true, true, true, false]);
    });

    test('a layout that fails does not stop the other layouts', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const errors = [];
            window.addEventListener('error', (event) => {
                errors.push(event.error.message);
                event.preventDefault();
            });

            const { Box } = await import('/src/widgets/box.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            class BrokenBox extends Box {
                _updateLayout() {
                    throw new Error('Broken layout.');
                }
            }

            const broken = new BrokenBox();
            const box = new Box({ spacing: 7 });
            flushLayout();

            broken.spacing = 1;
            box.spacing = 8;
            flushLayout();

            return { gap: box.el.style.gap, errors };
        });

        // The broken box fails its first layout and the one after the change.
        expect(result).toEqual({ gap: '8px', errors: ['Broken layout.', 'Broken layout.'] });
    });

    test('hiding the main window gives the page its scrolling back', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');

            const window = new MainWindow();
            window.show();

            const shown = document.documentElement.classList.contains('wy-page');
            window.hide();

            return [shown, document.documentElement.classList.contains('wy-page')];
        });

        expect(result).toEqual([true, false]);
    });

    test('modal windows are marked modal for assistive technology', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Window } = await import('/src/widgets/window.js');

            const window = new Window({ title: 'Modal', modal: true });
            const states = [window.el.getAttribute('aria-modal')];

            window.modal = false;
            states.push(window.el.getAttribute('aria-modal'));

            return states;
        });

        expect(result).toEqual(['true', null]);
    });

    test('every widget has an accessible name on its focus element', async ({ page }) => {
        await openHarness(page);
        await defineTestWidget(page);

        const result = await page.evaluate(async () => {
            const { Button } = await import('/src/widgets/button.js');
            const { LineEdit } = await import('/src/widgets/line-edit.js');
            const { TextView } = await import('/src/widgets/text-view.js');
            const { ComboBox } = await import('/src/widgets/combo-box.js');
            const { Calendar } = await import('/src/widgets/calendar.js');

            const label = (element) => element.getAttribute('aria-label');

            const block = new window.Block({ accessibleName: 'Block' });
            const button = new Button({ icon: 'edit-copy', accessibleName: 'Copy' });
            const lineEdit = new LineEdit({ accessibleName: 'Search' });
            const textView = new TextView({ accessibleName: 'Notes' });
            const comboBox = new ComboBox({ hasEntry: true, accessibleName: 'Country' });
            const calendar = new Calendar({ accessibleName: 'Due date' });

            const changes = [];
            block.connect('accessible-name-change', () => changes.push(block.accessibleName));

            const names = {
                block: label(block.el),
                button: label(button.el),
                lineEdit: [label(lineEdit.focusElement), label(lineEdit.el)],
                textView: label(textView.focusElement),
                comboBox: [label(comboBox.focusElement), label(comboBox.el)],
                calendar: [
                    label(calendar.focusElement),
                    calendar.focusElement
                        .getAttribute('aria-labelledby')
                        .startsWith(calendar.focusElement.id),
                ],
            };

            block.accessibleName = null;
            calendar.accessibleName = '';

            return {
                names,
                changes,
                cleared: [
                    block.el.hasAttribute('aria-label'),
                    calendar.focusElement.getAttribute('aria-labelledby').split(' ').length,
                ],
            };
        });

        expect(result).toEqual({
            names: {
                block: 'Block',
                button: 'Copy',
                lineEdit: ['Search', null],
                textView: 'Notes',
                comboBox: ['Country', 'Country'],
                calendar: ['Due date', true],
            },
            changes: [''],
            cleared: [false, 2],
        });
    });
});
