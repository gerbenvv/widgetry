// Browser tests of Switch.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a main window with a switch (`globalThis.toggle`) and a line edit after it.
async function mount(page, properties = {}) {
    const errors = await openHarness(page);

    await page.evaluate(async (properties) => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');
        const { LineEdit } = await import('/src/widgets/line-edit.js');
        const { Switch } = await import('/src/widgets/switch.js');
        const { flushLayout } = await import('/src/widgets/widget.js');

        const window = new MainWindow();
        const box = new Box({ spacing: 8, margin: 20, vAlign: 'start', hAlign: 'start' });
        const toggle = new Switch(properties);

        box.addChild(toggle);
        box.addChild(new LineEdit());
        window.addChild(box);
        window.show();
        flushLayout();

        globalThis.toggle = toggle;
        globalThis.log = [];
        toggle.connect('active-change', () => globalThis.log.push(`active:${toggle.active}`));
        toggle.connect('activate', () => globalThis.log.push('activate'));
    }, properties);

    return errors;
}

// Returns the geometry of the switch and its slider.
function geometry(page) {
    return page.evaluate(() => {
        const rect = globalThis.toggle.el.getBoundingClientRect();
        const slider = globalThis.toggle.el
            .querySelector('.wy-switch-slider')
            .getBoundingClientRect();

        return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            centerY: rect.top + rect.height / 2,
            sliderLeft: Math.round(slider.left - rect.left),
            sliderWidth: Math.round(slider.width),
        };
    });
}

const state = (page) =>
    page.evaluate(() => [
        globalThis.toggle.active,
        globalThis.toggle.el.getAttribute('aria-checked'),
        globalThis.toggle.el.classList.contains('wy-active'),
    ]);

test.describe('Switch', () => {
    test('has the switch role, a natural size and the slider on the state side', async ({
        page,
    }) => {
        const errors = await mount(page);

        const off = await geometry(page);
        expect(off.width).toBe(50);
        expect(off.height).toBe(22);
        expect(off.sliderLeft).toBe(0);
        expect(await state(page)).toEqual([false, 'false', false]);

        const attributes = await page.evaluate(() => ({
            role: globalThis.toggle.el.getAttribute('role'),
            tabIndex: globalThis.toggle.el.tabIndex,
            type: globalThis.toggle.constructor.name,
        }));
        expect(attributes).toEqual({ role: 'switch', tabIndex: 0, type: 'Switch' });

        await page.evaluate(() => (globalThis.toggle.active = true));
        await page.waitForTimeout(250);

        const on = await geometry(page);
        expect(on.sliderLeft + on.sliderWidth).toBe(on.width);
        expect(await state(page)).toEqual([true, 'true', true]);

        // Setting the property from code does not emit activate.
        expect(await page.evaluate(() => globalThis.log)).toEqual(['active:true']);
        expect(errors).toEqual([]);
    });

    test('clicking toggles it and focuses it', async ({ page }) => {
        const errors = await mount(page);
        const box = await geometry(page);

        await page.mouse.click(box.left + 10, box.centerY);
        expect(await state(page)).toEqual([true, 'true', true]);

        await page.mouse.click(box.right - 10, box.centerY);
        expect(await state(page)).toEqual([false, 'false', false]);

        expect(await page.evaluate(() => globalThis.toggle.hasFocus)).toBe(true);
        expect(await page.evaluate(() => globalThis.log)).toEqual([
            'active:true',
            'activate',
            'active:false',
            'activate',
        ]);
        expect(errors).toEqual([]);
    });

    test('dragging the slider chooses the side it ends on', async ({ page }) => {
        await mount(page);
        const box = await geometry(page);

        // Drag from the slider at the left to the right end.
        await page.mouse.move(box.left + 8, box.centerY);
        await page.mouse.down();
        await page.mouse.move(box.left + 20, box.centerY, { steps: 3 });

        const dragging = await page.evaluate(() => ({
            dragging: globalThis.toggle.el.classList.contains('wy-dragging'),
            position: Number(globalThis.toggle.el.style.getPropertyValue('--wy-switch-position')),
            active: globalThis.toggle.active,
        }));
        expect(dragging.dragging).toBe(true);
        expect(dragging.position).toBeGreaterThan(0.3);
        expect(dragging.position).toBeLessThan(0.7);
        expect(dragging.active).toBe(false);

        await page.mouse.move(box.right + 30, box.centerY, { steps: 3 });
        await page.mouse.up();
        expect(await state(page)).toEqual([true, 'true', true]);

        // A drag that ends on the same side keeps the state, and does not count as a click.
        await page.mouse.move(box.right - 8, box.centerY);
        await page.mouse.down();
        await page.mouse.move(box.right - 14, box.centerY, { steps: 3 });
        await page.mouse.move(box.right + 10, box.centerY, { steps: 3 });
        await page.mouse.up();
        expect(await state(page)).toEqual([true, 'true', true]);

        // Dragging back past the middle turns it off.
        await page.mouse.move(box.right - 8, box.centerY);
        await page.mouse.down();
        await page.mouse.move(box.left - 20, box.centerY, { steps: 5 });
        await page.mouse.up();
        expect(await state(page)).toEqual([false, 'false', false]);

        const after = await page.evaluate(() => ({
            dragging: globalThis.toggle.el.classList.contains('wy-dragging'),
            inline: globalThis.toggle.el.style.getPropertyValue('--wy-switch-position'),
        }));
        expect(after).toEqual({ dragging: false, inline: '' });
    });

    test('Space and Enter toggle it, and Enter does not reach the default button', async ({
        page,
    }) => {
        await mount(page);

        const defaults = await page.evaluate(async () => {
            const { Button } = await import('/src/widgets/button.js');

            const button = new Button({ label: 'Default', isDefault: true });
            globalThis.toggle.parent.addChild(button);
            globalThis.defaults = 0;
            button.connect('activate', () => (globalThis.defaults += 1));

            globalThis.toggle.focus();

            return globalThis.toggle.hasFocus;
        });
        expect(defaults).toBe(true);

        await page.keyboard.press(' ');
        expect(await state(page)).toEqual([true, 'true', true]);

        await page.keyboard.press('Enter');
        expect(await state(page)).toEqual([false, 'false', false]);

        await page.waitForTimeout(150);
        expect(await page.evaluate(() => globalThis.defaults)).toBe(0);

        // Tab moves on to the next widget.
        await page.keyboard.press('Tab');
        expect(
            await page.evaluate(() => document.activeElement.classList.contains('wy-switch'))
        ).toBe(false);
    });

    test('a state-set handler that returns true vetoes the change', async ({ page }) => {
        await mount(page);

        const result = await page.evaluate(() => {
            const toggle = globalThis.toggle;
            const requests = [];
            let veto = true;

            toggle.connect('state-set', (_switch, state) => {
                requests.push(state);

                return veto;
            });

            const vetoed = toggle.activate();
            const afterVeto = [toggle.active, toggle.el.getAttribute('aria-checked')];

            // The handler confirms the state later, which does not emit state-set again.
            toggle.active = true;
            const confirmed = toggle.active;

            veto = false;
            const allowed = toggle.activate();

            return {
                requests,
                vetoed,
                afterVeto,
                confirmed,
                allowed,
                active: toggle.active,
                log: globalThis.log,
            };
        });

        expect(result).toEqual({
            requests: [true, false],
            vetoed: false,
            afterVeto: [false, 'false'],
            confirmed: true,
            allowed: true,
            active: false,
            log: ['active:true', 'active:false', 'activate'],
        });

        // A vetoed click leaves the slider where it was.
        await page.evaluate(() => globalThis.toggle.connect('state-set', () => true));
        const box = await geometry(page);
        await page.mouse.click(box.left + 10, box.centerY);

        expect(await state(page)).toEqual([false, 'false', false]);
        expect((await geometry(page)).sliderLeft).toBe(0);
    });

    test('an insensitive switch ignores clicks and keys', async ({ page }) => {
        await mount(page, { sensitive: false });
        const box = await geometry(page);

        await page.mouse.click(box.left + 10, box.centerY);

        const result = await page.evaluate(() => ({
            active: globalThis.toggle.active,
            activated: globalThis.toggle.activate(),
            classes: globalThis.toggle.el.className,
            disabled: globalThis.toggle.el.getAttribute('aria-disabled'),
            tabIndex: globalThis.toggle.el.tabIndex,
        }));

        expect(result.active).toBe(false);
        expect(result.activated).toBe(false);
        expect(result.classes).toContain('wy-insensitive');
        expect(result.disabled).toBe('true');
        expect(result.tabIndex).toBe(-1);
    });

    test('a label mnemonic toggles it, and the builder creates it', async ({ page }) => {
        const errors = await mount(page, { active: true });

        const result = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const { Builder } = await import('/src/construction/builder.js');

            const label = new Label({
                text: '_Wireless',
                useUnderline: true,
                mnemonicWidget: globalThis.toggle,
            });
            globalThis.toggle.parent.prependChild(label);

            const [built] = new Builder().build({ type: 'switch', active: true });

            return { built: built.constructor.name, active: built.active };
        });

        expect(result).toEqual({ built: 'Switch', active: true });

        await page.keyboard.press('Alt+w');
        expect(await state(page)).toEqual([false, 'false', false]);
        expect(await page.evaluate(() => globalThis.toggle.hasFocus)).toBe(true);
        expect(errors).toEqual([]);
    });
});
