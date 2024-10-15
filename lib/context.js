/*
 * Context.js
 * Copyright Jacob Kelley
 * MIT License
 *
 * Modified by Joshua Christman
 */

context = (function () {

    var options = {
        fadeSpeed: 100,
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
						$('.dropdown-context').css({display:''}).find('.drop-left').removeClass('drop-left');
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
				subWidth = $sub.width(),
				subLeft = $sub.offset().left,
				collision = (subWidth+subLeft) > window.innerWidth;
			if(collision){
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

            if (typeof options.above == 'boolean' && options.above) {
                $dd.addClass('dropdown-context-up').css({
                    top: e.pageY - 20 - $('#dropdown-' + id).height(),
                    left: e.pageX - 13
                }).fadeIn(options.fadeSpeed);
            } else if (typeof options.above == 'string' && options.above == 'auto') {
                $dd.removeClass('dropdown-context-up');
                var autoH = $dd.height() + 12;
                var left = e.pageX;

                var ref
                // if APP?.justdo_i18n?,isRtl()
                if (typeof APP !== "undefined" && APP !== null ? (ref = APP.justdo_i18n) != null ? ref.isRtl() : void 0 : void 0) {
                    left = left - $dd.width() + 13;
                } else {
                    left -= 13;
                }
                if ((e.pageY + autoH) > $('html').height()) {
                    $dd.addClass('dropdown-context-up').css({
                        top: e.pageY - 20 - autoH,
                        left: left
                    }).fadeIn(options.fadeSpeed);
                } else {
                    $dd.css({
                        top: e.pageY + 10,
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
                var autoL = $dd.width() - 12;
                if ((e.pageX + autoL) > $('html').width()) {
                    $dd.addClass('dropdown-context-left').css({
                        left: e.pageX - $dd.width() + 13
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
        destroy: destroyContext
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

currentContextSelector = undefined;
currentBlazeContext = undefined;
