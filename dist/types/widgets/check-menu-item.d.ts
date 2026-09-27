/**
 * @module widgets/check-menu-item
 */
import { MenuItem } from './menu-item.js';
/**
 * A menu item with a check mark, which activating toggles.
 *
 * Signals: `activate` (`item`) when the user activates the item (a click, Enter or Space, its
 * mnemonic or its accelerator) or `activate()` is called, after it toggled; `toggle` (`item`) and
 * `active-change` on every change of `active`, also from code.
 */
export declare class CheckMenuItem extends MenuItem {
    _initialize(): void;
    _getRole(): string;
    /**
     * Activates the item, as the user does: clears `inconsistent`, toggles `active` and emits
     * `activate`. Does nothing if it is insensitive.
     *
     * @returns {boolean} Whether the item was activated.
     */
    activate(): boolean;
    /**
     * Changes `active` for an activation. Radio items override this.
     *
     * @protected
     */
    protected _toggleOnActivate(): void;
    _updateCheckState(): void;
}

/** The declared properties of {@link CheckMenuItem}. */
export interface CheckMenuItem {
    /**
     * Whether the item is checked.
     */
    active: boolean;
    /**
     * Whether the check shows an "in between" state (a dash), e.g. for a setting that applies to
     * some of the selected objects only. Activating the item clears it.
     */
    inconsistent: boolean;
    /**
     * Whether the check is drawn as a radio dot.
     */
    drawAsRadio: boolean;
}
