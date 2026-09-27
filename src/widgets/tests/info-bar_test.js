// Browser tests of InfoBar.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a main window with an info bar (`globalThis.bar`) above a line edit, and records its
// responses.
async function mount(page, properties = {}) {
    const errors = await openHarness(page);

    await page.evaluate(async (properties) => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');
        const { InfoBar } = await import('/src/widgets/info-bar.js');
        const { Label } = await import('/src/widgets/label.js');
        const { LineEdit } = await import('/src/widgets/line-edit.js');
        const { flushLayout } = await import('/src/widgets/widget.js');

        const window = new MainWindow();
        const box = new Box({ orientation: 'vertical', spacing: 6, margin: 10, vAlign: 'start' });
        const bar = new InfoBar(properties);
        const edit = new LineEdit();

        bar.addChild(new Label({ text: 'The document was changed on disk.' }));
        box.addChild(bar);
        box.addChild(edit);
        window.addChild(box);
        window.show();
        flushLayout();

        globalThis.bar = bar;
        globalThis.edit = edit;
        globalThis.responses = [];
        bar.connect('response', (_bar, response) => globalThis.responses.push(response));
    }, properties);

    return errors;
}

test.describe('InfoBar', () => {
    test('shows an icon, the content and the colors of its message type', async ({ page }) => {
        const errors = await mount(page);

        const read = () =>
            page.evaluate(() => {
                const bar = globalThis.bar;
                const frame = bar.el.querySelector('.wy-info-bar-frame');
                const style = getComputedStyle(frame);

                return {
                    role: bar.el.getAttribute('role'),
                    icon: bar.image.icon,
                    iconVisible: bar.image.isVisible,
                    background: style.backgroundImage,
                    border: style.borderTopColor,
                    text: bar.contentArea.children[0].text,
                    child: bar.child === bar.contentArea.children[0],
                    actions: bar.actionArea.visible,
                    close: bar.el.querySelector('.wy-info-bar-close').hidden,
                };
            });

        const info = await read();
        expect(info).toMatchObject({
            role: 'status',
            icon: 'dialog-information',
            iconVisible: true,
            text: 'The document was changed on disk.',
            child: true,
            actions: false,
            close: true,
        });

        const colors = { info: info.background };
        for (const [type, role, icon] of [
            ['warning', 'alert', 'dialog-warning'],
            ['error', 'alert', 'dialog-error'],
            ['question', 'status', 'dialog-question'],
            ['other', 'status', ''],
        ]) {
            await page.evaluate((type) => (globalThis.bar.messageType = type), type);
            const result = await read();

            expect(result.role).toBe(role);
            expect(result.icon).toBe(icon);
            expect(result.iconVisible).toBe(Boolean(icon));
            colors[type] = result.background;
        }

        // Every message type has its own colors, and the classic pale ones: yellow for warnings,
        // blue for information and red for errors.
        expect(new Set(Object.values(colors)).size).toBe(5);

        const channels = await page.evaluate(() => {
            const parse = (color) => color.match(/\d+/g).slice(0, 3).map(Number);
            const bar = globalThis.bar;
            const result = {};

            for (const type of ['info', 'warning', 'error']) {
                bar.messageType = type;
                const style = getComputedStyle(bar.el.querySelector('.wy-info-bar-frame'));
                const stops = style.backgroundImage.match(/rgb\([^)]*\)/g);
                result[type] = { top: parse(stops[0]), border: parse(style.borderTopColor) };
            }

            return result;
        });

        const [ir, ig, ib] = channels.info.top;
        expect(ib).toBeGreaterThan(ir);
        expect(ib).toBeGreaterThan(200);

        const [wr, wg, wb] = channels.warning.top;
        expect(Math.min(wr, wg)).toBeGreaterThan(wb + 20);

        const [er, eg, eb] = channels.error.top;
        expect(er).toBeGreaterThan(eg + 10);
        expect(er).toBeGreaterThan(eb + 10);

        // The border is darker than the background.
        for (const type of ['info', 'warning', 'error']) {
            const sum = (x) => x.reduce((a, b) => a + b, 0);
            expect(sum(channels[type].border)).toBeLessThan(sum(channels[type].top));
        }

        expect(ig).toBeGreaterThan(0);
        expect(errors).toEqual([]);

        const invalid = await page.evaluate(() => {
            try {
                globalThis.bar.messageType = 'fatal';
            } catch (error) {
                return error.name;
            }

            return null;
        });
        expect(invalid).toBe('TypeError');
    });

    test('buttons give responses, like a dialog', async ({ page }) => {
        const errors = await mount(page, { messageType: 'warning' });

        const labels = await page.evaluate(() => {
            const bar = globalThis.bar;

            bar.addButton('reload', '_Reload');
            bar.addButton('_Ignore', 'cancel');
            bar.addButtons(['help', 'Help me'], 'ok');

            return {
                labels: bar.actionArea.children.map((x) => x.label),
                visible: bar.actionArea.visible,
                cancel: bar.getButton('cancel').label,
            };
        });
        expect(labels).toEqual({
            labels: ['_Reload', '_Ignore', 'Help me', '_OK'],
            visible: true,
            cancel: '_Ignore',
        });

        await page.click('.wy-info-bar .wy-button:has-text("Reload")');
        await page.keyboard.press('Alt+i');

        // A mnemonic shows a short press before it activates the button.
        await page.waitForTimeout(250);
        expect(await page.evaluate(() => globalThis.responses)).toEqual(['reload', 'cancel']);

        const result = await page.evaluate(() => {
            const bar = globalThis.bar;
            let duplicate = null;

            try {
                bar.addButton('reload');
            } catch (error) {
                duplicate = error.message;
            }

            bar.setResponseSensitive('ok', false);
            const sensitive = bar.getButton('ok').sensitive;

            bar.removeButton('help');
            bar.removeButton('ok');
            bar.getButton('cancel').destroy();

            const remaining = bar.actionArea.children.map((x) => x.label);
            bar.removeButton('reload');

            return {
                duplicate,
                sensitive,
                remaining,
                visible: bar.actionArea.visible,
                gone: bar.getButton('reload'),
            };
        });

        expect(result).toEqual({
            duplicate: "The info bar already has a button for response 'reload'.",
            sensitive: false,
            remaining: ['_Reload'],
            visible: false,
            gone: null,
        });
        expect(errors).toEqual([]);
    });

    test('the close button gives the close response', async ({ page }) => {
        await mount(page, { messageType: 'error', showCloseButton: true });

        const close = page.locator('.wy-info-bar-close');
        await expect(close).toBeVisible();
        expect(await close.getAttribute('aria-label')).toBe('Close');

        await close.click();
        expect(await page.evaluate(() => globalThis.responses)).toEqual(['close']);

        await page.evaluate(() => (globalThis.bar.showCloseButton = false));
        await expect(close).toBeHidden();
    });

    test('revealed slides the bar closed and open again', async ({ page }) => {
        await mount(page, { showCloseButton: true });

        const read = () =>
            page.evaluate(() => {
                const bar = globalThis.bar;

                return {
                    revealed: bar.el.classList.contains('wy-revealed'),
                    collapsed: bar.el.classList.contains('wy-collapsed'),
                    display: getComputedStyle(bar.el).display,
                    height: Math.round(bar.el.getBoundingClientRect().height),
                    editTop: Math.round(globalThis.edit.el.getBoundingClientRect().top),
                    hidden: bar.el.getAttribute('aria-hidden'),
                    inert: bar.el.querySelector('.wy-info-bar-clip').inert,
                };
            });

        const open = await read();
        expect(open.height).toBeGreaterThan(30);
        expect(open).toMatchObject({ revealed: true, collapsed: false, hidden: null });

        await page.evaluate(() => (globalThis.bar.revealed = false));

        // The bar shrinks during the transition, and afterwards takes no room at all.
        const closing = await read();
        expect(closing.revealed).toBe(false);
        expect(closing.inert).toBe(true);

        await page.waitForFunction(() => globalThis.bar.el.classList.contains('wy-collapsed'));
        const closed = await read();
        expect(closed).toMatchObject({ display: 'none', height: 0, hidden: 'true' });
        expect(closed.editTop).toBe(open.editTop - open.height - 6);

        // Collapsed bars are not in the focus chain.
        const chain = await page.evaluate(() => globalThis.bar._getFocusChain().length);
        expect(chain).toBe(0);

        await page.evaluate(() => (globalThis.bar.revealed = true));
        await page.waitForTimeout(400);

        const reopened = await read();
        expect(reopened).toMatchObject({
            revealed: true,
            collapsed: false,
            height: open.height,
            editTop: open.editTop,
            inert: false,
        });
    });

    test('the transition is skipped when the user prefers reduced motion', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await mount(page);

        const result = await page.evaluate(() => {
            // Where the browser cannot emulate the preference (Firefox over WebDriver BiDi), apply
            // the rule of the stylesheet for it directly.
            if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
                const style = document.createElement('style');
                style.textContent = '.wy-widget { transition-duration: 0s !important; }';
                document.head.append(style);
            }

            const bar = globalThis.bar;
            bar.revealed = false;

            return {
                collapsed: bar.el.classList.contains('wy-collapsed'),
                duration: getComputedStyle(bar.el).transitionDuration,
            };
        });

        expect(result.collapsed).toBe(true);
        expect(result.duration.split(',').every((x) => parseFloat(x) === 0)).toBe(true);
    });

    test('hiding the bar moves the focus out of it', async ({ page }) => {
        await mount(page, { showCloseButton: true });

        const result = await page.evaluate(async () => {
            const bar = globalThis.bar;
            const button = bar.addButton('ok');
            button.focus();

            const before = button.hasFocus;
            bar.revealed = false;

            return { before, after: button.hasFocus, focus: bar.window.focusWidget === button };
        });

        expect(result).toEqual({ before: true, after: false, focus: false });
    });

    test('the builder creates info bars with buttons and content', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            await import('/src/widgets/info-bar.js');
            await import('/src/widgets/label.js');
            const { Builder } = await import('/src/construction/builder.js');

            const [bar] = new Builder().build({
                type: 'info-bar',
                messageType: 'question',
                showCloseButton: true,
                buttons: [['yes', '_Save'], 'no', { response: 'cancel', label: 'Not now' }],
                children: [{ type: 'label', text: 'Save the changes?' }],
            });

            return {
                type: bar.constructor.name,
                messageType: bar.messageType,
                labels: bar.actionArea.children.map((x) => x.label),
                text: bar.contentArea.children[0].text,
                close: bar.showCloseButton,
            };
        });

        expect(result).toEqual({
            type: 'InfoBar',
            messageType: 'question',
            labels: ['_Save', '_No', 'Not now'],
            text: 'Save the changes?',
            close: true,
        });
        expect(errors).toEqual([]);
    });
});
