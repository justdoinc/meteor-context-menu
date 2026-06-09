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

	function _getRootMenu($menu) {
		var $root = $menu.closest('.dropdown-context:not(.dropdown-context-sub)');

		if ($root.length > 0) {
			return $root;
		}

		return $menu;
	}

	function _clearKeyboardActiveState($menu) {
		$menu.find('li.active').removeClass('active');
	}

	function _resetMenuAfterHide($menu) {
		$menu
			.css({display: ''})
			.find('.dropdown-context-sub').css({display: ''});
		$menu.find('.drop-left').removeClass('drop-left');
		_clearKeyboardActiveState($menu);
	}

	function _hideContextMenus($menus, reason, opts) {
		if (!$menus || $menus.length === 0) {
			return;
		}

		_clearActiveScrollBinding();

		$menus.each(function () {
			var $menu = $(this),
				hideReason = reason || 'unknown';

			if (opts && opts.immediate === true) {
				$menu.hide();
				_resetMenuAfterHide($menu);
				$menu.trigger('context-menu-hidden', [{reason: hideReason}]);
				return;
			}

			$menu.fadeOut(options.fadeSpeed, function () {
				_resetMenuAfterHide($menu);
				$menu.trigger('context-menu-hidden', [{reason: hideReason}]);
			});
		});
	}

	function _isComposingKeyEvent(event) {
		var originalEvent = event.originalEvent;

		return event.isComposing === true ||
			(originalEvent && originalEvent.isComposing === true) ||
			event.which === 229 ||
			event.keyCode === 229;
	}

	function _getKeyboardEventName(event) {
		if (event.key === 'ArrowDown' || event.which === 40 || event.keyCode === 40) {
			return 'ArrowDown';
		}

		if (event.key === 'ArrowUp' || event.which === 38 || event.keyCode === 38) {
			return 'ArrowUp';
		}

		if (event.key === 'Enter' || event.which === 13 || event.keyCode === 13) {
			return 'Enter';
		}

		if (event.key === 'Escape' || event.key === 'Esc' || event.which === 27 || event.keyCode === 27) {
			return 'Escape';
		}

		if (event.key === 'Tab' || event.which === 9 || event.keyCode === 9) {
			return 'Tab';
		}

		return null;
	}

	function _getNavigationMenu($target) {
		return $target.closest('.dropdown-menu.dropdown-context');
	}

	function _getVisibleKeyboardNavigationMenus() {
		return $('.dropdown-context:not(.dropdown-context-sub):visible').filter(function () {
			return $(this).data('contextKeyboardNavigation') === true;
		});
	}

	function _isSelectableMenuItem($item) {
		var $action = $item.children('a.context-event:first');

		return $item.is(':visible') &&
			!$item.hasClass('nav-header') &&
			!$item.hasClass('divider') &&
			!$item.hasClass('disabled') &&
			$item.attr('aria-disabled') !== 'true' &&
			$action.length > 0 &&
			$action.is(':visible') &&
			!$action.hasClass('disabled') &&
			$action.attr('aria-disabled') !== 'true';
	}

	function _getSelectableMenuItems($menu) {
		return $menu.children('li').filter(function () {
			return _isSelectableMenuItem($(this));
		});
	}

	function _getActiveMenuItemIndex($items, $activeItem) {
		if ($activeItem.length === 0) {
			return -1;
		}

		for (var i = 0; i < $items.length; i++) {
			if ($items.get(i) === $activeItem.get(0)) {
				return i;
			}
		}

		return -1;
	}

	function _setActiveMenuItem($item) {
		var $rootMenu = _getRootMenu($item.closest('.dropdown-context'));

		_clearKeyboardActiveState($rootMenu);
		$item.addClass('active');
	}

	function _scrollActiveItemIntoView($menu, $item) {
		var menuNode = $menu.get(0),
			itemNode = $item.get(0),
			menuTop,
			menuBottom,
			itemTop,
			itemBottom;

		if (!menuNode || !itemNode) {
			return;
		}

		menuTop = menuNode.scrollTop;
		menuBottom = menuTop + $menu.innerHeight();
		itemTop = itemNode.offsetTop;
		itemBottom = itemTop + $item.outerHeight();

		if (itemTop < menuTop) {
			menuNode.scrollTop = itemTop;
		} else if (itemBottom > menuBottom) {
			menuNode.scrollTop = itemBottom - $menu.innerHeight();
		}
	}

	function _moveKeyboardActiveItem($menu, direction) {
		var $items = _getSelectableMenuItems($menu),
			$activeItem = $menu.children('li.active:first'),
			activeIndex = _getActiveMenuItemIndex($items, $activeItem),
			nextIndex;

		if ($items.length === 0) {
			return;
		}

		if (activeIndex === -1) {
			nextIndex = direction === 'down' ? 0 : $items.length - 1;
		} else if (direction === 'down') {
			nextIndex = Math.min(activeIndex + 1, $items.length - 1);
		} else {
			nextIndex = Math.max(activeIndex - 1, 0);
		}

		$activeItem = $items.eq(nextIndex);
		_setActiveMenuItem($activeItem);
		_scrollActiveItemIntoView($menu, $activeItem);
	}

	function _activateKeyboardActiveItem($menu) {
		var $activeItem = $menu.children('li.active:first'),
			$action = $activeItem.children('a.context-event:first');

		if ($action.length === 0) {
			return;
		}

		$action.trigger($.Event('mousedown', {which: 1}));
	}

	function _handleKeyboardNavigation(event) {
		var keyName,
			$menu;

		if (_isComposingKeyEvent(event)) {
			return;
		}

		keyName = _getKeyboardEventName(event);

		if (keyName === null || keyName === 'Tab') {
			return;
		}

		$menu = _getNavigationMenu($(event.target));

		if ($menu.length === 0 || !$menu.is(':visible')) {
			return;
		}

		if (keyName === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			_hideContextMenus($('.dropdown-context:not(.dropdown-context-sub):visible'), 'escape');
			return;
		}

		if (keyName === 'Enter') {
			event.preventDefault();
			event.stopPropagation();
			_activateKeyboardActiveItem($menu);
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		if (keyName === 'ArrowDown') {
			_moveKeyboardActiveItem($menu, 'down');
		} else if (keyName === 'ArrowUp') {
			_moveKeyboardActiveItem($menu, 'up');
		}
	}

	function _setupKeyboardNavigation($menu) {
		$menu.data('contextKeyboardNavigation', true);

		$menu
			.off('keydown.contextKeyboardNavigation')
			.on('keydown.contextKeyboardNavigation', _handleKeyboardNavigation);

		$menu
			.off('mouseenter.contextKeyboardNavigation', 'li')
			.on('mouseenter.contextKeyboardNavigation', 'li', function () {
				var $item = $(this),
					$rootMenu = _getRootMenu($item.closest('.dropdown-context'));

				_clearKeyboardActiveState($rootMenu);

				if (_isSelectableMenuItem($item)) {
					$item.addClass('active');
				}
			});
	}

	function _teardownKeyboardNavigation($menu) {
		$menu.removeData('contextKeyboardNavigation');
		$menu.off('keydown.contextKeyboardNavigation');
		$menu.off('mouseenter.contextKeyboardNavigation', 'li');
		_clearKeyboardActiveState($menu);
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
					_hideContextMenus($dd, 'scroll-out-of-view');
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

		$(document)
			.off('keydown.contextKeyboardNavigationGlobal')
			.on('keydown.contextKeyboardNavigationGlobal', function (event) {
				var $menus,
					keyName;

				if (_isComposingKeyEvent(event)) {
					return;
				}

				keyName = _getKeyboardEventName(event);

				if (keyName !== 'Escape') {
					return;
				}

				$menus = _getVisibleKeyboardNavigationMenus();

				if ($menus.length === 0) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				_hideContextMenus($menus, 'escape');
			});

		$(document).mousedown(function (e) {
			var is_menu_visible = $('.dropdown-context').is(":visible");

			if (is_menu_visible) {
				var is_submenu = $(e.target).closest('.dropdown-submenu').length > 0;

				if (!is_submenu) {
					_hideContextMenus($('.dropdown-context:not(.dropdown-context-sub):visible'), 'outside-click');
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
	    var linkTarget = '';
        for(var i = 0; i<data.length; i++) {
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
            $menu = $('#dropdown-' + id);
        } else {
            var d = new Date(),
                id = d.getTime(),
                $menu = buildMenu(data, id);
                $('body').append($menu);
        }

		if (data.keyboardNavigation === true) {
			_setupKeyboardNavigation($menu);
		} else {
			_teardownKeyboardNavigation($menu);
		}

        $(selector).on('contextmenu', function (e) {
            e.preventDefault();
            e.stopPropagation();

            currentContextSelector = $(this);
            try { currentBlazeContext = Blaze.getData(currentContextSelector.get(0));
            } catch (err) {}

			_hideContextMenus($('.dropdown-context:not(.dropdown-context-sub):visible'), 'new-context-menu', {immediate: true});

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
