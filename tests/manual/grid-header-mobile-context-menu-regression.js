// === meteor-context-menu: Grid Header Mobile Context Menu Regression ===
//
// Target: Verify the grid-header integration covered by commits
//         aff50b0..5973de7, focused on the real JustDo usage path:
//         - mobile header clicks open the context menu
//         - the top-level menu anchors to the header start edge and opens down
//         - the Add Column submenu opens toward the side with more free space
//         - a visible non-frozen header menu follows horizontal scrolling
//         - a non-frozen header menu closes once its header scrolls out of view
//
// Usage: Paste into the browser console on any page.
// Requires: justdo-manual-testing package
//
// Verified APIs:
//   context.settings, context.clearScrollBinding
//   APP.justdo_pwa.isMobileLayout()
//   APP.modules.project_page.gridControl()
//   GridControl#getColumnsContextMenuTargetSelector()
//   GridControl#getColumnsHeaderSelector()
//   ctx.setCustomFields, ctx.waitForField, ctx.setGridView
//
// Notes:
//   Run this in a desktop browser narrowed into JustDo's mobile layout.
//   Keep a mouse/trackpad available because the Add Column submenu still uses
//   hover, even though the top-level menu opens from a click in mobile layout.
//   In the live app, justdo-pwa disables frozen columns in mobile layout, so
//   this script validates the reachable mobile scroll path instead of the
//   frozen-column "freeze" branch that is covered by automated harness tests.

var VISIBLE_FIELDS = [
  "mcm_ctx_col_1",
  "mcm_ctx_col_2",
  "mcm_ctx_col_3",
  "mcm_ctx_col_4"
];

var HIDDEN_FIELDS = [
  "mcm_ctx_hidden_a",
  "mcm_ctx_hidden_b"
];

function buildNumberField(fieldId, label) {
  return {
    field_id: fieldId,
    custom_field_type_id: "basic-number-decimal",
    field_type: "number",
    label: label,
    decimal: true,
    grid_editable_column: true,
    grid_visible_column: true,
    default_width: 180
  };
}

var FIELD_DEFS = [
  buildNumberField("mcm_ctx_col_1", "CTX Header 1"),
  buildNumberField("mcm_ctx_col_2", "CTX Header 2"),
  buildNumberField("mcm_ctx_col_3", "CTX Header 3"),
  buildNumberField("mcm_ctx_col_4", "CTX Header 4"),
  buildNumberField("mcm_ctx_hidden_a", "CTX Hidden A"),
  buildNumberField("mcm_ctx_hidden_b", "CTX Hidden B")
];

function getContextApi() {
  if (window.context && typeof window.context.init === "function") {
    return window.context;
  }

  if (Package["jchristman:context-menu"] &&
      Package["jchristman:context-menu"].context &&
      typeof Package["jchristman:context-menu"].context.init === "function") {
    return Package["jchristman:context-menu"].context;
  }

  return null;
}

function configureContextForTesting() {
  var contextApi = getContextApi();
  if (contextApi && typeof contextApi.settings === "function") {
    contextApi.settings({
      fadeSpeed: 0,
      above: "auto",
      left: "auto",
      preventDoubleContext: false,
      compress: false
    });
  }
  return contextApi;
}

function getGridControl() {
  return APP.modules.project_page.gridControl();
}

function getViewport(gc) {
  return $(".slick-viewport", gc.container).first();
}

function getMainMenu() {
  return $(".dropdown-context:visible").not(".dropdown-context-sub").first();
}

function closeMenus() {
  var contextApi = getContextApi();

  if (contextApi && typeof contextApi.clearScrollBinding === "function") {
    contextApi.clearScrollBinding();
  }

  $(document.body).trigger("mousedown");
  $(".dropdown-context").stop(true, true).hide();
}

function getHeaderByField(gc, fieldId) {
  var $header = $();

  $(gc.getColumnsContextMenuTargetSelector(), gc.container).each(function() {
    var column = $(this).data("column");
    if (column && column.field === fieldId) {
      $header = $(this);
      return false;
    }
  });

  return $header;
}

function getBounds($el) {
  var offset = $el.offset();
  return {
    left: offset.left,
    right: offset.left + $el.outerWidth(),
    top: offset.top,
    bottom: offset.top + $el.outerHeight()
  };
}

function maxScrollLeft($viewport) {
  var el = $viewport.get(0);

  if (!el) {
    return 0;
  }

  return Math.max(0, el.scrollWidth - $viewport.innerWidth());
}

function setViewportScroll($viewport, nextScrollLeft) {
  $viewport.scrollLeft(nextScrollLeft);
  $viewport.trigger("scroll");
}

function installClickProbe(ctx, fieldId, key) {
  var gc = getGridControl();
  var $header = getHeaderByField(gc, fieldId);

  $header.off(".mcmManualProbe");
  $header.on("click.mcmManualProbe", function(e) {
    ctx.set(key, {
      pageX: e.pageX,
      pageY: e.pageY,
      fieldId: fieldId
    });
  });

  ctx.set(key + "BoundField", fieldId);
}

function clearClickProbe(ctx, key) {
  var fieldId = ctx.get(key + "BoundField");
  var gc;
  var $header;

  if (!fieldId) {
    return;
  }

  gc = getGridControl();
  $header = getHeaderByField(gc, fieldId);
  $header.off(".mcmManualProbe");
  ctx.set(key + "BoundField", null);
}

function triggerHeaderClick($header, clickRatio) {
  var offset = $header.offset();
  var pageX = offset.left + Math.max(2, Math.floor($header.outerWidth() * clickRatio));
  var pageY = offset.top + Math.floor($header.outerHeight() / 2);

  $header.trigger($.Event("click", {
    pageX: pageX,
    pageY: pageY
  }));

  return {
    pageX: pageX,
    pageY: pageY
  };
}

function openMenuForField(fieldId, clickRatio) {
  var gc = getGridControl();
  var $header = getHeaderByField(gc, fieldId);
  var clickInfo;
  var $menu;

  closeMenus();
  clickInfo = triggerHeaderClick($header, clickRatio);
  $menu = getMainMenu();

  return {
    gc: gc,
    $header: $header,
    $menu: $menu,
    pageX: clickInfo.pageX,
    pageY: clickInfo.pageY
  };
}

function expectedStartEdge($header, menuWidth) {
  var headerBounds = getBounds($header);

  if (APP.justdo_i18n.isRtl()) {
    return headerBounds.right - menuWidth;
  }

  return headerBounds.left;
}

function openFirstSubmenu($menu) {
  var $submenuParent = $menu.find(".dropdown-submenu").first();
  var $submenu = $submenuParent.children(".dropdown-context-sub").first();
  var hoverEvent;

  if ($submenuParent.length > 0) {
    // The submenu becomes visible through CSS :hover, which synthetic events
    // do not activate. Fire the same JS path used by the package for
    // directionality, then force the submenu visible for measurement.
    $submenuParent.trigger("mouseenter");
    hoverEvent = new MouseEvent("mouseover", {
      bubbles: true,
      cancelable: true,
      view: window
    });

    $submenuParent.get(0).dispatchEvent(hoverEvent);
    $submenu = $submenuParent.children(".dropdown-context-sub").first();
    if ($submenu.length > 0 && !$submenu.is(":visible")) {
      $submenu.css("display", "block");
    }
  }

  return {
    $submenuParent: $submenuParent,
    $submenu: $submenu
  };
}

function expectedMobileSubmenuDropLeft($submenuParent) {
  var parentBounds = getBounds($submenuParent);
  var freeSpaceLeft = parentBounds.left;
  var freeSpaceRight = window.innerWidth - parentBounds.right;

  if (APP.justdo_i18n.isRtl()) {
    return freeSpaceRight > freeSpaceLeft;
  }

  return freeSpaceLeft > freeSpaceRight;
}

JustdoManualTesting.run({
  name: "Grid Header Mobile Context Menu Regression",
  package: "meteor-context-menu",

  setup: function(ctx, done) {
    ctx.setCustomFields(FIELD_DEFS, function(err) {
      if (err) {
        done(err);
        return;
      }

      ctx.waitForField(HIDDEN_FIELDS[1], function(err) {
        if (err) {
          done(err);
          return;
        }

        done(null);
      });
    });
  },

  phases: [
    {
      type: "custom",
      run: function(ctx, done) {
        configureContextForTesting();

        ctx.setGridView([
          {field: "title", width: 220},
          {field: VISIBLE_FIELDS[0], width: 180},
          {field: VISIBLE_FIELDS[1], width: 180},
          {field: VISIBLE_FIELDS[2], width: 180},
          {field: VISIBLE_FIELDS[3], width: 180}
        ], done);
      }
    },

    {
      type: "tests",
      name: "Setup Verification",
      tests: function(ctx) {
        return [
          ["Context-menu and grid APIs are available", function() {
            var contextApi = configureContextForTesting();
            var gc = getGridControl();
            var $viewport = getViewport(gc);
            var idx;

            this.assert(!!contextApi, "Expected the jchristman:context-menu client export");
            this.assert(typeof contextApi.settings === "function", "Expected context.settings()");
            this.assert(typeof contextApi.clearScrollBinding === "function", "Expected context.clearScrollBinding()");

            this.assert(!!gc, "Expected APP.modules.project_page.gridControl() to return a grid control");
            this.assert(typeof gc.getColumnsContextMenuTargetSelector === "function",
              "Expected grid_control.getColumnsContextMenuTargetSelector()");
            this.assert(typeof gc.getColumnsHeaderSelector === "function",
              "Expected grid_control.getColumnsHeaderSelector()");

            this.assert($viewport.length === 1, "Expected exactly one .slick-viewport in the active grid");
            this.assert(maxScrollLeft($viewport) > 0, "Expected the test grid to be horizontally scrollable");

            this.assert(getHeaderByField(gc, "title").length === 1, "Expected the frozen Title header");
            for (idx = 0; idx < VISIBLE_FIELDS.length; idx += 1) {
              this.assert(getHeaderByField(gc, VISIBLE_FIELDS[idx]).length === 1,
                "Expected header for " + VISIBLE_FIELDS[idx]);
            }

            this.assert(VISIBLE_FIELDS.length < FIELD_DEFS.length,
              "Expected hidden fields so the Add Column submenu has content");
          }]
        ];
      }
    },

    {
      type: "guided",
      instruction: function(ctx) {
        return "1. Resize the browser window or enable Chrome responsive mode until the app is in <b>mobile layout</b>.<br>" +
               "2. Keep the test project on the main grid page.<br>" +
               "3. Keep a mouse/trackpad available, because the <b>Add Column</b> submenu still uses hover.<br>" +
               "4. Click below only after the grid is visibly in mobile mode.";
      },
      buttonText: "Mobile layout is active - Continue",
      useBootbox: true
    },

    {
      type: "tests",
      name: "Mobile Layout Verification",
      tests: function(ctx) {
        ctx.setSummaryHtml(
          "<h4>Environment</h4>" +
          "<p>window.innerWidth: " + window.innerWidth + "</p>" +
          "<p>RTL: " + (APP.justdo_i18n.isRtl() ? "yes" : "no") + "</p>" +
          "<p>Frozen columns disabled in mobile layout: " +
          (getGridControl() && typeof getGridControl().isFrozenColumnsMode === "function" ?
            (getGridControl().isFrozenColumnsMode() ? "no" : "yes") :
            "unknown") +
          "</p>"
        );

        return [
          ["APP.justdo_pwa reports mobile layout", function() {
            this.assert(APP.justdo_pwa.isMobileLayout() === true,
              "Expected APP.justdo_pwa.isMobileLayout() to be true before running the regression checks");
          }],

          ["Frozen columns mode is disabled in live mobile layout", function() {
            var gc = getGridControl();

            this.assert(typeof gc.isFrozenColumnsMode === "function",
              "Expected grid_control.isFrozenColumnsMode()");
            this.assert(gc.isFrozenColumnsMode() === false,
              "Expected live mobile layout to disable frozen columns before the scroll tests");
          }]
        ];
      }
    },

    {
      type: "custom",
      run: function(ctx, done) {
        closeMenus();
        ctx.set("titleHeaderClickInfo", null);
        installClickProbe(ctx, "title", "titleHeaderClickInfo");
        done(null);
      }
    },

    {
      type: "guided",
      instruction: function(ctx) {
        return "1. Click the <b>Title</b> header once to open its context menu.<br>" +
               "2. In LTR, click near the <b>right side</b> of the Title header. In RTL, click near the <b>left side</b>.<br>" +
               "3. Leave the menu open.<br>" +
               "4. Click below after the Title header menu is visible.";
      },
      buttonText: "Menu Opened"
    },

    {
      type: "tests",
      name: "Title Header Positioning",
      tests: function(ctx) {
        return [
          ["Manual Title header click opens a downward menu anchored to the header start edge", function() {
            var clickInfo = ctx.get("titleHeaderClickInfo");
            var gc = getGridControl();
            var $header = getHeaderByField(gc, "title");
            var $menu = getMainMenu();
            var menuBounds;
            var expectedLeft;

            this.assert(!!clickInfo, "Expected the guided step to record a Title header click");
            this.assert($header.length === 1, "Expected to find the Title header");
            this.assert($menu.length === 1 && $menu.is(":visible"),
              "Expected a visible top-level context menu after the manual Title header click");

            menuBounds = getBounds($menu);
            expectedLeft = expectedStartEdge($header, $menu.outerWidth());

            this.assert(Math.abs(menuBounds.left - expectedLeft) <= 2,
              "Expected menu left " + expectedLeft + ", got " + menuBounds.left);
            this.assert($menu.hasClass("dropdown-context-up") === false,
              "Expected mobile header menu to open downward");
            this.assert($menu.hasClass("dropdown-context-left") === false,
              "Expected mobile header menu to skip dropdown-context-left");
            this.assert(menuBounds.top >= getBounds($header).top,
              "Expected mobile header menu to render below the header");
            this.assert(Math.abs(menuBounds.left - clickInfo.pageX) >= 30,
              "Expected the menu to anchor to the header edge, not the recorded click point");
            this.assert(menuBounds.left >= -1 && menuBounds.right <= window.innerWidth + 1,
              "Expected the top-level menu to stay within the mobile viewport");
          }]
        ];
      }
    },

    {
      type: "manual-check",
      question: "Does the Title header menu appear below the header and feel anchored to the column edge rather than the exact click point?"
    },

    {
      type: "custom",
      run: function(ctx, done) {
        clearClickProbe(ctx, "titleHeaderClickInfo");
        closeMenus();
        done(null);
      }
    },

    {
      type: "tests",
      name: "Add Column Submenu Direction",
      tests: function(ctx) {
        return [
          ["The Add Column submenu opens toward the side with more free space", function() {
            var gc = getGridControl();
            var $viewport = getViewport(gc);
            var state;
            var submenuState;
            var submenuBounds;
            var expectedDropLeft;

            setViewportScroll($viewport, maxScrollLeft($viewport));

            state = openMenuForField(VISIBLE_FIELDS[3], APP.justdo_i18n.isRtl() ? 0.2 : 0.8);
            this.assert(state.$menu.length === 1 && state.$menu.is(":visible"),
              "Expected the right-edge test header to open a visible menu");

            submenuState = openFirstSubmenu(state.$menu);
            this.assert(submenuState.$submenuParent.length === 1,
              "Expected the Add Column submenu parent item");
            this.assert(submenuState.$submenu.length === 1 && submenuState.$submenu.is(":visible"),
              "Expected the Add Column submenu to become visible");

            expectedDropLeft = expectedMobileSubmenuDropLeft(submenuState.$submenuParent);
            this.assert(submenuState.$submenu.hasClass("drop-left") === expectedDropLeft,
              "Expected submenu drop-left=" + expectedDropLeft +
              ", got " + submenuState.$submenu.hasClass("drop-left"));

            submenuBounds = getBounds(submenuState.$submenu);
            this.assert(submenuBounds.left >= -1 && submenuBounds.right <= window.innerWidth + 1,
              "Expected the Add Column submenu to stay within the mobile viewport");
          }]
        ];
      }
    },

    {
      type: "manual-check",
      question: "Does the Add Column submenu open toward the side with more free space and stay fully visible on screen?"
    },

    {
      type: "custom",
      run: function(ctx, done) {
        closeMenus();
        done(null);
      }
    },

    {
      type: "tests",
      name: "Scroll Binding Regression Checks",
      tests: function(ctx) {
        return [
          ["Visible mobile header menu follows horizontal scrolling while its header stays in view", function() {
            var $viewport = getViewport(getGridControl());
            var state;
            var initialLeft;
            var smallDelta;

            setViewportScroll($viewport, 0);
            state = openMenuForField(VISIBLE_FIELDS[0], APP.justdo_i18n.isRtl() ? 0.2 : 0.8);

            this.assert(state.$menu.length === 1 && state.$menu.is(":visible"),
              "Expected the visible test header menu to open before the scroll-follow check");

            initialLeft = getBounds(state.$menu).left;
            smallDelta = Math.min(maxScrollLeft($viewport), 60);
            setViewportScroll($viewport, smallDelta);

            this.assert(state.$menu.is(":visible"),
              "Expected the menu to remain visible while its header is still on screen");
            this.assert(Math.abs(getBounds(state.$menu).left - (initialLeft - smallDelta)) <= 2,
              "Expected the menu to follow the viewport by the scroll delta");
          }],

          ["Non-frozen header menu closes once its header scrolls out of view", function() {
            var $viewport = getViewport(getGridControl());
            var state;
            var closeScrollLeft = maxScrollLeft($viewport);

            setViewportScroll($viewport, 0);
            state = openMenuForField(VISIBLE_FIELDS[0], APP.justdo_i18n.isRtl() ? 0.2 : 0.8);

            this.assert(state.$menu.length === 1 && state.$menu.is(":visible"),
              "Expected the non-frozen test header to open a visible menu");

            setViewportScroll($viewport, closeScrollLeft);

            this.assert(state.$menu.is(":visible") === false,
              "Expected the non-frozen header menu to close after its header scrolled out of view");

            closeMenus();
          }]
        ];
      }
    }
  ]
});
