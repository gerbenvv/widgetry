// Tests of the 2D affine matrix.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Matrix } from '../matrix.js';

function assertPoint(actual, x, y) {
    assert.ok(
        Math.abs(actual.x - x) < 1e-9 && Math.abs(actual.y - y) < 1e-9,
        `(${actual.x}, ${actual.y})`
    );
}

describe('Matrix', () => {
    test('is immutable and validates its values', () => {
        const matrix = new Matrix();

        assert.equal(matrix.isIdentity, true);
        assert.equal(Matrix.getIdentity(), Matrix.identity);
        assert.throws(() => (matrix.m11 = 2), TypeError);
        assert.throws(() => new Matrix(1, 0, 0, 1, NaN, 0), TypeError);
    });

    test('applies operations in order', () => {
        const matrix = Matrix.identity.translate({ x: 10, y: 0 }).rotate(Math.PI / 2);

        // Translated first, then rotated around the origin.
        assertPoint(matrix.transform({ x: 0, y: 0 }), 0, 10);
        assertPoint(Matrix.identity.scale(2, 3).transform({ x: 1, y: 1 }), 2, 3);
        assertPoint(Matrix.identity.translate(5, 6).transform({ x: 1, y: 1 }), 6, 7);
    });

    test('rotates and scales around a point', () => {
        const point = { x: 5, y: 5 };

        assertPoint(Matrix.fromRotation(Math.PI, point).transform({ x: 6, y: 5 }), 4, 5);
        assertPoint(Matrix.fromScaling(2, 2, point).transform({ x: 6, y: 6 }), 7, 7);
        assertPoint(Matrix.fromScaling(2, 2, point).transform(point), 5, 5);
    });

    test('inverts', () => {
        const matrix = Matrix.fromRotation(0.7).scale(2, 0.5).translate(3, -4).skew(0.2);
        const point = matrix.transform({ x: 3, y: 9 });

        assertPoint(matrix.invert().transform(point), 3, 9);
        assert.ok(matrix.multiply(matrix.invert()).equals(Matrix.identity, 1e-9));
        assert.throws(() => new Matrix(0, 0, 0, 0, 0, 0).invert(), /cannot be inverted/);
    });

    test('converts to and from the SVG form', () => {
        const matrix = new Matrix(1, 2, 3, 4, 5, 6);

        assert.equal(String(matrix), 'matrix(1, 2, 3, 4, 5, 6)');
        assert.ok(Matrix.parse('matrix(1 2 3 4 5 6)').equals(matrix));
        assert.throws(() => Matrix.parse('scale(2)'), /Invalid matrix/);
        assert.equal(matrix.determinant, -2);
    });
});
