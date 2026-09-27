/**
 * @module data/filters/search-filter
 */

import { defineProperties } from '../../core/instance.js';
import { registerType } from '../../core/registry.js';
import { getLocaleManager } from '../../i18n/locale-manager.js';
import { Filter } from './filter.js';

/**
 * Removes the accents (diacritics) from text, so `'é'` becomes `'e'`.
 *
 * @param {string} text
 * @returns {string}
 */
function removeAccents(text) {
    return text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * A filter for search fields: the query is split into keywords (at spaces and commas), and a row
 * passes when every keyword occurs in one of its columns. The search ignores case. An empty
 * query shows all rows.
 *
 * @example
 * const filter = new SearchFilter({ columns: ['name', 'category'] });
 * lineEdit.connect('text-change', () => (filter.query = lineEdit.text));
 */
export class SearchFilter extends Filter {
    _initialize() {
        super._initialize();

        /** @type {string[]} */
        this._keywords = [];
    }

    /**
     * The keywords of the query, prepared for matching.
     *
     * @type {string[]}
     */
    get keywords() {
        return [...this._keywords];
    }

    isVisibleRow(row) {
        const keywords = this._keywords;
        if (!keywords.length) {
            return true;
        }

        const columns = this._columns ?? Object.keys(row);
        const remaining = new Set(keywords);

        for (const column of columns) {
            if (!(column in row)) {
                continue;
            }

            const value = this._prepareValue(row[column]);

            for (const keyword of remaining) {
                if (value.includes(keyword)) {
                    remaining.delete(keyword);
                }
            }

            if (!remaining.size) {
                return true;
            }
        }

        return false;
    }

    /**
     * Prepares a value (or the query) for matching: text with single spaces, in lower case and
     * optionally without accents.
     *
     * @protected
     * @param {unknown} value
     * @returns {string}
     */
    _prepareValue(value) {
        const text = value === null || value === undefined ? '' : String(value);
        const lower = text.replace(/\s+/g, ' ').toLocaleLowerCase(getLocaleManager().locale);

        return this._ignoreAccents ? removeAccents(lower) : lower;
    }

    _updateKeywords() {
        const query = this._prepareValue(this._query)
            .replace(/[,\s]+/g, ' ')
            .trim();

        this._keywords = query ? [...new Set(query.split(' '))] : [];
    }
}

defineProperties(SearchFilter, {
    /**
     * The search text.
     */
    query: {
        value: '',
        coerce(query) {
            return query === null || query === undefined ? '' : String(query);
        },
        changed() {
            this._updateKeywords();
            this._changed();
        },
    },

    /**
     * The columns to search, or `null` for all columns of a row.
     */
    columns: {
        value: null,
        coerce(columns) {
            if (columns !== null && !Array.isArray(columns)) {
                throw new TypeError('Filter columns must be an array or null.');
            }

            return columns && [...columns];
        },
        changed() {
            this._changed();
        },
    },

    /**
     * Whether accents are ignored, so the keyword `'cafe'` finds `'Café'`.
     */
    ignoreAccents: {
        value: false,
        changed() {
            this._updateKeywords();
            this._changed();
        },
    },
});

registerType('search-filter', SearchFilter);
