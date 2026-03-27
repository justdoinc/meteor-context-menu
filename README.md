# meteor-bootstrap-context-menu

This package started as a Meteor port of [contextjs](http://lab.jakiestfu.com/contextjs/), but the version in this repository is not a stock upstream wrapper anymore.

In addition to the original menu-building behavior, this package now includes:

- Blaze context capture for action callbacks
- RTL-aware menu positioning
- JustDo mobile-layout positioning rules
- Optional horizontal scroll tracking for visible dropdowns

## Installation

```bash
meteor add jchristman:context-menu
```

## Menu Definition

You can define a menu in one of two forms:

- An array of menu items
- An object with a stable `id` and a `data` array

Using the object form lets the package reuse the same DOM node for subsequent openings of the same menu.

```js
var taskMenu = {
  id: 'task-actions',
  data: [
    {
      header: 'Task'
    },
    {
      icon: 'glyphicon-edit',
      text: 'Edit',
      action: function (event, $target, blazeContext) {
        console.log('Edit', $target, blazeContext);
      }
    },
    {
      text: 'More',
      subMenu: [
        {
          text: 'Archive',
          action: function (event, $target, blazeContext) {
            console.log('Archive', $target, blazeContext);
          }
        }
      ]
    },
    {
      divider: true
    },
    {
      menu_item_src: buildDynamicItems
    }
  ]
};
```

### Supported Item Shapes

- `header`: renders a non-clickable section header
- `divider`: renders a separator
- Standard item:
  - `text`
  - optional `icon`
  - optional `href`
  - optional `target`
  - optional `action`
- Submenu item:
  - `text`
  - `subMenu`
- Dynamic item source:
  - `menu_item_src`

`menu_item_src` may be either a function or the name of a global function. It is called with the clicked jQuery element and the captured Blaze data context, and should return an array of menu items.

### Action Callback Signature

For normal clickable items, `action` is called as:

```js
function (event, $target, blazeContext) {}
```

- `event`: the triggering mouse event
- `$target`: the jQuery-wrapped element that opened the menu
- `blazeContext`: the result of `Blaze.getData($target.get(0))` when available

## Binding A Menu

The simplest form is:

```js
context.attach('.task-row', taskMenu);
```

When you pass an array instead of an object, the package generates a timestamp-based menu id internally.

### `context.attach(selector, config)`

`context.attach` supports the following config keys when you use the object form:

- `id`: stable dropdown id suffix. The DOM node is rendered as `#dropdown-<id>`.
- `data`: the menu definition array.
- `scrollContainer`: optional scrollable ancestor to follow while the menu is visible.
- `onScrollContainerScroll`: optional callback invoked on each scroll event.

Example:

```js
context.attach('.grid-header-cell', {
  id: 'grid-column-actions',
  data: taskMenu.data,
  scrollContainer: $('.slick-viewport'),
  onScrollContainerScroll: function ($menu, $target) {
    if ($target.length === 0) {
      return false;
    }

    return true;
  }
});
```

### Scroll Callback Contract

If `onScrollContainerScroll` is provided, it receives:

- `$menu`: the visible dropdown jQuery element
- `$target`: the jQuery element that originally opened the menu

Its return value controls the dropdown behavior:

- `false`: close the dropdown
- `'freeze'`: keep the dropdown visible without adjusting its horizontal position
- anything else: move the dropdown horizontally with the scroll container

## Global Options

Options are global to the package instance. Set them once with `context.init(...)` or update them later with `context.settings(...)`.

```js
context.init({
  fadeSpeed: 150,
  compress: true
});
```

### Supported Options

| Option | Default | Notes |
|---|---|---|
| `fadeSpeed` | `context.CONSTANTS.FADE_SPEED_MS` | Used for `fadeIn` / `fadeOut` |
| `filter($li)` | no-op | Called after each item is appended |
| `above` | `'auto'` | `true` always opens above; `'auto'` chooses automatically |
| `left` | `'auto'` | `true` forces left-opening; `'auto'` flips when needed on non-mobile layouts |
| `preventDoubleContext` | `true` | Prevents browser context menus inside dropdowns |
| `compress` | `false` | Adds the `compressed-context` class to menus |

## Runtime Behavior

### Closing

- Only one top-level dropdown is shown at a time.
- Clicking outside the menu closes visible dropdowns.
- Closing the menu also clears the active scroll binding.

### Submenus

- On desktop layouts, submenus flip when they would overflow the viewport edge.
- On mobile layouts, submenus open toward the side with more available space.

### RTL And Mobile Layout

This package reads JustDo globals when they are available:

- `APP.justdo_i18n.isRtl()`
- `APP.justdo_pwa.isMobileLayout()`

If those globals are unavailable, both checks fall back to `false`.

Current behavior when `APP.justdo_pwa.isMobileLayout()` returns `true`:

- Top-level menus opened through `context.attach(...)` with `above: 'auto'` align to the start edge of the clicked element instead of the cursor position
- Top-level menus open downward
- Cursor-based left/right auto-flip logic is skipped for the top-level menu

Current behavior when `APP.justdo_i18n.isRtl()` returns `true`:

- Horizontal positioning is mirrored
- Submenu default direction is mirrored

## Public API

| API | Purpose |
|---|---|
| `context.init(opts)` | Merge options and install document-level handlers |
| `context.settings(opts)` | Update options without reinitializing the package |
| `context.attach(selector, config)` | Bind a context menu to matching elements |
| `context.buildMenu(data, id, subMenu)` | Build a menu DOM tree without attaching handlers |
| `context.destroy(selector)` | Remove the `contextmenu` handler from the selector |
| `context.bindScrollContainer(menuId, $scrollContainer, onScroll)` | Attach horizontal scroll tracking to an already-visible dropdown |
| `context.clearScrollBinding()` | Remove the current active scroll binding |
| `context.CONSTANTS` | Exposes shared positioning and fade constants |

## Manual Scroll Binding

Use `context.bindScrollContainer(...)` when a menu is shown outside the standard `context.attach(...)` flow and you still want it to follow a horizontal scroll container.

```js
context.bindScrollContainer('grid-column-actions', $('.slick-viewport'), function () {
  return true;
});
```

`context.clearScrollBinding()` removes the currently active binding and is safe to call during teardown.

## Notes

- `context.destroy(selector)` only unbinds the `contextmenu` handler from the selector. It does not remove previously created dropdown DOM nodes from `<body>`.
- `context.buildMenu(...)` is a low-level helper. Most consumers should prefer `context.attach(...)`.
- The examples and upstream `contextjs` documentation are still useful for menu structure, but the API and behavior documented above are the source of truth for this repository.
