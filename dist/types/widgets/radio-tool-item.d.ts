/**
 * @module widgets/radio-tool-item
 */
import { ButtonGroup } from './button-group.js';
import { CheckToolItem } from './check-tool-item.js';
/**
 * A tool item that is one of a group of choices, of which one is active (drawn pressed), like the
 * pages of a view. Put items in a group by setting their `group` to the same `ButtonGroup`, or
 * with `join()`. Activating the active item does not deactivate it.
 *
 * Signals: `activate`, `toggle`.
 */
export declare class RadioToolItem extends CheckToolItem {
    group: ButtonGroup;
    _initialize(): void;
    /**
     * Joins another item to this item's group. The group is created on first use.
     *
     * @param {RadioToolItem | import('./widget.js').Widget} button
     */
    join(button: RadioToolItem | import('./widget.js').Widget): void;
    destroy(): void;
    _getRole(): string;
    _toggleOnActivate(): void;
}

/** The declared properties of {@link RadioToolItem}. */
export interface RadioToolItem {

}
