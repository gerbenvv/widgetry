# Architecture

Widgetry is a desktop-style widget toolkit in the spirit of GTK. This document describes how it is
built, for contributors and for anyone writing their own widgets.

## Object model

Everything with properties and signals derives from `Instance` (`src/core/instance.js`).

- **Properties** are declared per class with `defineProperties(cls, specs)`, keyed by camelCase
  name. Each becomes a JavaScript accessor (`widget.hExpand = true`) backed by `this._<name>`,
  with its default on the prototype. Setting a property to a different value emits
  `<kebab-name>-change` (e.g. `h-expand-change`) with the instance as argument.
- A spec has `value` (the default; setting an equal value is a no-op), and optionally `changed`
  (called after the default setter stored the value), `set` (a full custom setter that stores the
  value itself and may return `false` for "no change"), `get`, `coerce`, `readOnly`, `late` (set
  last by `set()`, like `visible`) and `signal: false`. Subclasses may redeclare a property to
  override parts of it, such as its default.
- The constructor takes a property object: `new Button({ label: 'OK', hExpand: true })`. Names may
  be camelCase or kebab-case, which is what the declarative builder uses. `set(properties)` checks
  every name before it applies anything, so an unknown name changes nothing.
- **Construction** happens in `_initialize()`, never in a constructor, and subclasses must not use
  class fields. `Instance`'s constructor calls `_initialize()` (which must call
  `super._initialize()` first) and then applies the given properties, so setters always run on a
  fully built object.
- **Signals**: `connect(name, method, context)` returns a function that disconnects again.
  `emit(name, ...args)` returns whether a handler returned `true` ("handled"). A handler that is
  disconnected while a signal is being emitted (for example by an earlier handler) does not run in
  that emit. `block` and `unblock` nest.
- **Actions** are public methods; `doAction(name, args)` runs one by name.
- Singletons are created lazily (`getScreen()`, `getCursor()`, `getLocaleManager()`), except
  `Application`, which is exported as an instance.

## Widgets

A widget (`src/widgets/widget.js`) owns one root element, `el`, created by `_render()`. `_render()`
runs first during initialization, so it also stores references to sub-elements
(`this._inputEl = ...`). Root elements get the class `wy-widget`, and widget classes use `wy-`
prefixed class names (`wy-button`). State classes: `wy-insensitive`, `wy-focus`, `wy-pressed`,
`wy-active`, `wy-inactive`, `wy-horizontal`, `wy-vertical`.

- **Tree.** Containers (`Container`, `Bin` for one child) hold children. `addChild`,
  `insertChild`, `prependChild`, `removeChild`, `reorderChild`, `indexOf`, `forEach` and
  `findByName` manage them. `removeAllChildren()` destroys the children. `destroy()` removes a
  widget from its parent and destroys its descendants.
- **Visibility and sensitivity** (`visible`, `sensitive`) propagate: `isVisible` and
  `isSensitive` are true when the widget and all its ancestors are. Insensitive widgets are
  `inert`, so they get no input or focus.
- **Layout** follows GTK and is implemented with CSS. Every widget has a natural size (its CSS
  intrinsic size) and a minimum size (its min-content size). `hExpand`/`vExpand` make a widget take
  extra space; `null` (the default) inherits it from the children, so a container expands if one
  of its children does. `hAlign`/`vAlign` (`Align.FILL`, `START`, `CENTER`, `END`) position a
  widget in its space. `margin` (or `marginTop` and so on) adds space around it, and `width` and
  `height` request a size (a minimum when filling, the natural size otherwise). A box is a flex
  row or column (a grid of equal cells when `homogeneous`), and bins are one-cell grids.
  Containers update their children's CSS in `_updateLayout()`, which runs batched at the end of the
  task after `_queueLayout()`; `flushLayout()` runs pending layouts immediately. Layout styles are
  set with `child._setLayoutStyle(name, value)`, which only clears what it set itself, so a widget's
  own styles are kept.
- **Top-level widgets** are windows. `MainWindow` fills the page or a `host` element. `Window`
  floats in the screen layer (`getScreen().layer`), with a title bar, resizing, maximizing,
  modality and closing. Popups (menus, tooltips, combo box lists) also float in the screen layer
  and are placed with `placePopup()` from `src/core/popup.js`.

## Shared building blocks

- `Adjustment` (`src/data/adjustment.js`): a bounded value with step and page increments and a page
  size, for scroll bars, sliders, spin buttons and scroll areas. It emits `value-change` and, once
  per change or `set()`, `change`.

- `ButtonGroup` (`src/widgets/button-group.js`): at most one active member. Members have an
  `active` property (emitting `active-change`) and a `group` property whose setter keeps the group
  in sync:

  ```js
  group: {
      value: null,
      set(group) {
          const old = this._group;
          this._group = group;

          if (old && old.buttons.includes(this)) {
              old.removeButton(this);
          }

          if (group && !group.buttons.includes(this)) {
              group.addButton(this);
          }
      },
  },
  ```

  A radio member does not deactivate itself when clicked while active.

  All toggling widgets (toggle buttons, check boxes, radio buttons, check and radio menu and tool
  items, switches) share GTK's signal model: `activate` is emitted when the user activates the
  widget (a click, Space or Enter, or a mnemonic) and by `activate()`, which does the same as the
  user (it toggles a check-style widget and makes a radio-style one active), while `toggle` and
  `active-change` are emitted on every change of `active`, also from code.

- Icons (`src/icons/icons.js`): monochrome SVG icons with freedesktop names (`document-open`,
  `edit-copy`, `go-next`, ...), shown with the `Image` widget (`new Image({ icon: 'edit-copy' })`).
  `registerIcon()` adds more.

- Popups: `placePopup(element, anchor, { side, align })` (`src/core/popup.js`) positions a popup
  in the screen layer next to an element or a point (`pointRectangle(x, y)`): on the preferred
  side if it fits, else on the opposite side if that fits, else where there is most room, and then
  shifted to stay on screen. The rules all popups follow:

  - Popups are top-level (`isTopLevel: true`): a widget without a parent is otherwise insensitive.
  - Menus and tooltips mark their element with `data-wy-popup`; popovers are children of the
    screen layer. Focus and presses inside a popup do not deactivate the window that owns it, and
    pressing on a popup does not move the focus away from its owner.
  - `Popover` (`src/widgets/popover.js`) is the ready-made popup container of the combo box, the
    date entry and the color button. It holds one child and closes (with a
    `PopoverCloseReason`) on Escape, on presses outside it and its owner, when something outside
    it scrolls, when the screen is resized or the page loses the focus, and when its owner is
    hidden, made insensitive or destroyed. It takes the keyboard focus only with `takeFocus`, so
    the owner (such as a combo box) keeps handling the keys.
  - Widgets that own a popup (the combo box, the date entry and the color button) have a settable
    `popupOpen` property, which emits `popup-open-change`, and `popup()` and `popdown()` methods
    (and `togglePopup()`). The popover itself has `isOpen`.
  - Menus have their own handling in `MenuManager` (`src/widgets/menu-manager.js`): it tracks the
    open chain of menus, closes all of them on a press or a scroll outside them, when the page
    loses the focus or the screen changes size, grabs the keyboard while they are open, and gives
    the focus back to the widget that had it when the last one closes.

- `getLocaleManager()` (`src/i18n/locale-manager.js`): the current locale (from the browser by
  default), month and day names, the first day of the week and number separators, all from `Intl`.

- `settings` (`src/core/settings.js`): toolkit-wide delays and distances, also exposed as
  properties of `Application`.

- Toolkit texts (`src/i18n/toolkit-text.js`): the few texts the toolkit shows itself (standard
  button labels such as `_Cancel`, and accessible names such as "Close" and "Next month") are
  English, and `toolkitText(text)` translates them with the application's translator when it has
  an entry, and otherwise with the built-in Dutch, German, French and Spanish dictionaries
  (`TOOLKIT_TRANSLATIONS`). `bindToolkitText(owner, update)` reruns `update` when the language or
  the dictionaries change. Elements rendered with a `data-wy-label="English text"` attribute get
  their translated `aria-label` automatically; widgets set other texts with `bindToolkitText`.
  Every text needs an entry in each dictionary, and labels shown together (such as the buttons of
  a dialog) need different mnemonics; the tests check both.

- `getCursor()` (`src/core/cursor.js`): overrides the page cursor while dragging (`pushShape`,
  `popShape`).

## Focus

The toolkit uses the browser's focus. A widget with `canFocus` gets `tabindex="0"` on its
`focusElement` (the root element by default; e.g. the `<input>` of a line edit). Every widget has
an `accessibleName`, the `aria-label` of its focus element, for widgets without a visible label;
widgets that name other elements override `_getAccessibleNameElements()`, and widgets that compute
their own `aria-label` (such as the color button, which adds its color) override
`_syncAccessibleName()`. Each window
remembers its focus widget (`window.focusWidget`); `isFocus` means "the focus widget of its window"
and `hasFocus` "and the window is active". Only one window is active (`Application.activeWindow`),
and activating a window gives the focus back to its focus widget. Tab and Shift+Tab move the focus
through the window in tree order and wrap around (`AbstractWindow#moveFocus`). Containers that show
only part of their children override `_getFocusChain()`. Pressing on a non-focusable part of a
window does not steal the focus, like on the desktop. `Widget#blur()` clears the window's focus
widget but keeps the keyboard focus on the window, so its keys (such as accelerators) keep working.

Hiding or closing the active window activates the most recently active window that is still shown,
or else the topmost one, and a modal window stays in front of the windows it blocks: they cannot
be activated while it is shown. A modal window also takes the focus back when the focus moves to a
window below it.

## Events

Widgets emit event signals for the event types enabled in their `events` mask (`Events` in
`src/events/constants.js`): `button-press-event`, `button-release-event`, `motion-event`,
`scroll-event`, `key-press-event`, `key-release-event`, `enter-event`, `leave-event`,
`focus-event`, `blur-event` and the drag events, plus a generic `event`. Handlers receive
`(widget, event)`, where the event is a toolkit event (`src/events/events.js`) with `source` (the
innermost widget), `modifiers`, page coordinates `x` and `y`, and so on. A handler that returns
`true` handles the event: it stops propagating (and its default action is prevented, except for
presses). The `CAPTURE_*` masks give `capture-<type>-event` signals, which run from the outermost
widget inwards before the normal (bubble) phase. A widget listening for motion or releases grabs the
pointer while a button is pressed on it. Button events count multiple presses (`event.count`).

Double presses are counted by the toolkit, like in GTK, not taken from the browser's `dblclick`
(which pointer capture can retarget or drop, differently per browser): two primary button presses
within `settings.multiplePressInterval` milliseconds and `MULTIPLE_PRESS_DISTANCE` pixels of each
other make a double press, and a third press starts anew. Widgets that react to double presses
(table rows, list box rows, the calendar, color swatches and the title bar of a window) use
`attachDoublePress(element, handler, { key })` from `src/widgets/double-press.js`, where `key`
tells apart what was pressed (such as the row), so presses on two different rows are no double
press.

Widgets implement their own behavior with plain DOM listeners on their elements. A widget that
handles a key itself (such as Enter in a line edit) calls `preventDefault()` on the key event, so
the default button of a dialog and window accelerators leave it alone. Mnemonics (Alt+letter) are
handled by `activateMnemonic()` in `src/widgets/label.js`, and accelerators by
`src/widgets/accelerators.js`. Keys are
`KeyboardEvent.key` values (`Key` in `src/events/constants.js`).

Drag and drop (`src/events/drag-manager.js`) works with the `draggable` and `droppable` widget
properties and the drag events, which carry a `DragContext` with typed data.

## Declarative construction

`Builder` (`src/construction/builder.js`) builds widget trees from objects or JSON:
`{ type: 'button', label: 'OK', handlers: { activate: fn } }`. Types are registered with
`registerType('button', Button)` (`src/core/registry.js`), which every widget module does for its
classes. Containers take `children` (or `child` for bins); a class can define static
`builderProperties` for its special properties, e.g. a grid's children with `row` and `column`.
Objects with an `id` can be looked up with `builder.getObjectById(id)` and referenced elsewhere in
the input as `{ id: '...' }`.

## Styling

The stylesheet (`src/styles/`, bundled into `dist/widgetry.css`) is plain CSS. `base.css` defines
the design tokens as custom properties on `:root`, derived from the original Clearlooks theme, and a
dark variant under `[data-wy-theme='dark']` (and `'auto'`, which follows the system). Widgets only
use the tokens (`var(--wy-border)`), so a theme is a set of token values. `--wy-accent` sets the
selection and highlight color. Icons are inline SVG masks colored with `currentColor`.

`Application.theme` and `Application.accentColor` set `data-wy-theme` and `--wy-accent` on the
`<html>` element, so they apply to the whole page, not only to the toolkit's windows: an embedded
application (a `MainWindow` with a `host`) also themes its host page, including the CSS
`color-scheme` of the page's own controls and scroll bars. There is one theme per page.

## Tests

Pure logic (models, i18n, the object model) has Node tests (`node --test`, `npm run test:unit`) in
`tests/` directories next to the code, named `<name>_test.js`. Widgets have browser tests with
Playwright in the same kind of directories; they load `tests/harness.html` and import modules from
`/src/`. The root `tests/` directory holds the harness, the tests of the README examples and a test
that builds every registered type with the builder (register a new type there too).

The browser tests run in Chromium and Firefox (`npm run test:browser`, or
`npx playwright test --project=firefox <paths>` for one browser). `PLAYWRIGHT_CHANNEL=chrome` and
`PLAYWRIGHT_FIREFOX_CHANNEL=moz-firefox` use an installed Chrome and Firefox instead of
Playwright's browsers; a Firefox from a snap can only read files in its own directories, so it
also needs `TMPDIR` there, such as `TMPDIR=~/snap/firefox/common/tmp`. Tests must not depend on
one browser's behavior: use the toolkit's own press counting instead of `dblclick`, do not assume
the size of scroll bars (headless Chrome hides overlay scroll bars, Firefox does not), and apply
media preferences such as `prefers-color-scheme` yourself where Firefox cannot emulate them.
