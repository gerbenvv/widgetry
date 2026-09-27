/**
 * @module data/filters/search-filter
 */
import { Filter } from './filter.js';
/**
 * Lower-cases text for the current locale. `toLocaleLowerCase()` is much slower than
 * `toLowerCase()`, so it is only used for the few languages whose lower case differs. Search
 * filters and the type-ahead search of tables use it.
 *
 * @param {string} text
 * @returns {string}
 */
export declare function toLowerCase(text: string): string;
/**
 * A filter for search fields: the query is split into keywords (at spaces and commas), and a row
 * passes when every keyword occurs in one of its columns. The search ignores case. An empty
 * query shows all rows.
 *
 * @example
 * const filter = new SearchFilter({ columns: ['name', 'category'] });
 * lineEdit.connect('text-change', () => (filter.query = lineEdit.text));
 */
export declare class SearchFilter extends Filter {
    /** @type {string[]} */
    _keywords: string[];
    _initialize(): void;
    /**
     * The keywords of the query, prepared for matching.
     *
     * @type {string[]}
     */
    get keywords(): string[];
    isVisibleRow(row: any): boolean;
    /**
     * Prepares a value (or the query) for matching: text with single spaces, in lower case and
     * optionally without accents.
     *
     * @protected
     * @param {unknown} value
     * @returns {string}
     */
    protected _prepareValue(value: unknown): string;
    _updateKeywords(): void;
}

/** The declared properties of {@link SearchFilter}. */
export interface SearchFilter {
    /**
     * The search text.
     */
    query: string;
    /**
     * The columns to search, or `null` for all columns of a row.
     */
    columns: any;
    /**
     * Whether accents are ignored, so the keyword `'cafe'` finds `'Café'`.
     */
    ignoreAccents: boolean;
}
