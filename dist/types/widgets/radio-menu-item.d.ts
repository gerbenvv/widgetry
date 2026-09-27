/**
 * @module widgets/radio-menu-item
 */
import { ButtonGroup } from './button-group.js';
import { CheckMenuItem } from './check-menu-item.js';
/**
 * A menu item that is one of a group of choices, of which one is active. Put items in a group
 * by setting their `group` to the same `ButtonGroup`, or with `join()`. Activating an item makes it
 * the active one; activating the active item does not deactivate it.
 *
 * Signals: `activate` (`item`) when the user activates the item or `activate()` is called, also
 * when it already was active; `toggle` (`item`) and `active-change` on every change of `active`,
 * also from code.
 */
export declare class RadioMenuItem extends CheckMenuItem {
    _initialize(): void;
    _getRole(): string;
    /**
     * Joins another item to this item's group. The group is created on first use.
     *
     * @param {RadioMenuItem | import('./widget.js').Widget} button
     */
    join(button: RadioMenuItem | import('./widget.js').Widget): void;
    _toggleOnActivate(): void;
    destroy(): void;
}

/** The declared properties of {@link RadioMenuItem}. */
export interface RadioMenuItem {
    /**
     * The `ButtonGroup` of the item, or `null`. Items of the same group exclude each other.
     */
    group: ButtonGroup;
}
