// Browser tests of the Dialog.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a main window, and a dialog for it with a line edit and Cancel and OK buttons.
async function setUp(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Label } = await import('/src/widgets/label.js');
        const { LineEdit } = await import('/src/widgets/line-edit.js');
        const { Dialog } = await import('/src/widgets/dialog.js');

        const main = new MainWindow();
        main.addChild(new Label({ text: 'Main' }));
        main.show();

        const dialog = new Dialog({ title: 'Question', transientFor: main, ...properties });
        dialog.contentArea.addChild(new Label({ text: 'Your name?' }));
        const entry = dialog.addChild(new LineEdit({ name: 'entry' }));
        dialog.addButton('cancel');
        dialog.addButton('ok', '_Save');

        globalThis.main = main;
        globalThis.dialog = dialog;
        globalThis.entry = entry;
        globalThis.responses = [];
        dialog.connect('response', (_dialog, response) => globalThis.responses.push(response));
    }, properties);
}

test.describe('dialog', () => {
    test('it has a content area above an action area with the buttons', async ({ page }) => {
        const errors = await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(() => {
            const dialog = globalThis.dialog;
            dialog.show();

            const content = dialog.contentArea.el.getBoundingClientRect();
            const actions = dialog.actionArea.el.getBoundingClientRect();
            const ok = dialog.getButton('ok');
            const cancel = dialog.getWidgetForResponse('cancel');

            return {
                // Allow for sub-pixel rounding, which differs between browsers.
                order: content.bottom <= actions.top + 0.5,
                labels: [cancel.el.textContent, ok.el.textContent],
                okAtEnd: Math.round(actions.right - ok.el.getBoundingClientRect().right),
                cancelLeftOfOk:
                    cancel.el.getBoundingClientRect().right <= ok.el.getBoundingClientRect().left,
                inContent: dialog.contentArea.children.includes(globalThis.entry),
                child: dialog.child === dialog.contentArea.children[0],
                resizable: dialog.resizable,
                maximizable: dialog.maximizable,
                role: dialog.el.getAttribute('role'),
                layoutStyle: dialog.actionArea.layoutStyle,
            };
        });

        expect(errors).toEqual([]);
        expect(result).toEqual({
            order: true,
            labels: ['Cancel', 'Save'],
            okAtEnd: 0,
            cancelLeftOfOk: true,
            inContent: true,
            child: true,
            resizable: false,
            maximizable: false,
            role: 'dialog',
            layoutStyle: 'end',
        });
    });

    test('buttons emit their response, and run() resolves with it', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        await page.evaluate(() => {
            globalThis.result = null;
            globalThis.dialog.run().then((response) => (globalThis.result = response));
        });

        expect(await page.evaluate(() => globalThis.dialog.modal)).toBe(true);
        await page.getByText('Save').click();

        await expect.poll(() => page.evaluate(() => globalThis.result)).toBe('ok');

        const state = await page.evaluate(() => ({
            responses: globalThis.responses,
            destroyed: globalThis.dialog.destroyed,
        }));
        expect(state).toEqual({ responses: ['ok'], destroyed: true });
    });

    test('Enter gives the default response and Escape the cancel response', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { defaultResponse: 'ok', destroyOnClose: false });

        await page.evaluate(() => globalThis.dialog.present());

        // The line edit has the focus; Enter in it activates the default button.
        await expect.poll(() => page.evaluate(() => globalThis.entry.hasFocus)).toBe(true);
        await page.keyboard.type('Ada');
        await page.keyboard.press('Enter');
        await expect.poll(() => page.evaluate(() => globalThis.responses)).toEqual(['ok']);

        await page.keyboard.press('Escape');
        expect(await page.evaluate(() => globalThis.responses)).toEqual(['ok', 'cancel']);

        // Without a cancel button, Escape closes the dialog, which is the response `none`.
        await page.evaluate(() => globalThis.dialog.removeButton('cancel'));
        expect(await page.evaluate(() => globalThis.dialog.getButton('cancel'))).toBeNull();

        await page.keyboard.press('Escape');
        const state = await page.evaluate(() => ({
            responses: globalThis.responses,
            visible: globalThis.dialog.visible,
            destroyed: globalThis.dialog.destroyed,
        }));

        expect(state).toEqual({
            responses: ['ok', 'cancel', 'none'],
            visible: false,
            destroyed: false,
        });
    });

    test('the default button gets the focus when the content does not take it', async ({
        page,
    }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Dialog } = await import('/src/widgets/dialog.js');
            const { Label } = await import('/src/widgets/label.js');

            const dialog = new Dialog({ title: 'Info' });
            dialog.contentArea.addChild(new Label({ text: 'Done.' }));
            dialog.addButton('help');
            dialog.addButton('close');
            dialog.addButton('ok');
            dialog.defaultResponse = 'ok';
            dialog.present();

            const ok = dialog.getButton('ok');
            const help = dialog.getButton('help');
            const states = {
                focus: dialog.focusWidget === ok,
                isDefault: ok.isDefault,
                helpSecondary: dialog.actionArea.getChildSecondary(help),
            };

            dialog.defaultResponse = 'close';
            states.moved = [ok.isDefault, dialog.getButton('close').isDefault];

            return states;
        });

        expect(result).toEqual({
            focus: true,
            isDefault: true,
            helpSecondary: true,
            moved: [false, true],
        });
    });

    test('closing with the title bar button gives the response none', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        await page.evaluate(() => {
            globalThis.result = null;
            globalThis.dialog.run().then((response) => (globalThis.result = response));
        });

        await page.locator('.wy-dialog .wy-window-close').click();

        await expect.poll(() => page.evaluate(() => globalThis.result)).toBe('none');
        expect(await page.evaluate(() => globalThis.responses)).toEqual(['none']);
        expect(await page.evaluate(() => globalThis.dialog.destroyed)).toBe(true);
    });

    test('a response handler may close the dialog itself', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(async () => {
            const dialog = globalThis.dialog;
            dialog.connect('response', () => dialog.close());

            const promise = dialog.run();
            dialog.getButton('cancel').activate();

            return [await promise, globalThis.responses, dialog.destroyed];
        });

        expect(result).toEqual(['cancel', ['cancel'], true]);
    });

    test('addButton accepts both argument orders and checks duplicates', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(async () => {
            const { Button } = await import('/src/widgets/button.js');
            const dialog = globalThis.dialog;

            const apply = dialog.addButton('_Apply now', 'apply');
            const custom = dialog.addButton('save-as', 'Save _as');
            const own = dialog.addButton('own', new Button({ label: 'Own' }));
            dialog.addButtons(['yes'], 'no');

            let error = '';
            try {
                dialog.addButton('ok');
            } catch (e) {
                error = e.message;
            }

            own.activate();
            dialog.setResponseSensitive('save-as', false);

            return {
                apply: [dialog.getButton('apply') === apply, apply.el.textContent],
                custom: custom.el.textContent,
                yes: dialog.getButton('yes').el.textContent,
                no: dialog.getButton('no').el.textContent,
                error,
                responses: globalThis.responses,
                sensitive: custom.sensitive,
            };
        });

        expect(result).toEqual({
            apply: [true, 'Apply now'],
            custom: 'Save as',
            yes: 'Yes',
            no: 'No',
            error: "The dialog already has a button for response 'ok'.",
            responses: ['own'],
            sensitive: false,
        });
    });

    test('a dialog is centered over its parent and destroyed with it', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Window } = await import('/src/widgets/window.js');
            const { Dialog } = await import('/src/widgets/dialog.js');
            const { Label } = await import('/src/widgets/label.js');

            const parent = new Window({ title: 'Parent', x: 100, y: 100, width: 600, height: 400 });
            parent.addChild(new Label({ text: 'Parent' }));
            parent.show();

            const dialog = new Dialog({
                title: 'Child',
                transientFor: parent,
                destroyWithParent: true,
            });
            dialog.addChild(new Label({ text: 'Centered' }));
            dialog.addButton('ok');
            dialog.show();

            const p = parent.el.getBoundingClientRect();
            const d = dialog.el.getBoundingClientRect();
            const centerX = Math.abs(p.left + p.width / 2 - (d.left + d.width / 2));

            parent.destroy();

            return { centerX, destroyed: dialog.destroyed };
        });

        expect(result.centerX).toBeLessThanOrEqual(1);
        expect(result.destroyed).toBe(true);
    });

    test('the builder adds buttons', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Builder } = await import('/src/construction/builder.js');
            await import('/src/widgets/dialog.js');
            await import('/src/widgets/label.js');
            await import('/src/widgets/button.js');

            const builder = new Builder();
            const [dialog] = builder.build({
                type: 'dialog',
                title: 'Built',
                defaultResponse: 'ok',
                child: { type: 'label', text: 'Content' },
                buttons: [
                    'cancel',
                    ['ok', '_Go'],
                    { response: 'help', label: 'Assistance' },
                    { response: 'custom', type: 'button', label: 'Custom' },
                ],
            });

            return {
                content: dialog.contentArea.children[0].text,
                labels: dialog.actionArea.children.map((x) => x.el.textContent),
                isDefault: dialog.getButton('ok').isDefault,
            };
        });

        expect(result).toEqual({
            content: 'Content',
            labels: ['Cancel', 'Go', 'Assistance', 'Custom'],
            isDefault: true,
        });
    });
});
