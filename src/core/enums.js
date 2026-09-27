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
 * Sorting order of models and table columns. It is also the sort indicator of table column headers.
 *
 * @enum {string}
 */
export const SortOrder = Object.freeze({
    NONE: 'none', // Not sorted.
    ASCENDING: 'ascending', // Smallest first.
    DESCENDING: 'descending', // Largest first.
});

/**
 * How the rows of tables, list boxes and selections can be selected, as in GTK.
 *
 * @enum {string}
 */
export const SelectionMode = Object.freeze({
    NONE: 'none', // No row can be selected.
    SINGLE: 'single', // At most one row; Control+click deselects it.
    BROWSE: 'browse', // One row once there is a cursor, which the user cannot deselect.
    MULTIPLE: 'multiple', // Any number of rows, extended with Shift and Control.
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
 * @enum {string}
 */
export const FocusDirection = Object.freeze({
    START: 'start', // The first focusable widget.
    END: 'end', // The last focusable widget.
    FORWARD: 'forward', // The next focusable widget, like Tab.
    BACKWARD: 'backward', // The previous focusable widget, like Shift+Tab.
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
