/**
 * @module columns/text-column
 */

import { registerType } from '../core/registry.js';
import { DataColumn } from './data-column.js';

/**
 * A column that shows values as plain text.
 *
 * @example
 * table.addColumn(new TextColumn({ name: 'name', label: 'Name', expand: true }));
 */
export class TextColumn extends DataColumn {}

registerType('text-column', TextColumn);
