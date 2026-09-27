// Browser tests of `accessibleName` on widgets that also name themselves in other ways.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('accessibleName', () => {
    test('overrides the own names of images, tool items, main windows and canvases', async ({
        page,
    }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const w = await import('/src/index.js');

            const image = new w.Image({ icon: 'edit-copy', alternativeText: 'Copy' });
            const item = new w.ToolItem({ label: 'Save' });
            const canvas = new w.VectorCanvas();
            const main = new w.MainWindow({ title: 'Editor' });

            const names = (x) => [x.getAttribute('aria-label'), x.getAttribute('aria-hidden')];
            const svg = canvas.el.querySelector('svg');

            const before = [names(image.el), names(item.el), names(main.el), names(svg)];

            image.accessibleName = 'Copy the selection';
            item.accessibleName = 'Save the document';
            main.accessibleName = 'Text editor';
            canvas.label = 'A diagram';

            const set = [names(image.el), names(item.el), names(main.el), names(svg)];

            image.accessibleName = '';
            item.accessibleName = '';
            main.accessibleName = '';
            canvas.accessibleName = '';

            const cleared = [names(image.el), names(item.el), names(main.el), names(svg)];

            main.destroy();

            return { before, set, cleared, alias: canvas.label };
        });

        expect(result.before).toEqual([
            ['Copy', null],
            ['Save', null],
            ['Editor', null],
            [null, 'true'],
        ]);
        expect(result.set).toEqual([
            ['Copy the selection', null],
            ['Save the document', null],
            ['Text editor', null],
            ['A diagram', null],
        ]);
        expect(result.cleared).toEqual([
            ['Copy', null],
            ['Save', null],
            ['Editor', null],
            [null, 'true'],
        ]);
        expect(result.alias).toBe('');
    });

    test('sets aside and restores the aria-labelledby of windows', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Window } = await import('/src/widgets/window.js');

            const window = new Window({ title: 'Settings' });
            const labelledBy = window.el.getAttribute('aria-labelledby');

            window.accessibleName = 'Application settings';
            const named = [
                window.el.getAttribute('aria-label'),
                window.el.hasAttribute('aria-labelledby'),
            ];

            window.accessibleName = '';
            const restored = [
                window.el.getAttribute('aria-label'),
                window.el.getAttribute('aria-labelledby'),
            ];

            return { labelledBy, named, restored };
        });

        expect(result.labelledBy).toBeTruthy();
        expect(result.named).toEqual(['Application settings', false]);
        expect(result.restored).toEqual([null, result.labelledBy]);
    });
});
