// Browser tests of Button.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a main window with a horizontal box, available as `globalThis.box`.
async function openWindow(page) {
    const errors = await openHarness(page);

    await page.evaluate(async () => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');

        const window = new MainWindow();
        const box = new Box({ spacing: 4, margin: 10, vAlign: 'start', hAlign: 'start' });
        window.addChild(box);
        window.show();

        globalThis.testWindow = window;
        globalThis.box = box;
        globalThis.log = [];
    });

    return errors;
}

// Adds a button that logs its signals, available as `globalThis.button`.
async function addButton(page, properties) {
    return page.evaluate(async (properties) => {
        const { Button } = await import('/src/widgets/button.js');
        const { flushLayout } = await import('/src/widgets/widget.js');

        const button = globalThis.box.addChild(new Button(properties));
        button.connect('activate', () => globalThis.log.push('activate'));
        button.connect('clicked', () => globalThis.log.push('clicked'));
        globalThis.button = button;
        flushLayout();

        const r = button.el.getBoundingClientRect();

        return { x: r.left, y: r.top, width: r.width, height: r.height };
    }, properties);
}

const log = (page) => page.evaluate(() => globalThis.log.splice(0));

test.describe('Button', () => {
    test('a click activates, and releasing outside cancels', async ({ page }) => {
        const errors = await openWindow(page);
        const box = await addButton(page, { label: 'OK' });

        const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

        await page.mouse.move(center.x, center.y);
        await page.mouse.down();
        expect(await page.evaluate(() => globalThis.button.hasStyleClass('wy-pressed'))).toBe(true);
        await page.mouse.up();
        expect(await log(page)).toEqual(['activate', 'clicked']);

        // Leaving while pressed releases the look; releasing outside does not activate.
        await page.mouse.down();
        await page.mouse.move(center.x + 200, center.y, { steps: 3 });
        expect(await page.evaluate(() => globalThis.button.hasStyleClass('wy-pressed'))).toBe(
            false
        );
        await page.mouse.up();
        expect(await log(page)).toEqual([]);

        // The secondary button does nothing.
        await page.mouse.click(center.x, center.y, { button: 'right' });
        expect(await log(page)).toEqual([]);

        expect(errors).toEqual([]);
        expect(await page.evaluate(() => globalThis.button.hasFocus)).toBe(true);
    });

    test('Space and Enter activate the focused button', async ({ page }) => {
        await openWindow(page);
        await addButton(page, { label: 'OK' });
        await page.evaluate(() => globalThis.button.focus());

        await page.keyboard.down(' ');
        expect(await page.evaluate(() => globalThis.button.hasStyleClass('wy-pressed'))).toBe(true);
        expect(await log(page)).toEqual([]);
        await page.keyboard.up(' ');
        expect(await log(page)).toEqual(['activate', 'clicked']);

        await page.keyboard.press('Enter');
        await expect.poll(() => log(page)).toEqual(['activate', 'clicked']);
    });

    test('activate() emits activate, and the focus ring is inside the button', async ({ page }) => {
        await openWindow(page);
        await addButton(page, { label: 'OK' });

        await page.evaluate(() => globalThis.button.activate());
        expect(await log(page)).toEqual(['activate']);

        await page.keyboard.press('Tab');
        const outline = await page.evaluate(() => {
            const style = getComputedStyle(globalThis.button.el);

            return [style.outlineStyle, style.outlineOffset, globalThis.button.el.role];
        });
        expect(outline).toEqual(['dotted', '-3px', 'button']);
    });

    test('insensitive buttons cannot be clicked or focused', async ({ page }) => {
        await openWindow(page);
        const box = await addButton(page, { label: 'OK', sensitive: false });

        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);

        expect(await log(page)).toEqual([]);
        expect(await page.evaluate(() => globalThis.button.focus())).toBe(false);
    });

    test('label and icon create the child', async ({ page }) => {
        await openWindow(page);

        const result = await page.evaluate(async () => {
            const { Button } = await import('/src/widgets/button.js');
            const { Label } = await import('/src/widgets/label.js');
            const { Image } = await import('/src/widgets/image.js');
            const { Box } = await import('/src/widgets/box.js');

            const button = globalThis.box.addChild(new Button({ label: 'Open' }));
            const first = button.child;
            const steps = [first instanceof Label && first.text];

            button.label = 'Open file';
            steps.push(button.child === first && first.text);

            button.icon = 'document-open';
            const content = button.child;
            steps.push(
                content instanceof Box &&
                    content.children[0] instanceof Image &&
                    content.children[0].icon === 'document-open' &&
                    content.children[1].text
            );

            button.imagePosition = 'right';
            steps.push(button.child.children[1] instanceof Image);

            button.label = null;
            steps.push(button.child instanceof Image);

            // A given image is kept when the content changes.
            const image = new Image({ icon: 'edit-copy' });
            button.icon = image;
            button.label = 'Copy';
            button.icon = '';
            steps.push(!image.destroyed && image.parent === null && button.child.text);

            button.label = null;
            steps.push(button.child === null);

            // An explicit child is kept; `label` only changes a label child.
            button.child = new Label({ text: 'Own' });
            button.label = 'Changed';
            steps.push(button.child.text);

            button.child = new Image({ icon: 'edit-cut' });
            button.label = 'Ignored';
            steps.push(button.child instanceof Image && button.label);

            return steps;
        });

        expect(result).toEqual([
            'Open',
            'Open file',
            'Open file',
            true,
            true,
            'Copy',
            true,
            'Changed',
            null,
        ]);
    });

    test('an icon and a label are laid out in a row, centered', async ({ page }) => {
        await openWindow(page);
        await addButton(page, { label: 'Save', icon: 'document-save', width: 200 });

        const layout = await page.evaluate(() => {
            const button = globalThis.button;
            const [image, label] = button.child.children;
            const b = button.el.getBoundingClientRect();
            const i = image.el.getBoundingClientRect();
            const l = label.el.getBoundingClientRect();

            return {
                imageSize: [i.width, i.height],
                gap: l.left - i.right,
                leftSpace: Math.round(i.left - b.left),
                rightSpace: Math.round(b.right - l.right),
                height: b.height,
            };
        });

        expect(layout.imageSize).toEqual([16, 16]);
        expect(layout.gap).toBe(4);
        expect(Math.abs(layout.leftSpace - layout.rightSpace)).toBeLessThanOrEqual(1);
        expect(layout.height).toBeGreaterThanOrEqual(26);
    });

    test('use-underline gives the button a mnemonic', async ({ page }) => {
        await openWindow(page);
        await addButton(page, { label: '_Save', useUnderline: true });

        expect(await page.evaluate(() => globalThis.button.child.el.innerHTML)).toContain(
            '<u class="wy-mnemonic">S</u>'
        );

        await page.keyboard.press('Alt+s');
        await expect.poll(() => log(page)).toEqual(['activate', 'clicked']);
        expect(await page.evaluate(() => globalThis.button.hasFocus)).toBe(true);
    });

    test('Enter activates the default button unless the focus widget uses it', async ({ page }) => {
        await openWindow(page);

        await page.evaluate(async () => {
            const { Button } = await import('/src/widgets/button.js');
            const { Widget } = await import('/src/widgets/widget.js');
            const { defineProperties } = await import('/src/core/instance.js');

            // A focusable widget that ignores Enter, and one that handles it.
            class Field extends Widget {
                _render() {
                    const element = document.createElement('div');
                    element.style.cssText = 'width: 40px; height: 20px;';
                    element.addEventListener('keydown', (event) => {
                        if (this.name === 'handler' && event.key === 'Enter') {
                            event.preventDefault();
                        }
                    });

                    return element;
                }
            }

            defineProperties(Field, { canFocus: { value: true } });

            globalThis.plain = globalThis.box.addChild(new Field({ name: 'plain' }));
            globalThis.handler = globalThis.box.addChild(new Field({ name: 'handler' }));
            globalThis.other = globalThis.box.addChild(new Button({ label: 'Other' }));
            globalThis.other.connect('activate', () => globalThis.log.push('other'));

            const ok = globalThis.box.addChild(new Button({ label: 'OK', isDefault: true }));
            ok.connect('activate', () => globalThis.log.push('default'));
            globalThis.ok = ok;
        });

        expect(await page.evaluate(() => globalThis.ok.hasStyleClass('wy-default'))).toBe(true);

        await page.evaluate(() => globalThis.plain.focus());
        await page.keyboard.press('Enter');
        await expect.poll(() => log(page)).toEqual(['default']);

        await page.evaluate(() => globalThis.handler.focus());
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        expect(await log(page)).toEqual([]);

        await page.evaluate(() => globalThis.other.focus());
        await page.keyboard.press('Enter');
        await expect.poll(() => log(page)).toEqual(['other']);

        await page.evaluate(() => {
            globalThis.ok.isDefault = false;
            globalThis.plain.focus();
        });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        expect(await log(page)).toEqual([]);
    });

    test('relief none buttons are flat until hovered', async ({ page }) => {
        await openWindow(page);
        const box = await addButton(page, { label: 'Flat', relief: 'none' });

        const border = () =>
            page.evaluate(() => getComputedStyle(globalThis.button.el).borderTopColor);

        expect(await border()).toBe('rgba(0, 0, 0, 0)');

        await page.mouse.move(box.x + 5, box.y + 5);
        expect(await border()).not.toBe('rgba(0, 0, 0, 0)');

        const invalid = await page.evaluate(() => {
            try {
                globalThis.button.relief = 'half';
                return false;
            } catch (_error) {
                return true;
            }
        });
        expect(invalid).toBe(true);
    });

    test('hovering and pressing change the look', async ({ page }) => {
        await openWindow(page);
        const box = await addButton(page, { label: 'Look' });

        const background = () =>
            page.evaluate(() => getComputedStyle(globalThis.button.el).backgroundImage);
        const color = () =>
            page.evaluate(() => getComputedStyle(globalThis.button.el).backgroundColor);

        const normal = await background();
        await page.mouse.move(box.x + 5, box.y + 5);
        const hover = await background();
        await page.mouse.down();
        const pressed = [await background(), await color()];
        await page.mouse.up();

        expect(normal).toContain('linear-gradient');
        expect(hover).not.toBe(normal);
        expect(pressed[0]).toBe('none');
        expect(pressed[1]).toBe('rgb(211, 204, 192)');
    });

    test('the builder creates buttons with a child', async ({ page }) => {
        await openWindow(page);

        const result = await page.evaluate(async () => {
            await import('/src/widgets/button.js');
            await import('/src/widgets/label.js');
            const { Builder } = await import('/src/construction/builder.js');
            const { getType } = await import('/src/core/registry.js');

            const [button] = new Builder().build({
                type: 'button',
                'is-default': true,
                child: { type: 'label', text: 'Built' },
            });

            return [getType('button').cls === button.constructor, button.label, button.isDefault];
        });

        expect(result).toEqual([true, 'Built', true]);
    });
});
