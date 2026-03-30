// === meteor-context-menu: Desktop Grid Header Context Menu Integration ===
//
// Target: The real JustDo desktop grid-header integration that consumes
//         meteor-context-menu through grid-control's column-header menus.
//
// Focus:
//   - first/common/last/empty-space header menu variants
//   - desktop-only header anchoring during horizontal scroll
//   - frozen title header "freeze" behavior
//   - tracked non-frozen header close-on-scroll-out behavior
//   - Add Column submenu search/filter/add flow
//   - Hide Column flow on a common header
//
// Usage: Paste into the browser console on any page.
// Requires: justdo-manual-testing package
//
// Verified APIs / surfaces:
//   ctx.setCustomFields, ctx.waitForField, ctx.setGridView
//   window.context.attach, window.context.settings, window.context.clearScrollBinding
//   APP.justdo_pwa.isMobileLayout()
//   APP.modules.project_page.gridControl()
//   gc.getView(), gc.setView(), gc.fieldsMissingFromView()
//   gc._getColumnsManagerContextMenuId(), gc._getColumnsManagerContextMenuSelector()
//   gc.getColumnsContextMenuTargetSelector(), gc.getColumnsHeaderSelector()
//   gc.getViewportScrollLeft(), gc.setViewportScrollLeft(), gc.isFrozenColumnsMode()
//   TAPi18n.__()

(function () {
  function makeNumberField(fieldId, label) {
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

  var FIELDS = {
    alpha: makeNumberField("mcm_alpha", "MCM Alpha"),
    bravo: makeNumberField("mcm_bravo", "MCM Bravo"),
    charlie: makeNumberField("mcm_charlie", "MCM Charlie"),
    delta: makeNumberField("mcm_delta", "MCM Delta"),
    echo: makeNumberField("mcm_echo", "MCM Echo"),
    foxtrot: makeNumberField("mcm_foxtrot", "MCM Foxtrot"),
    golf: makeNumberField("mcm_golf", "MCM Golf"),
    hotel: makeNumberField("mcm_hotel", "MCM Hotel")
  };

  var ALL_FIELDS = [
    FIELDS.alpha,
    FIELDS.bravo,
    FIELDS.charlie,
    FIELDS.delta,
    FIELDS.echo,
    FIELDS.foxtrot,
    FIELDS.golf,
    FIELDS.hotel
  ];

  var WIDE_VIEW = [
    {field: "title", width: 280},
    {field: FIELDS.alpha.field_id, width: 220},
    {field: FIELDS.bravo.field_id, width: 220},
    {field: FIELDS.charlie.field_id, width: 220},
    {field: FIELDS.delta.field_id, width: 220},
    {field: FIELDS.echo.field_id, width: 220},
    {field: FIELDS.foxtrot.field_id, width: 220}
  ];

  var COMPACT_VIEW = [
    {field: "title", width: 260},
    {field: FIELDS.alpha.field_id, width: 140},
    {field: FIELDS.bravo.field_id, width: 140},
    {field: FIELDS.charlie.field_id, width: 140}
  ];

  function label(key) {
    return TAPi18n.__(key);
  }

  function escapeHtml(str) {
    return _.escape(str == null ? "" : String(str));
  }

  function normalizeText(str) {
    return $.trim(String(str || "").replace(/\s+/g, " "));
  }

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

  function getGc() {
    return APP.modules.project_page.gridControl();
  }

  function getViewport(gc) {
    return $(".slick-viewport", gc.container).first();
  }

  function getHeaders(gc) {
    return $(gc.getColumnsContextMenuTargetSelector(), gc.container);
  }

  function getCommonHeaders(gc) {
    var $headers = getHeaders(gc);
    if ($headers.length <= 2) {
      return $();
    }
    return $headers.slice(1, $headers.length - 1);
  }

  function getLastHeader(gc) {
    var $headers = getHeaders(gc);
    if ($headers.length <= 1) {
      return $();
    }
    return $headers.last();
  }

  function getHeaderStrip(gc) {
    return $(gc.getColumnsHeaderSelector(), gc.container).first();
  }

  function getHeaderField($header) {
    return $header.data("column") && $header.data("column").field;
  }

  function getHeaderByField(gc, fieldId) {
    return getHeaders(gc).filter(function () {
      return getHeaderField($(this)) === fieldId;
    }).first();
  }

  function getMenu(gc, type) {
    return $(gc._getColumnsManagerContextMenuSelector(type));
  }

  function getDirectMenuTexts($menu) {
    return $menu.children("li").children("a").map(function () {
      return normalizeText($(this).text());
    }).get().filter(Boolean);
  }

  function getSubmenuTexts($submenu) {
    return $submenu.children("li").not(":first").children("a").map(function () {
      return normalizeText($(this).text());
    }).get().filter(Boolean);
  }

  function numericCss($el, propertyName) {
    var value = parseFloat($el.css(propertyName));
    return isNaN(value) ? 0 : value;
  }

  function getViewFields(gc) {
    return _.map(gc.getView(), function (col) {
      return col.field;
    });
  }

  function hasField(gc, fieldId) {
    return getViewFields(gc).indexOf(fieldId) !== -1;
  }

  function missingFields(gc) {
    return gc.fieldsMissingFromView();
  }

  function getViewportMaxScrollLeft(gc) {
    var $viewport = getViewport(gc);
    var el = $viewport.get(0);
    if (!el) {
      return gc.getViewportScrollLeft ? gc.getViewportScrollLeft() : 0;
    }
    return Math.max(0, el.scrollWidth - $viewport.innerWidth());
  }

  function closeAllMenus() {
    var contextApi = getContextApi();
    if (contextApi && typeof contextApi.clearScrollBinding === "function") {
      contextApi.clearScrollBinding();
    }
    $(".dropdown-context").stop(true, true).hide();
  }

  function waitFor(labelText, predicate, cb, timeoutMs) {
    var timeout = timeoutMs || 1500;
    var started = Date.now();

    function tick() {
      var passed = false;

      try {
        passed = !!predicate();
      } catch (err) {
        cb(err);
        return;
      }

      if (passed) {
        cb(null);
        return;
      }

      if ((Date.now() - started) > timeout) {
        cb(new Error("Timed out waiting for " + labelText));
        return;
      }

      requestAnimationFrame(tick);
    }

    tick();
  }

  function afterNextPaint(cb) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        cb();
      });
    });
  }

  function scrollViewport(gc, left) {
    var $viewport = getViewport(gc);
    if (typeof gc.setViewportScrollLeft === "function") {
      gc.setViewportScrollLeft(left);
    } else {
      $viewport.scrollLeft(left);
    }
    $viewport.trigger("scroll");
    return $viewport.scrollLeft();
  }

  function openMenuOnTarget($target, pageX, pageY) {
    var offset = $target.offset();
    var x = pageX != null ? pageX : offset.left + Math.floor($target.outerWidth() / 2);
    var y = pageY != null ? pageY : offset.top + Math.floor($target.outerHeight() / 2);
    var event = $.Event("contextmenu", {
      pageX: x,
      pageY: y
    });

    $target.trigger(event);

    return {
      pageX: x,
      pageY: y
    };
  }

  function openHeaderMenuForField(fieldId, type, opts) {
    var gc = getGc();
    var $header = getHeaderByField(gc, fieldId);
    var position;

    if (!$header.length) {
      throw new Error("Header not found for field " + fieldId);
    }

    position = openMenuOnTarget(
      $header,
      opts && opts.pageX,
      opts && opts.pageY
    );

    return {
      gc: gc,
      $header: $header,
      $menu: getMenu(gc, type),
      pageX: position.pageX,
      pageY: position.pageY
    };
  }

  function openLastHeaderMenu() {
    var gc = getGc();
    var $header = getLastHeader(gc);
    var fieldId = getHeaderField($header);

    if (!$header.length || fieldId === "title") {
      throw new Error("Could not find a non-title last header");
    }

    return openHeaderMenuForField(fieldId, "last");
  }

  function openEmptySpaceMenu() {
    var gc = getGc();
    var $strip = getHeaderStrip(gc);
    var offset = $strip.offset();
    var pageX = offset.left + Math.max(24, Math.floor($strip.innerWidth()) - 24);
    var pageY = offset.top + Math.floor($strip.outerHeight() / 2);

    openMenuOnTarget($strip, pageX, pageY);

    return {
      gc: gc,
      $strip: $strip,
      $menu: getMenu(gc, "empty-space"),
      pageX: pageX,
      pageY: pageY
    };
  }

  function getVisibleBounds(gc, fieldId) {
    var $container = $(gc.container);
    var left = $container.offset().left;
    var right = left + $container.innerWidth();

    if (fieldId !== "title" && gc.isFrozenColumnsMode()) {
      var titleColumn = _.find(gc.getView(), function (col) {
        return col.field === "title";
      });
      var titleWidth = titleColumn && titleColumn.width ? titleColumn.width : 0;

      if (APP.justdo_i18n && APP.justdo_i18n.isRtl && APP.justdo_i18n.isRtl()) {
        right -= titleWidth;
      } else {
        left += titleWidth;
      }
    }

    return {
      left: left,
      right: right
    };
  }

  function pickCommonHeaderForFollow(gc) {
    var chosen = $();

    getCommonHeaders(gc).each(function () {
      var $header = $(this);
      var fieldId = getHeaderField($header);
      var bounds = getVisibleBounds(gc, fieldId);
      var right = $header.offset().left + $header.outerWidth();
      var maxDelta = Math.floor(right - bounds.left - 30);

      if (maxDelta > 30) {
        chosen = $header;
        return false;
      }
    });

    return chosen.length ? chosen : getCommonHeaders(gc).first();
  }

  function calcSafeFollowDelta(gc, $header) {
    var bounds = getVisibleBounds(gc, getHeaderField($header));
    var right = $header.offset().left + $header.outerWidth();
    var maxDelta = Math.floor(right - bounds.left - 30);

    return Math.min(100, Math.max(20, maxDelta));
  }

  function pickCommonHeaderForClose(gc) {
    var chosen = $();
    var currentScroll = gc.getViewportScrollLeft();
    var maxScroll = getViewportMaxScrollLeft(gc);

    getCommonHeaders(gc).each(function () {
      var $header = $(this);
      var fieldId = getHeaderField($header);
      var bounds = getVisibleBounds(gc, fieldId);
      var right = $header.offset().left + $header.outerWidth();
      var neededDelta = Math.ceil(right - bounds.left + 40);

      if ((maxScroll - currentScroll) >= neededDelta) {
        chosen = $header;
        return false;
      }
    });

    return chosen.length ? chosen : getCommonHeaders(gc).last();
  }

  function calcCloseDelta(gc, $header) {
    var fieldId = getHeaderField($header);
    var bounds = getVisibleBounds(gc, fieldId);
    var right = $header.offset().left + $header.outerWidth();
    var currentScroll = gc.getViewportScrollLeft();
    var maxScroll = getViewportMaxScrollLeft(gc);
    var neededDelta = Math.ceil(right - bounds.left + 40);

    return Math.max(0, Math.min(maxScroll - currentScroll, neededDelta));
  }

  function openSubmenu($submenuParent) {
    var nativeEvent = new MouseEvent("mouseover", {
      bubbles: true,
      cancelable: true,
      view: window
    });
    var $submenu;

    $submenuParent.trigger("mouseenter");
    $submenuParent.get(0).dispatchEvent(nativeEvent);
    $submenu = $submenuParent.children(".dropdown-context-sub").first();

    // The submenu is normally shown by CSS :hover, which synthetic events do
    // not toggle. Force visibility after running the package's mouseover logic.
    if ($submenu.length > 0 && !$submenu.is(":visible")) {
      $submenu.css("display", "block");
    }

    return $submenu;
  }

  function findSubmenuBySearchInput($menu) {
    return $menu.find(".grid-columns-search-input").closest(".dropdown-context-sub");
  }

  function addFieldSummaryHtml() {
    var labels = _.map(ALL_FIELDS, function (field) {
      return escapeHtml(field.label);
    }).join(", ");

    return "<h4>Header Columns Seeded For This Test</h4>" +
      "<p>" + labels + "</p>" +
      "<p>The script intentionally switches between a wide header view (for scroll behavior) " +
      "and a compact header view (for empty-space context menu checks).</p>";
  }

  JustdoManualTesting.run({
    name: "Desktop grid-header context menu integration",
    package: "meteor-context-menu",

    setup: function (ctx, done) {
      ctx.setSummaryHtml(addFieldSummaryHtml());

      ctx.setCustomFields(ALL_FIELDS, function (err) {
        if (err) {
          done(err);
          return;
        }

        ctx.waitForField(FIELDS.alpha.field_id, function (err) {
          if (err) {
            done(err);
            return;
          }

          ctx.waitForField(FIELDS.hotel.field_id, function (err) {
            if (err) {
              done(err);
              return;
            }

            ctx.setGridView(WIDE_VIEW, function (err) {
              if (err) {
                done(err);
                return;
              }

              ctx.set("wideViewFields", _.map(WIDE_VIEW, function (col) { return col.field; }));
              ctx.set("compactViewFields", _.map(COMPACT_VIEW, function (col) { return col.field; }));

              try {
                scrollViewport(getGc(), 0);
                closeAllMenus();
              } catch (cleanupErr) {
                done(cleanupErr);
                return;
              }

              done(null);
            });
          });
        });
      });
    },

    phases: [
      {
        type: "tests",
        name: "Desktop Preflight",
        tests: function (ctx) {
          var contextApi = getContextApi();
          var gc = getGc();
          var visibleFields = getViewFields(gc);
          var missing = missingFields(gc);

          return [
            ["context global is available with public methods", function () {
              this.assert(contextApi != null, "Expected window.context to exist");
              this.assert(typeof contextApi.attach === "function", "Expected context.attach()");
              this.assert(typeof contextApi.settings === "function", "Expected context.settings()");
              this.assert(typeof contextApi.clearScrollBinding === "function", "Expected context.clearScrollBinding()");
              this.assert(contextApi.CONSTANTS != null, "Expected context.CONSTANTS");
            }],

            ["desktop layout is active", function () {
              this.assert(typeof APP.justdo_pwa.isMobileLayout === "function", "Expected APP.justdo_pwa.isMobileLayout()");
              this.assert(APP.justdo_pwa.isMobileLayout() === false, "Expected desktop layout, not mobile layout");
            }],

            ["grid-control APIs used by this test exist", function () {
              this.assert(gc != null, "Expected an active grid control");
              this.assert(typeof gc.getView === "function", "Expected gc.getView()");
              this.assert(typeof gc.setView === "function", "Expected gc.setView()");
              this.assert(typeof gc.fieldsMissingFromView === "function", "Expected gc.fieldsMissingFromView()");
              this.assert(typeof gc._getColumnsManagerContextMenuId === "function", "Expected gc._getColumnsManagerContextMenuId()");
              this.assert(typeof gc._getColumnsManagerContextMenuSelector === "function", "Expected gc._getColumnsManagerContextMenuSelector()");
              this.assert(typeof gc.getColumnsContextMenuTargetSelector === "function", "Expected gc.getColumnsContextMenuTargetSelector()");
              this.assert(typeof gc.getColumnsHeaderSelector === "function", "Expected gc.getColumnsHeaderSelector()");
              this.assert(typeof gc.getViewportScrollLeft === "function", "Expected gc.getViewportScrollLeft()");
              this.assert(typeof gc.setViewportScrollLeft === "function", "Expected gc.setViewportScrollLeft()");
              this.assert(typeof gc.isFrozenColumnsMode === "function", "Expected gc.isFrozenColumnsMode()");
            }],

            ["wide test view is loaded and title is frozen", function () {
              this.assertEqual(ctx.get("wideViewFields").join(","), visibleFields.join(","),
                "Unexpected visible fields: " + JSON.stringify(visibleFields));
              this.assert(gc.isFrozenColumnsMode() === true, "Expected frozen-columns mode to be active");
              this.assert(gc.getView()[0].field === "title" && gc.getView()[0].frozen === true,
                "Expected the first visible column to be the frozen title column");
            }],

            ["hidden custom fields are available for Add Column", function () {
              this.assert(missing.indexOf(FIELDS.golf.field_id) !== -1, "Expected MCM Golf to be missing from the current view");
              this.assert(missing.indexOf(FIELDS.hotel.field_id) !== -1, "Expected MCM Hotel to be missing from the current view");
            }],

            ["expected header cells exist in the grid DOM", function () {
              this.assert(getHeaderByField(gc, "title").length === 1, "Expected the title header");
              this.assert(getHeaderByField(gc, FIELDS.alpha.field_id).length === 1, "Expected the Alpha header");
              this.assert(getHeaderByField(gc, FIELDS.bravo.field_id).length === 1, "Expected the Bravo header");
              this.assert(getHeaderByField(gc, FIELDS.foxtrot.field_id).length === 1, "Expected the Foxtrot header");
            }]
          ];
        }
      },

      {
        type: "guided",
        useBootbox: true,
        instruction: function () {
          return "Keep the app in a <b>desktop-width viewport</b> and make sure the grid header row is visible.<br><br>" +
            "Then manually <b>right-click the Title column header</b>.<br><br>" +
            "If the floating guidance panel blocks the grid, drag it aside before you right-click.";
        },
        buttonText: "I opened the title-header menu"
      },

      {
        type: "manual-check",
        question: function () {
          return "Did the JustDo header menu open near the cursor without the browser's native context menu appearing?";
        }
      },

      {
        type: "custom",
        run: function (ctx, done) {
          var firstSnapshot;
          var lastSnapshot;

          function captureTitleMenu() {
            var opened;

            try {
              scrollViewport(getGc(), 0);
              closeAllMenus();
              opened = openHeaderMenuForField("title", "first");
            } catch (err) {
              done(err);
              return;
            }

            waitFor("first header menu to become visible", function () {
              return opened.$menu.length > 0 && opened.$menu.is(":visible");
            }, function (err) {
              if (err) {
                done(err);
                return;
              }

              firstSnapshot = {
                texts: getDirectMenuTexts(opened.$menu),
                hasSubmenu: opened.$menu.find(".dropdown-submenu").length > 0
              };

              closeAllMenus();
              captureLastMenu();
            });
          }

          function captureLastMenu() {
            var opened;

            try {
              opened = openLastHeaderMenu();
            } catch (err) {
              done(err);
              return;
            }

            waitFor("last header menu to become visible", function () {
              return opened.$menu.length > 0 && opened.$menu.is(":visible");
            }, function (err) {
              if (err) {
                done(err);
                return;
              }

              lastSnapshot = {
                field: getHeaderField(opened.$header),
                texts: getDirectMenuTexts(opened.$menu),
                hasSubmenu: opened.$menu.find(".dropdown-submenu").length > 0
              };

              closeAllMenus();
              ctx.set("firstMenuSnapshot", firstSnapshot);
              ctx.set("lastMenuSnapshot", lastSnapshot);
              done(null);
            });
          }

          captureTitleMenu();
        }
      },

      {
        type: "tests",
        name: "First And Last Header Menus",
        tests: function (ctx) {
          var firstSnapshot = ctx.get("firstMenuSnapshot");
          var lastSnapshot = ctx.get("lastMenuSnapshot");

          return [
            ["title header menu exposes Add Column and Unfreeze Column", function () {
              this.assert(firstSnapshot != null, "Expected a captured first-menu snapshot");
              this.assert(firstSnapshot.hasSubmenu === true, "Expected the first menu to include an Add Column submenu");
              this.assert(firstSnapshot.texts.indexOf(label("add_column_label")) !== -1,
                "Expected Add Column in first-menu texts: " + JSON.stringify(firstSnapshot.texts));
              this.assert(firstSnapshot.texts.indexOf(label("unfreeze_column_label")) !== -1,
                "Expected Unfreeze Column in first-menu texts: " + JSON.stringify(firstSnapshot.texts));
            }],

            ["last header menu exposes Add Column and Hide Column", function () {
              this.assert(lastSnapshot != null, "Expected a captured last-menu snapshot");
              this.assert(lastSnapshot.field === FIELDS.foxtrot.field_id,
                "Expected the wide view's last header to be Foxtrot");
              this.assert(lastSnapshot.hasSubmenu === true, "Expected the last menu to include an Add Column submenu");
              this.assert(lastSnapshot.texts.indexOf(label("add_column_label")) !== -1,
                "Expected Add Column in last-menu texts: " + JSON.stringify(lastSnapshot.texts));
              this.assert(lastSnapshot.texts.indexOf(label("hide_column_label")) !== -1,
                "Expected Hide Column in last-menu texts: " + JSON.stringify(lastSnapshot.texts));
            }]
          ];
        }
      },

      {
        type: "custom",
        run: function (ctx, done) {
          var gc = getGc();
          var $header = pickCommonHeaderForFollow(gc);
          var opened;
          var fieldId = getHeaderField($header);
          var delta = calcSafeFollowDelta(gc, $header);
          var beforeLeft;
          var afterLeft;

          if (!$header.length || !fieldId) {
            done(new Error("Could not find a common header for the scroll-follow check"));
            return;
          }

          closeAllMenus();
          scrollViewport(gc, 0);

          try {
            opened = openHeaderMenuForField(fieldId, "common");
          } catch (err) {
            done(err);
            return;
          }

          waitFor("common header menu to become visible", function () {
            return opened.$menu.length > 0 && opened.$menu.is(":visible");
          }, function (err) {
            if (err) {
              done(err);
              return;
            }

            beforeLeft = numericCss(opened.$menu, "left");
            scrollViewport(gc, gc.getViewportScrollLeft() + delta);

            waitFor("common header menu to follow horizontal scroll", function () {
              return Math.abs(numericCss(opened.$menu, "left") - (beforeLeft - delta)) <= 1;
            }, function (err) {
              afterLeft = numericCss(opened.$menu, "left");

              ctx.set("commonFollowResult", {
                field: fieldId,
                delta: delta,
                menuDelta: afterLeft - beforeLeft,
                visible: opened.$menu.is(":visible"),
                texts: getDirectMenuTexts(opened.$menu)
              });

              closeAllMenus();
              scrollViewport(gc, 0);
              done(err);
            });
          });
        }
      },

      {
        type: "tests",
        name: "Common Header Scroll-Follow",
        tests: function (ctx) {
          var result = ctx.get("commonFollowResult");

          return [
            ["common header menu contains Add Column and Hide Column", function () {
              this.assert(result != null, "Expected common-header follow results");
              this.assert(result.texts.indexOf(label("add_column_label")) !== -1,
                "Expected Add Column in common-menu texts: " + JSON.stringify(result.texts));
              this.assert(result.texts.indexOf(label("hide_column_label")) !== -1,
                "Expected Hide Column in common-menu texts: " + JSON.stringify(result.texts));
            }],

            ["common header menu follows the viewport scroll delta", function () {
              this.assert(result.visible === true, "Expected the common menu to stay visible");
              this.assert(Math.abs(result.menuDelta + result.delta) <= 1,
                "Expected the menu to move left by " + result.delta + "px, got " + result.menuDelta + "px");
            }]
          ];
        }
      },

      {
        type: "custom",
        run: function (ctx, done) {
          var gc = getGc();
          var opened;
          var beforeLeft;

          closeAllMenus();
          scrollViewport(gc, 0);

          try {
            opened = openHeaderMenuForField("title", "first");
          } catch (err) {
            done(err);
            return;
          }

          waitFor("title header menu to become visible", function () {
            return opened.$menu.length > 0 && opened.$menu.is(":visible");
          }, function (err) {
            if (err) {
              done(err);
              return;
            }

            beforeLeft = numericCss(opened.$menu, "left");
            scrollViewport(gc, gc.getViewportScrollLeft() + 120);

            afterNextPaint(function () {
              var afterLeft = numericCss(opened.$menu, "left");

              ctx.set("titleFreezeResult", {
                delta: afterLeft - beforeLeft,
                visible: opened.$menu.is(":visible")
              });

              closeAllMenus();
              scrollViewport(gc, 0);
              done(null);
            });
          });
        }
      },

      {
        type: "tests",
        name: "Frozen Title Header Behavior",
        tests: function (ctx) {
          var result = ctx.get("titleFreezeResult");

          return [
            ["title header menu stays visible while horizontal scroll changes", function () {
              this.assert(result != null, "Expected frozen-title results");
              this.assert(result.visible === true, "Expected the title-header menu to remain visible");
            }],

            ["title header menu stays anchored when the title column is frozen", function () {
              this.assert(Math.abs(result.delta) <= 1,
                "Expected the frozen title menu to stay anchored, got left delta " + result.delta + "px");
            }]
          ];
        }
      },

      {
        type: "custom",
        run: function (ctx, done) {
          var gc = getGc();
          var $header = pickCommonHeaderForClose(gc);
          var opened;
          var fieldId = getHeaderField($header);
          var delta = calcCloseDelta(gc, $header);

          if (!$header.length || !fieldId) {
            done(new Error("Could not find a common header for the scroll-out close check"));
            return;
          }

          if (delta < 20) {
            done(new Error("Could not compute a scroll delta large enough to push a tracked header out of view"));
            return;
          }

          closeAllMenus();
          scrollViewport(gc, 0);

          try {
            opened = openHeaderMenuForField(fieldId, "common");
          } catch (err) {
            done(err);
            return;
          }

          waitFor("tracked common header menu to become visible", function () {
            return opened.$menu.length > 0 && opened.$menu.is(":visible");
          }, function (err) {
            if (err) {
              done(err);
              return;
            }

            scrollViewport(gc, gc.getViewportScrollLeft() + delta);

            waitFor("tracked common header menu to close after scrolling out of bounds", function () {
              return !opened.$menu.is(":visible");
            }, function (err) {
              ctx.set("commonCloseResult", {
                field: fieldId,
                delta: delta,
                closed: !opened.$menu.is(":visible")
              });

              closeAllMenus();
              scrollViewport(gc, 0);
              done(err);
            });
          });
        }
      },

      {
        type: "tests",
        name: "Tracked Header Close-On-Scroll-Out",
        tests: function (ctx) {
          var result = ctx.get("commonCloseResult");

          return [
            ["tracked common header menu closes when its target scrolls out of bounds", function () {
              this.assert(result != null, "Expected scroll-out close results");
              this.assert(result.closed === true,
                "Expected the menu on " + result.field + " to close after a " + result.delta + "px scroll");
            }]
          ];
        }
      },

      {
        type: "custom",
        run: function (ctx, done) {
          closeAllMenus();
          scrollViewport(getGc(), 0);
          ctx.setGridView(COMPACT_VIEW, done);
        }
      },

      {
        type: "guided",
        useBootbox: true,
        instruction: function () {
          return "The grid is now in a compact header view so there should be blank header space to the right of <b>" +
            escapeHtml(FIELDS.charlie.label) + "</b>.<br><br>" +
            "1. Right-click that empty header strip (not a column header).<br>" +
            "2. Hover the <b>" + escapeHtml(label("add_column_label")) + "</b> submenu.<br>" +
            "3. Type <b>Golf</b> into the search box.<br><br>" +
            "If you cannot see blank space, widen the desktop window a bit and keep the grid header row in view.";
        },
        buttonText: "I tested the empty-space Add Column menu"
      },

      {
        type: "manual-check",
        question: function () {
          return "Did the empty-space header menu stay open while you typed into the Add Column search box, and did the submenu narrow down to the MCM Golf field?";
        }
      },

      {
        type: "custom",
        run: function (ctx, done) {
          var opened;
          var $submenuParent;
          var $submenu;
          var $searchInput;

          closeAllMenus();
          scrollViewport(getGc(), 0);

          try {
            opened = openEmptySpaceMenu();
          } catch (err) {
            done(err);
            return;
          }

          waitFor("empty-space header menu to become visible", function () {
            return opened.$menu.length > 0 && opened.$menu.is(":visible");
          }, function (err) {
            if (err) {
              done(err);
              return;
            }

            $submenuParent = opened.$menu.find(".dropdown-submenu").first();
            if (!$submenuParent.length) {
              done(new Error("Expected Add Column submenu on the empty-space menu"));
              return;
            }

            openSubmenu($submenuParent);

            waitFor("Add Column search input to become available", function () {
              return opened.$menu.find(".grid-columns-search-input").length === 1;
            }, function (err) {
              var filteredTexts;
              var $targetAnchor;

              if (err) {
                done(err);
                return;
              }

              $submenu = findSubmenuBySearchInput(opened.$menu);
              $searchInput = opened.$menu.find(".grid-columns-search-input");

              $searchInput.val("Golf");
              $searchInput.trigger("input");

              waitFor("Add Column submenu to filter to MCM Golf", function () {
                var texts = getSubmenuTexts($submenu);
                return texts.length === 1 && texts[0] === FIELDS.golf.label;
              }, function (err) {
                if (err) {
                  done(err);
                  return;
                }

                filteredTexts = getSubmenuTexts($submenu);
                $targetAnchor = $submenu.children("li").not(":first").children("a").filter(function () {
                  return normalizeText($(this).text()) === FIELDS.golf.label;
                }).first();

                if (!$targetAnchor.length) {
                  done(new Error("Could not find the filtered MCM Golf submenu item"));
                  return;
                }

                $targetAnchor.trigger("mousedown");

                waitFor("MCM Golf field to be added to the grid view", function () {
                  return hasField(getGc(), FIELDS.golf.field_id);
                }, function (err) {
                  ctx.set("addColumnResult", {
                    filteredTexts: filteredTexts,
                    added: hasField(getGc(), FIELDS.golf.field_id),
                    stillMissing: missingFields(getGc()).indexOf(FIELDS.golf.field_id) !== -1
                  });

                  closeAllMenus();
                  done(err);
                });
              });
            });
          });
        }
      },

      {
        type: "tests",
        name: "Add Column Search / Filter / Add",
        tests: function (ctx) {
          var result = ctx.get("addColumnResult");

          return [
            ["Add Column search narrows the submenu to MCM Golf", function () {
              this.assert(result != null, "Expected Add Column results");
              this.assertEqual(JSON.stringify([FIELDS.golf.label]), JSON.stringify(result.filteredTexts),
                "Expected only MCM Golf after filtering, got " + JSON.stringify(result.filteredTexts));
            }],

            ["Selecting the filtered MCM Golf item adds the field to the current view", function () {
              this.assert(result.added === true, "Expected MCM Golf to be added to the view");
              this.assert(result.stillMissing === false, "Expected MCM Golf to stop appearing in fieldsMissingFromView()");
            }]
          ];
        }
      },

      {
        type: "guided",
        useBootbox: true,
        instruction: function () {
          return "Now test a <b>common header</b> action manually.<br><br>" +
            "Right-click the <b>" + escapeHtml(FIELDS.bravo.label) + "</b> header and choose <b>" +
            escapeHtml(label("hide_column_label")) + "</b>.";
        },
        buttonText: "I hid MCM Bravo"
      },

      {
        type: "manual-check",
        question: function () {
          return "Did the MCM Bravo header disappear immediately after you chose Hide Column?";
        }
      },

      {
        type: "tests",
        name: "Hide Column Result",
        tests: function (ctx) {
          var gc = getGc();

          return [
            ["MCM Bravo is removed from the current grid view", function () {
              this.assert(hasField(gc, FIELDS.bravo.field_id) === false,
                "Expected MCM Bravo to be removed from the current view");
            }],

            ["MCM Bravo returns to the missing-fields list after Hide Column", function () {
              this.assert(missingFields(gc).indexOf(FIELDS.bravo.field_id) !== -1,
                "Expected MCM Bravo to reappear in fieldsMissingFromView()");
            }]
          ];
        }
      },

      {
        type: "custom",
        run: function (ctx, done) {
          try {
            closeAllMenus();
            scrollViewport(getGc(), 0);
            done(null);
          } catch (err) {
            done(err);
          }
        }
      }
    ]
  });
})();
