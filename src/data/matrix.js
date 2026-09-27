/**
 * @module data/matrix
 */

import { registerType } from '../core/registry.js';

/**
 * @typedef {{x: number, y: number}} Point
 */

/**
 * An immutable 2D affine transformation matrix:
 *
 * ```
 * | m11 m12 m13 |
 * | m21 m22 m23 |
 * |  0   0   1  |
 * ```
 *
 * Operations return new matrices. `a.multiply(b)` applies `a` first and then `b`, so
 * `Matrix.identity.translate({ x: 10, y: 0 }).rotate(angle)` translates and then rotates. The SVG
 * and CSS form is `matrix(m11, m21, m12, m22, m13, m23)`.
 */
export class Matrix {
    /**
     * @param {number} [m11] Row 1, column 1 (horizontal scaling).
     * @param {number} [m21] Row 2, column 1 (vertical skewing).
     * @param {number} [m12] Row 1, column 2 (horizontal skewing).
     * @param {number} [m22] Row 2, column 2 (vertical scaling).
     * @param {number} [m13] Row 1, column 3 (horizontal translation).
     * @param {number} [m23] Row 2, column 3 (vertical translation).
     */
    constructor(m11 = 1, m21 = 0, m12 = 0, m22 = 1, m13 = 0, m23 = 0) {
        const values = [m11, m21, m12, m22, m13, m23];
        if (!values.every((value) => typeof value === 'number' && Number.isFinite(value))) {
            throw new TypeError('Matrix values must be finite numbers.');
        }

        /** @type {number} */
        this.m11 = m11;
        /** @type {number} */
        this.m21 = m21;
        /** @type {number} */
        this.m12 = m12;
        /** @type {number} */
        this.m22 = m22;
        /** @type {number} */
        this.m13 = m13;
        /** @type {number} */
        this.m23 = m23;

        Object.freeze(this);
    }

    /**
     * The identity matrix, which transforms nothing.
     *
     * @type {Matrix}
     */
    static get identity() {
        return IDENTITY;
    }

    /**
     * Returns the identity matrix, like the original toolkit.
     *
     * @returns {Matrix}
     */
    static getIdentity() {
        return IDENTITY;
    }

    /**
     * Creates a translation.
     *
     * @param {Point} vector
     * @returns {Matrix}
     */
    static fromTranslation(vector) {
        return new Matrix(1, 0, 0, 1, vector.x, vector.y);
    }

    /**
     * Creates a rotation.
     *
     * @param {number} angle In radians, clockwise on screen (where y points down).
     * @param {Point} [point] The point to rotate around. Defaults to the origin.
     * @returns {Matrix}
     */
    static fromRotation(angle, point) {
        const x = point?.x || 0;
        const y = point?.y || 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        return new Matrix(cos, sin, -sin, cos, x - x * cos + y * sin, y - x * sin - y * cos);
    }

    /**
     * Creates a scaling.
     *
     * @param {number} sx The horizontal factor.
     * @param {number} [sy] The vertical factor. Defaults to `sx`.
     * @param {Point} [point] The point to scale around. Defaults to the origin.
     * @returns {Matrix}
     */
    static fromScaling(sx, sy = sx, point) {
        const x = point?.x || 0;
        const y = point?.y || 0;

        return new Matrix(sx, 0, 0, sy, x - x * sx, y - y * sy);
    }

    /**
     * Creates a skew.
     *
     * @param {number} angleX The horizontal skew angle in radians.
     * @param {number} [angleY] The vertical skew angle in radians.
     * @returns {Matrix}
     */
    static fromSkew(angleX, angleY = 0) {
        return new Matrix(1, Math.tan(angleY), Math.tan(angleX), 1, 0, 0);
    }

    /**
     * Parses the SVG/CSS form `matrix(a, b, c, d, e, f)`.
     *
     * @param {string} text
     * @returns {Matrix}
     * @throws {Error} If the text is not a matrix.
     */
    static parse(text) {
        const match = /^\s*matrix\(([^)]*)\)\s*$/.exec(text);
        const values = match
            ? match[1]
                  .split(/[\s,]+/)
                  .filter(Boolean)
                  .map(Number)
            : [];

        if (values.length !== 6) {
            throw new Error(`Invalid matrix '${text}'.`);
        }

        return new Matrix(...values);
    }

    /**
     * The determinant. A matrix can be inverted when it is not zero.
     *
     * @type {number}
     */
    get determinant() {
        return this.m11 * this.m22 - this.m12 * this.m21;
    }

    /**
     * Whether this is the identity matrix.
     *
     * @type {boolean}
     */
    get isIdentity() {
        return this.equals(IDENTITY);
    }

    /**
     * Rotates, after this transformation.
     *
     * @param {number} angle In radians.
     * @param {Point} [point] The point to rotate around.
     * @returns {Matrix}
     */
    rotate(angle, point) {
        return this.multiply(Matrix.fromRotation(angle, point));
    }

    /**
     * Translates, after this transformation.
     *
     * @param {Point | number} vector A vector, or the horizontal distance.
     * @param {number} [dy] The vertical distance, when `vector` is a number.
     * @returns {Matrix}
     */
    translate(vector, dy = 0) {
        const x = typeof vector === 'number' ? vector : vector.x;
        const y = typeof vector === 'number' ? dy : vector.y;

        return new Matrix(this.m11, this.m21, this.m12, this.m22, this.m13 + x, this.m23 + y);
    }

    /**
     * Scales, after this transformation.
     *
     * @param {number} sx
     * @param {number} [sy] Defaults to `sx`.
     * @param {Point} [point] The point to scale around.
     * @returns {Matrix}
     */
    scale(sx, sy = sx, point) {
        return this.multiply(Matrix.fromScaling(sx, sy, point));
    }

    /**
     * Skews, after this transformation.
     *
     * @param {number} angleX
     * @param {number} [angleY]
     * @returns {Matrix}
     */
    skew(angleX, angleY = 0) {
        return this.multiply(Matrix.fromSkew(angleX, angleY));
    }

    /**
     * Combines this transformation with another one, which is applied after this one (the other
     * matrix is pre-multiplied).
     *
     * @param {Matrix} matrix
     * @returns {Matrix}
     */
    multiply(matrix) {
        const a = matrix;
        const b = this;

        return new Matrix(
            a.m11 * b.m11 + a.m12 * b.m21,
            a.m21 * b.m11 + a.m22 * b.m21,
            a.m11 * b.m12 + a.m12 * b.m22,
            a.m21 * b.m12 + a.m22 * b.m22,
            a.m11 * b.m13 + a.m12 * b.m23 + a.m13,
            a.m21 * b.m13 + a.m22 * b.m23 + a.m23
        );
    }

    /**
     * Returns the inverse transformation.
     *
     * @returns {Matrix}
     * @throws {Error} If the matrix cannot be inverted.
     */
    invert() {
        const determinant = this.determinant;
        if (Math.abs(determinant) < 1e-12) {
            throw new Error('The matrix cannot be inverted.');
        }

        const { m11, m21, m12, m22, m13, m23 } = this;

        return new Matrix(
            m22 / determinant,
            -m21 / determinant,
            -m12 / determinant,
            m11 / determinant,
            (m12 * m23 - m22 * m13) / determinant,
            (m21 * m13 - m11 * m23) / determinant
        );
    }

    /**
     * Transforms a point.
     *
     * @param {Point} point
     * @returns {Point}
     */
    transform(point) {
        const { x, y } = point;

        return {
            x: x * this.m11 + y * this.m12 + this.m13,
            y: x * this.m21 + y * this.m22 + this.m23,
        };
    }

    /**
     * Whether another matrix is (almost) the same.
     *
     * @param {Matrix} matrix
     * @param {number} [tolerance]
     * @returns {boolean}
     */
    equals(matrix, tolerance = 1e-12) {
        return ['m11', 'm21', 'm12', 'm22', 'm13', 'm23'].every(
            (name) => Math.abs(this[name] - matrix[name]) <= tolerance
        );
    }

    /**
     * Returns the SVG and CSS form, `matrix(m11, m21, m12, m22, m13, m23)`.
     *
     * @returns {string}
     */
    toString() {
        return `matrix(${this.m11}, ${this.m21}, ${this.m12}, ${this.m22}, ${this.m13}, ${this.m23})`;
    }
}

/**
 * The identity matrix.
 *
 * @type {Matrix}
 */
const IDENTITY = new Matrix();

registerType(
    'matrix',
    Matrix,
    (properties) =>
        new Matrix(
            properties.m11 ?? 1,
            properties.m21 ?? 0,
            properties.m12 ?? 0,
            properties.m22 ?? 1,
            properties.m13 ?? 0,
            properties.m23 ?? 0
        )
);
