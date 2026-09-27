// Browser tests of the Fixed container.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('fixed', () => {
    test('children are placed at positions, and the container contains them', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Widget, flushLayout } = await import('/src/widgets/widget.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Box } = await import('/src/widgets/box.js');
            const { Fixed } = await import('/src/widgets/fixed.js');

            class Block extends Widget {
                _render() {
                    const element = document.createElement('div');
                    element.style.cssText = 'min-width: 40px; min-height: 20px; background: #ccc;';

                    return element;
                }
            }

            const host = document.createElement('div');
            host.style.cssText = 'width: 500px; height: 400px;';
            document.body.append(host);

            const window = new MainWindow({ host });
            const box = new Box({ hAlign: 'start', vAlign: 'start' });
            const fixed = new Fixed();
            const a = fixed.addChild(new Block(), 10, 20);
            const b = fixed.put(new Block({ width: 60, margin: 5 }), 100, 50);
            const c = fixed.addChild(new Block());
            box.addChild(fixed);
            window.addChild(box);
            window.show();
            flushLayout();

            const rect = (widget) => {
                const own = fixed.el.getBoundingClientRect();
                const r = widget.el.getBoundingClientRect();

                return [r.left - own.left, r.top - own.top, r.width, r.height];
            };

            const own = () => {
                const r = fixed.el.getBoundingClientRect();
                return [r.width, r.height];
            };

            const states = { a: rect(a), b: rect(b), c: rect(c), size: own() };

            fixed.move(a, 300, 200);
            flushLayout();
            states.moved = [rect(a), own(), fixed.getChildPosition(a)];

            fixed.removeChild(b);
            flushLayout();
            states.removed = [b.el.style.margin, own()];

            let error = '';
            try {
                fixed.move(b, 0, 0);
            } catch (e) {
                error = e.message;
            }
            states.error = error;

            return states;
        });

        expect(errors).toEqual([]);
        expect(result.a).toEqual([10, 20, 40, 20]);
        expect(result.b).toEqual([105, 55, 60, 20]);
        expect(result.c).toEqual([0, 0, 40, 20]);
        expect(result.size).toEqual([170, 80]);
        expect(result.moved).toEqual([[300, 200, 40, 20], [340, 220], { x: 300, y: 200 }]);
        expect(result.removed).toEqual(['5px', [340, 220]]);
        expect(result.error).toMatch(/not a child/);
    });

    test('the builder places children at their x and y', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Builder } = await import('/src/construction/builder.js');
            await import('/src/widgets/fixed.js');
            await import('/src/widgets/label.js');

            const builder = new Builder();
            const [fixed] = builder.build({
                type: 'fixed',
                children: [
                    { type: 'label', id: 'a', text: 'A', x: 12, y: 34 },
                    { type: 'label', id: 'b', text: 'B' },
                ],
            });

            return [
                fixed.getChildPosition(builder.getObjectById('a')),
                fixed.getChildPosition(builder.getObjectById('b')),
            ];
        });

        expect(result).toEqual([
            { x: 12, y: 34 },
            { x: 0, y: 0 },
        ]);
    });
});
