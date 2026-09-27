/**
 * Enumerations shared across widgets.
 *
 * @module core/enums
 */

/**
 * Orientation of boxes, separators, sliders and the like.
 *
 * @enum {string}
 */
export const Orientation = Object.freeze({
    HORIZONTAL: 'horizontal',
    VERTICAL: 'vertical',
});

/**
 * How a widget uses the space its parent allocates to it along one axis.
 *
 * @enum {string}
 */
export const Align = Object.freeze({
    FILL: 'fill', // Stretch to use all space.
    START: 'start', // Natural size, at the start (left or top).
    CENTER: 'center', // Natural size, centered.
    END: 'end', // Natural size, at the end (right or bottom).
});

/**
 * Alignment of text within its box.
 *
 * @enum {string}
 */
export const Justification = Object.freeze({
    START: 'start',
    END: 'end',
    CENTER: 'center',
    FILL: 'fill',
});

/**
 * How text that does not fit is shortened.
 *
 * @enum {string}
 */
export const EllipsizeMode = Object.freeze({
    NONE: 'none',
    START: 'start',
    MIDDLE: 'middle',
    END: 'end',
});

/**
 * Label text styles, as a bit mask.
 *
 * @enum {number}
 */
export const LabelStyles = Object.freeze({
    NORMAL: 0,
    BOLD: 1 << 1,
    ITALIC: 1 << 2,
    UNDERLINE: 1 << 3,
    STRIKETHROUGH: 1 << 4,
});

/**
 * Sorting order of models and table columns.
 *
 * @enum {number}
 */
export const SortOrder = Object.freeze({
    NONE: 0,
    ASCENDING: 1,
    DESCENDING: 2,
});

/**
 * Selection modes, as a bit mask.
 *
 * @enum {number}
 */
export const SelectionModes = Object.freeze({
    NONE: 0,
    SINGLE: 1 << 1, // At most one selected row.
    MULTI: 1 << 2, // Any number of rows, extended with shift and control.
    TOGGLE: 1 << 3, // Clicking a selected row deselects it.
    SINGLE_TOGGLE: (1 << 1) | (1 << 3),
    MULTI_TOGGLE: (1 << 2) | (1 << 3),
});

/**
 * Pointer cursor shapes.
 *
 * @enum {string}
 */
export const CursorShape = Object.freeze({
    ARROW: 'arrow',
    MOVE: 'move',
    CROSSHAIR: 'crosshair',
    WAIT: 'wait',
    BUSY: 'busy',
    TEXT: 'text',
    HELP: 'help',
    POINTING_HAND: 'pointing-hand',
    OPEN_HAND: 'open-hand',
    CLOSED_HAND: 'closed-hand',
    NO_DROP: 'no-drop',
    COPY: 'copy',
    ALIAS: 'alias',
    RESIZE_N: 'resize-n',
    RESIZE_NE: 'resize-ne',
    RESIZE_E: 'resize-e',
    RESIZE_SE: 'resize-se',
    RESIZE_S: 'resize-s',
    RESIZE_SW: 'resize-sw',
    RESIZE_W: 'resize-w',
    RESIZE_NW: 'resize-nw',
    RESIZE_H: 'resize-h',
    RESIZE_V: 'resize-v',
});

/**
 * Frame and scroll area border styles.
 *
 * @enum {string}
 */
export const ShadowType = Object.freeze({
    NONE: 'none',
    IN: 'in',
    OUT: 'out',
    ETCHED_IN: 'etched-in',
    ETCHED_OUT: 'etched-out',
});

/**
 * Scroll bar visibility policies.
 *
 * @enum {string}
 */
export const Policy = Object.freeze({
    ALWAYS: 'always',
    AUTOMATIC: 'automatic',
    NEVER: 'never',
});

/**
 * Button box layout styles.
 *
 * @enum {string}
 */
export const ButtonBoxStyle = Object.freeze({
    SPREAD: 'spread',
    EDGE: 'edge',
    START: 'start',
    END: 'end',
    CENTER: 'center',
});

/**
 * Directions in which keyboard focus can move.
 *
 * @enum {number}
 */
export const FocusDirection = Object.freeze({
    START: 1,
    END: 2,
    FORWARD: 3,
    BACKWARD: 4,
});

/**
 * Resize directions, as a bit mask.
 *
 * @enum {number}
 */
export const ResizeDirections = Object.freeze({
    NONE: 0,
    HORIZONTAL: 1 << 1,
    VERTICAL: 1 << 2,
    ALL: (1 << 1) | (1 << 2),
});

/**
 * Where something is placed relative to something else, e.g. notebook tabs or popups.
 *
 * @enum {string}
 */
export const Position = Object.freeze({
    TOP: 'top',
    RIGHT: 'right',
    BOTTOM: 'bottom',
    LEFT: 'left',
});

/**
 * Standard dialog responses.
 *
 * @enum {string}
 */
export const Response = Object.freeze({
    NONE: 'none',
    OK: 'ok',
    CANCEL: 'cancel',
    CLOSE: 'close',
    YES: 'yes',
    NO: 'no',
    APPLY: 'apply',
    HELP: 'help',
});

/**
 * Tool bar item display styles.
 *
 * @enum {string}
 */
export const ToolBarStyle = Object.freeze({
    ICONS: 'icons',
    TEXT: 'text',
    BOTH: 'both', // Icon above the text.
    BOTH_HORIZONTAL: 'both-horizontal', // Icon next to the text.
});
