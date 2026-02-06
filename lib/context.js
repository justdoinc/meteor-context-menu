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

	function initialize(opts) {

		options = $.extend({}, options, opts);

		$(document).mousedown(function (e) {
			var is_menu_visible = $('.dropdown-context').is(":visible");

			if (is_menu_visible) {
				var is_submenu = $(e.target).closest('.dropdown-submenu').length > 0;

				if (!is_submenu) {
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
			var $sub = $(this).find('.dropdown-context-sub:first'),
				rtl = isRtl();
			// Reset previous flipping FIRST, then force reflow before reading position
			$sub.removeClass('drop-left');
			$sub[0].offsetWidth; // Force browser reflow
			
			var subWidth = $sub.width(),
				subLeft = $sub.offset().left;
			
			if (rtl) {
				// RTL mode: submenus open to the LEFT by default (via CSS right:100%)
				// Check for collision with left edge of screen
				if (subLeft < 0) {
					// Not enough room on left, flip to open to the RIGHT
					$sub.addClass('drop-left');
				}
			} else {
				// LTR mode: submenus open to the RIGHT by default (via CSS left:100%)
				// Check for collision with right edge of screen
				if ((subWidth + subLeft) > window.innerWidth) {
					// Not enough room on right, flip to open to the LEFT
					$sub.addClass('drop-left');
				}
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

            if (typeof options.above == 'boolean' && options.above) {
                $dd.addClass('dropdown-context-up').css({
                    top: e.pageY - CONSTANTS.VERTICAL_OFFSET_ABOVE - $('#dropdown-' + id).height(),
                    left: e.pageX - CONSTANTS.HORIZONTAL_OFFSET
                }).fadeIn(options.fadeSpeed);
            } else if (typeof options.above == 'string' && options.above == 'auto') {
                $dd.removeClass('dropdown-context-up');
                var autoH = $dd.height() + CONSTANTS.HEIGHT_BUFFER;
                var left = e.pageX;

                if (rtl) {
                    left = left - $dd.width() + CONSTANTS.HORIZONTAL_OFFSET;
                } else {
                    left -= CONSTANTS.HORIZONTAL_OFFSET;
                }
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
        });
    }

    function destroyContext(selector) {
        $(selector).off('contextmenu');
    }

    return {
        init: initialize,
        settings: updateOptions,
        attach: addContext,
        buildMenu: buildMenu,
        destroy: destroyContext,
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

currentContextSelector = undefined;
currentBlazeContext = undefined;
