/**
 * @module data/matrix
 */
export type Point = {
    x: number;
    y: number;
};
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
export declare class Matrix {
    /** @type {number} */
    m11: number;
    /** @type {number} */
    m21: number;
    /** @type {number} */
    m12: number;
    /** @type {number} */
    m22: number;
    /** @type {number} */
    m13: number;
    /** @type {number} */
    m23: number;
    /**
     * @param {number} [m11] Row 1, column 1 (horizontal scaling).
     * @param {number} [m21] Row 2, column 1 (vertical skewing).
     * @param {number} [m12] Row 1, column 2 (horizontal skewing).
     * @param {number} [m22] Row 2, column 2 (vertical scaling).
     * @param {number} [m13] Row 1, column 3 (horizontal translation).
     * @param {number} [m23] Row 2, column 3 (vertical translation).
     */
    constructor(m11?: number, m21?: number, m12?: number, m22?: number, m13?: number, m23?: number);
    /**
     * The identity matrix, which transforms nothing.
     *
     * @type {Matrix}
     */
    static get identity(): Matrix;
    /**
     * Returns the identity matrix, like the original toolkit.
     *
     * @returns {Matrix}
     */
    static getIdentity(): Matrix;
    /**
     * Creates a translation.
     *
     * @param {Point} vector
     * @returns {Matrix}
     */
    static fromTranslation(vector: Point): Matrix;
    /**
     * Creates a rotation.
     *
     * @param {number} angle In radians, clockwise on screen (where y points down).
     * @param {Point} [point] The point to rotate around. Defaults to the origin.
     * @returns {Matrix}
     */
    static fromRotation(angle: number, point?: Point): Matrix;
    /**
     * Creates a scaling.
     *
     * @param {number} sx The horizontal factor.
     * @param {number} [sy] The vertical factor. Defaults to `sx`.
     * @param {Point} [point] The point to scale around. Defaults to the origin.
     * @returns {Matrix}
     */
    static fromScaling(sx: number, sy?: number, point?: Point): Matrix;
    /**
     * Creates a skew.
     *
     * @param {number} angleX The horizontal skew angle in radians.
     * @param {number} [angleY] The vertical skew angle in radians.
     * @returns {Matrix}
     */
    static fromSkew(angleX: number, angleY?: number): Matrix;
    /**
     * Parses the SVG/CSS form `matrix(a, b, c, d, e, f)`.
     *
     * @param {string} text
     * @returns {Matrix}
     * @throws {Error} If the text is not a matrix.
     */
    static parse(text: string): Matrix;
    /**
     * The determinant. A matrix can be inverted when it is not zero.
     *
     * @type {number}
     */
    get determinant(): number;
    /**
     * Whether this is the identity matrix.
     *
     * @type {boolean}
     */
    get isIdentity(): boolean;
    /**
     * Rotates, after this transformation.
     *
     * @param {number} angle In radians.
     * @param {Point} [point] The point to rotate around.
     * @returns {Matrix}
     */
    rotate(angle: number, point?: Point): Matrix;
    /**
     * Translates, after this transformation.
     *
     * @param {Point | number} vector A vector, or the horizontal distance.
     * @param {number} [dy] The vertical distance, when `vector` is a number.
     * @returns {Matrix}
     */
    translate(vector: Point | number, dy?: number): Matrix;
    /**
     * Scales, after this transformation.
     *
     * @param {number} sx
     * @param {number} [sy] Defaults to `sx`.
     * @param {Point} [point] The point to scale around.
     * @returns {Matrix}
     */
    scale(sx: number, sy?: number, point?: Point): Matrix;
    /**
     * Skews, after this transformation.
     *
     * @param {number} angleX
     * @param {number} [angleY]
     * @returns {Matrix}
     */
    skew(angleX: number, angleY?: number): Matrix;
    /**
     * Combines this transformation with another one, which is applied after this one (the other
     * matrix is pre-multiplied).
     *
     * @param {Matrix} matrix
     * @returns {Matrix}
     */
    multiply(matrix: Matrix): Matrix;
    /**
     * Returns the inverse transformation.
     *
     * @returns {Matrix}
     * @throws {Error} If the matrix cannot be inverted.
     */
    invert(): Matrix;
    /**
     * Transforms a point.
     *
     * @param {Point} point
     * @returns {Point}
     */
    transform(point: Point): Point;
    /**
     * Whether another matrix is (almost) the same.
     *
     * @param {Matrix} matrix
     * @param {number} [tolerance]
     * @returns {boolean}
     */
    equals(matrix: Matrix, tolerance?: number): boolean;
    /**
     * Returns the SVG and CSS form, `matrix(m11, m21, m12, m22, m13, m23)`.
     *
     * @returns {string}
     */
    toString(): string;
}
