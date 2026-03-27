/*
 * Context.js
 * Copyright Jacob Kelley
 * MIT License
 *
 * Modified by Joshua Christman
 */

context = (function () {

    // Positioning constants - exposed via context.CONSTANTS for external use
    var CONSTANTS = {
        FADE_SPEED_MS: 100,           // Duration of fadeIn/fadeOut animation
        HORIZONTAL_OFFSET: 13,        // Horizontal offset from cursor
        HEIGHT_BUFFER: 12,            // Extra height buffer for boundary detection
        VERTICAL_OFFSET_ABOVE: 20,    // Vertical offset when menu appears above cursor
        VERTICAL_OFFSET_BELOW: 10     // Vertical offset when menu appears below cursor
    };

    var options = {
        fadeSpeed: CONSTANTS.FADE_SPEED_MS,
        filter: function ($obj) {
            // Modify $obj, Do not return
        },
        above: 'auto',
        left: 'auto',
		preventDoubleContext: true,
		compress: false
	};

	// Tracks the currently visible dropdown and its scroll binding so we can
	// update the dropdown position when the scroll container scrolls horizontally.
	var _activeScrollBinding = null;

	function _clearActiveScrollBinding() {
		if (_activeScrollBinding) {
			_activeScrollBinding.scrollContainer.off('scroll.contextDropdown');
			_activeScrollBinding = null;
		}
	}

	function _setupScrollBinding($dd, $scrollContainer, onScroll) {
		var initialScrollLeft = $scrollContainer.scrollLeft();
		var initialMenuLeft = parseFloat($dd.css('left'));

		$scrollContainer.on('scroll.contextDropdown', function () {
			// If an onScroll callback is provided, invoke it to decide
			// how to handle this scroll event:
			//   false    – target scrolled out of the visible area → close dropdown
			//   "freeze" – target is a frozen column (doesn't scroll) → keep
			//              the dropdown visible without adjusting its position
			//   other    – adjust dropdown position to follow the scroll
			if (typeof onScroll === 'function') {
				var result = onScroll();
				if (result === false) {
					_clearActiveScrollBinding();
					$dd.fadeOut(options.fadeSpeed, function () {
						$(this).css({display: ''}).find('.drop-left').removeClass('drop-left');
					});
					return;
				}
				if (result === 'freeze') {
					return;
				}
			}

			var delta = $scrollContainer.scrollLeft() - initialScrollLeft;
			$dd.css('left', initialMenuLeft - delta);
		});

		_activeScrollBinding = {
			scrollContainer: $scrollContainer
		};
	}

	function initialize(opts) {

		options = $.extend({}, options, opts);

		$(document).mousedown(function (e) {
			var is_menu_visible = $('.dropdown-context').is(":visible");

			if (is_menu_visible) {
				var is_submenu = $(e.target).closest('.dropdown-submenu').length > 0;

				if (!is_submenu) {
					_clearActiveScrollBinding();
					$('.dropdown-context').fadeOut(options.fadeSpeed, function() {
						$(this).css({display:''}).find('.drop-left').removeClass('drop-left');
					});
				}
			};
		});
		if(options.preventDoubleContext){
			$(document).on('contextmenu', '.dropdown-context', function (e) {
				e.preventDefault();
			});
		}
		$(document).on('mouseenter', '.dropdown-submenu', function(){
			var $this = $(this),
				$sub = $this.find('.dropdown-context-sub:first'),
				rtl = isRtl();

			// Reset previous flipping to ensure clean state
			$sub.removeClass('drop-left');

			var parentLeft = $this.offset().left,
				parentRight = parentLeft + $this.outerWidth(),
				shouldFlip;

			if (isMobileLayout()) {
				// Mobile layout: open submenu toward whichever side has more free space
				var freeSpaceLeft = parentLeft,
					freeSpaceRight = window.innerWidth - parentRight;

				if (rtl) {
					// RTL: default opens LEFT, flip to RIGHT if more space on right
					shouldFlip = freeSpaceRight > freeSpaceLeft;
				} else {
					// LTR: default opens RIGHT, flip to LEFT if more space on left
					shouldFlip = freeSpaceLeft > freeSpaceRight;
				}
			} else {
				// Desktop: detect overflow against window edge
				if (rtl) {
					// RTL: submenus open LEFT by default, check left edge
					shouldFlip = (parentLeft - $sub.outerWidth()) < 0;
				} else {
					// LTR: submenus open RIGHT by default, check right edge
					shouldFlip = (parentRight + $sub.outerWidth()) > window.innerWidth;
				}
			}

			if (shouldFlip) {
				$sub.addClass('drop-left');
			}
		});

	}

	function updateOptions(opts){
		options = $.extend({}, options, opts);
	}

	function buildMenu(data, id, subMenu) {
		var subClass = (subMenu) ? ' dropdown-context-sub' : '',
			compressed = options.compress ? ' compressed-context' : '',
			$menu = $('<ul class="dropdown-menu dropdown-context' + subClass + compressed +'" id="dropdown-' + id + '"></ul>');

        return buildMenuItems($menu, data, id, subMenu);
	}

    function buildMenuItems($menu, data, id, subMenu, addDynamicTag) {
        for(var i = 0; i<data.length; i++) {
            var linkTarget = '';
            if (typeof data[i].divider !== 'undefined') {
                var divider = '<li class="divider';
                divider += (addDynamicTag) ? ' dynamic-menu-item' : '';
                divider += '"></li>';
                $menu.append(divider);
            } else if (typeof data[i].header !== 'undefined') {
                var header = '<li class="nav-header';
                header += (addDynamicTag) ? ' dynamic-menu-item' : '';
                header += '">' + data[i].header + '</li>';
                $menu.append(header);
            } else if (typeof data[i].menu_item_src !== 'undefined') {
                var funcName;
                if (typeof data[i].menu_item_src === 'function') {
                    if (data[i].menu_item_src.name === "") { // The function is declared like "foo = function() {}"
                        for (var globalVar in window) {
                            if (data[i].menu_item_src == window[globalVar]) {
                                funcName = globalVar;
                                break;
                            }
                        }
                    } else {
                        funcName = data[i].menu_item_src.name;
                    }
                } else {
                    funcName = data[i].menu_item_src;
                }
                $menu.append('<li class="dynamic-menu-src" data-src="' + funcName + '"></li>');
            } else {
                if (typeof data[i].target !== 'undefined') {
                    linkTarget = ' target="'+data[i].target+'"';
                }
                if (typeof data[i].subMenu !== 'undefined') {
                    var sub_menu = '<li class="dropdown-submenu';
                    sub_menu += (addDynamicTag) ? ' dynamic-menu-item' : '';
                    sub_menu += '"><a tabindex="-1"';
                    if (typeof data[i].href !== 'undefined') {
                        sub_menu += ' href="' + data[i].href + '"';
                    }
                    sub_menu += '>' + data[i].text + '</a></li>';
                    $sub = (sub_menu);
                } else {
                    var element = '<li';
                    element += (addDynamicTag) ? ' class="dynamic-menu-item"' : '';
                    element += '><a tabindex="-1" ';
                    if (typeof data[i].href !== 'undefined') {
                        element += 'href="' + data[i].href + '" ';
                    }
                    element += linkTarget+' style="cursor: pointer">';
                    if (typeof data[i].icon !== 'undefined')
                        element += '<span class="glyphicon ' + data[i].icon + '"></span> ';
                    element += data[i].text + '</a></li>';
                    $sub = $(element);
                }
                if (typeof data[i].action !== 'undefined') {
                    $action = data[i].action;
					$sub
						.find('a')
						.addClass('context-event')
						.mousedown(createCallback($action));
				}
				$menu.append($sub);
				if (typeof data[i].subMenu != 'undefined') {
					var subMenuData = buildMenu(data[i].subMenu, id, true);
					$menu.find('li:last').append(subMenuData);
				}
			}
			if (typeof options.filter == 'function') {
				options.filter($menu.find('li:last'));
			}
		}
        return $menu;
    }

    function addContext(selector, data) {
        if (typeof data.id !== 'undefined' && typeof data.data !== 'undefined') {
            var id = data.id;
            $menu = $('body').find('#dropdown-' + id)[0];
            if (typeof $menu === 'undefined') {
                $menu = buildMenu(data.data, id);
                $('body').append($menu);
            }
        } else {
            var d = new Date(),
                id = d.getTime(),
                $menu = buildMenu(data, id);
                $('body').append($menu);
        }

        $(selector).on('contextmenu', function (e) {
            e.preventDefault();
            e.stopPropagation();

            currentContextSelector = $(this);
            try { currentBlazeContext = Blaze.getData(currentContextSelector.get(0));
            } catch (err) {}

			$('.dropdown-context:not(.dropdown-context-sub)').hide();

            $dd = $('#dropdown-' + id);

            $dd.find('.dynamic-menu-item').remove(); // Destroy any old dynamic menu items
            $dd.find('.dynamic-menu-src').each(function(idx, element) {
                var menuItems = executeFunctionByName($(element).data('src'), window, currentContextSelector, currentBlazeContext);
                $parentMenu = $(element).closest('.dropdown-menu.dropdown-context');
                $parentMenu = buildMenuItems($parentMenu, menuItems, id, undefined, true);
            });

            var rtl = isRtl();
            var mobileLayout = isMobileLayout();

            if (typeof options.above == 'boolean' && options.above) {
                $dd.addClass('dropdown-context-up').css({
                    top: e.pageY - CONSTANTS.VERTICAL_OFFSET_ABOVE - $('#dropdown-' + id).height(),
                    left: e.pageX - CONSTANTS.HORIZONTAL_OFFSET
                }).fadeIn(options.fadeSpeed);
            } else if (typeof options.above == 'string' && options.above == 'auto') {
                $dd.removeClass('dropdown-context-up');
                var autoH = $dd.height() + CONSTANTS.HEIGHT_BUFFER;
                var left;

                if (mobileLayout) {
                    // Mobile layout: position at the start edge of the column header element
                    var elOffset = currentContextSelector.offset();
                    if (rtl) {
                        // RTL: align menu's right edge with column header's right edge
                        left = elOffset.left + currentContextSelector.outerWidth() - $dd.outerWidth();
                    } else {
                        // LTR: align menu's left edge with column header's left edge
                        left = elOffset.left;
                    }
                } else {
                    left = e.pageX;
                    if (rtl) {
                        left = left - $dd.width() + CONSTANTS.HORIZONTAL_OFFSET;
                    } else {
                        left -= CONSTANTS.HORIZONTAL_OFFSET;
                    }
                }
                if (mobileLayout) {
                    // Mobile layout: always show menu downward
                    $dd.css({
                        top: e.pageY + CONSTANTS.VERTICAL_OFFSET_BELOW,
                        left: left
                    }).fadeIn(options.fadeSpeed);
                } else {
                    var wouldOverflowBottom = (e.pageY + autoH) > $('html').height();
                    var topPosition = e.pageY - CONSTANTS.VERTICAL_OFFSET_ABOVE - autoH;
                    var wouldOverflowTop = topPosition < $(window).scrollTop();

                    if (wouldOverflowBottom && !wouldOverflowTop) {
                        $dd.addClass('dropdown-context-up').css({
                            top: topPosition,
                            left: left
                        }).fadeIn(options.fadeSpeed);
                    } else {
                        $dd.css({
                            top: e.pageY + CONSTANTS.VERTICAL_OFFSET_BELOW,
                            left: left
                        }).fadeIn(options.fadeSpeed);
                    }
                }
            }

            // Skip edge overflow detection on mobile layout since the menu is
            // anchored to the column header edge rather than the cursor position.
            if (!mobileLayout) {
                if (typeof options.left == 'boolean' && options.left) {
                    $dd.addClass('dropdown-context-left').css({
                        left: e.pageX - $dd.width()
                    }).fadeIn(options.fadeSpeed);
                } else if (typeof options.left == 'string' && options.left == 'auto') {
                    $dd.removeClass('dropdown-context-left');
                    var autoL = $dd.width() - CONSTANTS.HEIGHT_BUFFER;
                    var shouldDropLeft = (e.pageX + autoL) > $('html').width();
                    var left = e.pageX - $dd.width() + CONSTANTS.HORIZONTAL_OFFSET;
                    if (rtl) {
                        shouldDropLeft = (e.pageX - autoL) < 0;
                        left = e.pageX - CONSTANTS.HORIZONTAL_OFFSET;
                    }
                    if (shouldDropLeft) {
                        $dd.addClass('dropdown-context-left').css({
                            left: left
                        });
                    }
                }
            }

            // Bind horizontal scroll tracking so the dropdown follows its parent
            // element when the scroll container scrolls.
            _clearActiveScrollBinding();
            if (typeof data.scrollContainer !== 'undefined') {
                var scrollCallback = null;
                if (typeof data.onScrollContainerScroll === 'function') {
                    // Capture the target element at the time the menu is shown so
                    // the callback can check its current position on each scroll.
                    var $capturedTarget = currentContextSelector;
                    scrollCallback = function () {
                        return data.onScrollContainerScroll($dd, $capturedTarget);
                    };
                }
                _setupScrollBinding($dd, $(data.scrollContainer), scrollCallback);
            }
        });
    }

    function destroyContext(selector) {
        $(selector).off('contextmenu');
    }

    /**
     * Bind a scroll container to a visible dropdown so it follows its parent
     * element during horizontal scrolling. Call this after manually showing a
     * dropdown (e.g. via showContextMenuAtPosition) when the dropdown is not
     * created through context.attach with a scrollContainer option.
     *
     * @param {string} menuId - The dropdown id (without the "dropdown-" prefix)
     * @param {jQuery} $scrollContainer - The scrollable ancestor element
     * @param {Function} [onScroll] - Optional callback invoked on each scroll.
     *        Return false to close the dropdown (e.g. target scrolled out of view).
     */
    function bindScrollContainer(menuId, $scrollContainer, onScroll) {
        _clearActiveScrollBinding();
        var $dd = $('#dropdown-' + menuId);
        if ($dd.length > 0 && $scrollContainer.length > 0) {
            _setupScrollBinding($dd, $scrollContainer, onScroll);
        }
    }

    return {
        init: initialize,
        settings: updateOptions,
        attach: addContext,
        buildMenu: buildMenu,
        destroy: destroyContext,
        bindScrollContainer: bindScrollContainer,
        clearScrollBinding: _clearActiveScrollBinding,
        CONSTANTS: CONSTANTS
    };
})();

var createCallback = function(func) {
    return function(event) { func(event, currentContextSelector, currentBlazeContext) };
}

function executeFunctionByName(functionName, context /*, args */) {
    var args = [].slice.call(arguments).splice(2);
    var namespaces = functionName.split(".");
    var func = namespaces.pop();
    for(var i = 0; i < namespaces.length; i++) {
        context = context[namespaces[i]];
    }
    return context[func].apply(this, args);
}

function isRtl() {
    var ref;
    return typeof APP !== "undefined" && APP !== null ? (ref = APP.justdo_i18n) != null ? ref.isRtl() : false : false;
}

function isMobileLayout() {
    var ref;
    return typeof APP !== "undefined" && APP !== null ? (ref = APP.justdo_pwa) != null ? ref.isMobileLayout() : false : false;
}

currentContextSelector = undefined;
currentBlazeContext = undefined;
