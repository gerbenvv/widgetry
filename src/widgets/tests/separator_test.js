// Browser tests of Separator.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('Separator', () => {
    test('draws an etched line across its space with a thickness', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Box } = await import('/src/widgets/box.js');
            const { Label } = await import('/src/widgets/label.js');
            const { Separator } = await import('/src/widgets/separator.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const window = new MainWindow();
            const column = new Box({
                orientation: 'vertical',
                width: 300,
                hAlign: 'start',
                vAlign: 'start',
            });
            const horizontal = column.addChild(new Separator());
            const thick = column.addChild(new Separator({ thickness: 4 }));
            const row = column.addChild(new Box({ height: 50 }));
            row.addChild(new Label({ text: 'a' }));
            const vertical = row.addChild(new Separator({ orientation: 'vertical' }));
            row.addChild(new Label({ text: 'b' }));
            window.addChild(column);
            window.show();
            flushLayout();

            const invalid = [
                () => (horizontal.thickness = 0),
                () => (horizontal.orientation = 'x'),
            ].map((attempt) => {
                try {
                    attempt();
                    return false;
                } catch (_error) {
                    return true;
                }
            });

            return {
                horizontal: [horizontal.allocation.width, horizontal.allocation.height],
                thick: thick.allocation.height,
                vertical: [vertical.allocation.width, vertical.allocation.height],
                attributes: [
                    vertical.el.getAttribute('role'),
                    vertical.el.getAttribute('aria-orientation'),
                ],
                image: getComputedStyle(horizontal.el).backgroundImage,
                invalid,
            };
        });

        expect(result.horizontal).toEqual([300, 4]);
        expect(result.thick).toBe(6);
        expect(result.vertical).toEqual([4, 50]);
        expect(result.attributes).toEqual(['separator', 'vertical']);
        expect(result.image).toContain('linear-gradient');
        expect(result.invalid).toEqual([true, true]);
        expect(errors).toEqual([]);
    });
});
