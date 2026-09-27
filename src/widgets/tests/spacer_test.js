// Browser tests of Spacer.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('Spacer', () => {
    test('takes the extra space in the direction of its box', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Box } = await import('/src/widgets/box.js');
            const { Button } = await import('/src/widgets/button.js');
            const { Spacer } = await import('/src/widgets/spacer.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const host = document.createElement('div');
            host.style.cssText = 'width: 400px; height: 300px;';
            document.body.append(host);

            const window = new MainWindow({ host });
            const column = new Box({ orientation: 'vertical' });
            const row = column.addChild(new Box());
            const left = row.addChild(new Button({ label: 'Left' }));
            const spacer = row.addChild(new Spacer());
            const right = row.addChild(new Button({ label: 'Right' }));
            window.addChild(column);
            window.show();
            flushLayout();

            const hostLeft = host.getBoundingClientRect().left;
            const before = {
                spacer: [spacer.isHExpand, spacer.isVExpand],
                row: [row.isHExpand, row.isVExpand],
                rightEdge: right.allocation.x + right.allocation.width - hostLeft,
                spacerWidth: spacer.allocation.width,
                leftWidth: left.allocation.width,
            };

            row.orientation = 'vertical';
            flushLayout();

            return {
                before,
                after: [spacer.isHExpand, spacer.isVExpand, row.isVExpand],
                empty: new Spacer().isHExpand,
            };
        });

        expect(result.before.spacer).toEqual([true, false]);
        expect(result.before.row).toEqual([true, false]);
        expect(result.before.rightEdge).toBe(400);
        expect(result.before.spacerWidth).toBeGreaterThan(200);
        expect(result.after).toEqual([false, true, true]);
        expect(result.empty).toBe(true);
        expect(errors).toEqual([]);
    });
});
