// Tests of popup placement.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { computePopupPosition } from '../popup.js';

const BOUNDS = { width: 800, height: 600 };

describe('computePopupPosition', () => {
    test('places a popup below its anchor, aligned at the start', () => {
        const position = computePopupPosition(
            { x: 100, y: 50, width: 80, height: 20 },
            { width: 150, height: 200 },
            { bounds: BOUNDS }
        );

        assert.deepEqual(position, { x: 100, y: 70, side: 'bottom' });
    });

    test('flips to the top when there is no room below', () => {
        const position = computePopupPosition(
            { x: 100, y: 500, width: 80, height: 20 },
            { width: 150, height: 200 },
            { bounds: BOUNDS }
        );

        assert.deepEqual(position, { x: 100, y: 300, side: 'top' });
    });

    test('flips submenus to the left and shifts them onto the screen', () => {
        const position = computePopupPosition(
            { x: 700, y: 550, width: 90, height: 20 },
            { width: 150, height: 100 },
            { side: 'right', bounds: BOUNDS }
        );

        assert.deepEqual(position, { x: 550, y: 500, side: 'left' });
    });

    test('aligns at the end or center', () => {
        const anchor = { x: 300, y: 100, width: 100, height: 20 };
        const size = { width: 50, height: 50 };

        assert.equal(computePopupPosition(anchor, size, { align: 'end', bounds: BOUNDS }).x, 350);
        assert.equal(
            computePopupPosition(anchor, size, { align: 'center', bounds: BOUNDS }).x,
            325
        );
    });
});
