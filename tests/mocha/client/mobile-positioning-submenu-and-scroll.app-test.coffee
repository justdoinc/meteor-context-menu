{expect} = require "chai"

context = null
restore_stack = []
active_nodes = []
jquery_restore = null
unique_id_counter = 0
context_initialized = false

pushRestore = (fn) ->
  restore_stack.push fn
  return

getElement = (target) ->
  if target?.jquery
    return target.get 0

  return target

setMetrics = (target, metrics = {}) ->
  element = getElement target
  return target unless element?

  if metrics.left? or metrics.top?
    element.__contextMenuTestOffset =
      left: metrics.left or 0
      top: metrics.top or 0

  if metrics.outerWidth?
    element.__contextMenuTestOuterWidth = metrics.outerWidth

  if metrics.width?
    element.__contextMenuTestWidth = metrics.width
    element.style?.setProperty "width", "#{metrics.width}px"

  if metrics.height?
    element.__contextMenuTestHeight = metrics.height
    element.style?.setProperty "height", "#{metrics.height}px"

  if metrics.innerWidth?
    element.__contextMenuTestInnerWidth = metrics.innerWidth

  if metrics.scrollLeft?
    element.__contextMenuTestScrollLeft = metrics.scrollLeft

  return target

appendNode = (node) ->
  document.body.appendChild node
  active_nodes.push node
  return node

stub = (obj, key, value) ->
  original = obj[key]
  obj[key] = value

  pushRestore ->
    obj[key] = original
    return

  return value

stubProperty = (obj, key, value) ->
  original_descriptor = Object.getOwnPropertyDescriptor obj, key

  Object.defineProperty obj, key,
    configurable: true
    writable: true
    value: value

  pushRestore ->
    if original_descriptor?
      Object.defineProperty obj, key, original_descriptor
    else
      delete obj[key]
    return

  return value

ensureAppNamespace = (key) ->
  unless window.APP?
    stubProperty window, "APP", {}

  unless APP[key]?
    stubProperty APP, key, {}

  return APP[key]

stubIsMobileLayout = (value) ->
  stub ensureAppNamespace("justdo_pwa"), "isMobileLayout", -> value

stubIsRtl = (value) ->
  stub ensureAppNamespace("justdo_i18n"), "isRtl", -> value

setHtmlMetrics = ({width, height}) ->
  setMetrics document.documentElement,
    width: width
    height: height
  return

nextId = (prefix) ->
  unique_id_counter += 1
  return "#{prefix}-#{unique_id_counter}"

createTarget = ({left = 0, top = 0, width = 80, height = 24} = {}) ->
  target = document.createElement "div"
  target.id = nextId "context-menu-target"
  target.className = "meteor-context-menu-test-target"
  target.style.cssText = "position: absolute; left: #{left}px; top: #{top}px; width: #{width}px; height: #{height}px;"

  appendNode target
  setMetrics target,
    left: left
    top: top
    outerWidth: width
    width: width
    height: height

  return $(target)

createScrollContainer = ({left = 0, top = 0, width = 220, height = 40, scrollLeft = 0} = {}) ->
  container = document.createElement "div"
  container.className = "context-scroll-container"
  container.style.cssText = "position: absolute; left: #{left}px; top: #{top}px; width: #{width}px; height: #{height}px; overflow: auto;"

  filler = document.createElement "div"
  filler.style.cssText = "width: 1200px; height: 20px;"
  container.appendChild filler

  appendNode container
  setMetrics container,
    left: left
    top: top
    outerWidth: width
    width: width
    innerWidth: width
    height: height
    scrollLeft: scrollLeft

  return $(container)

openMenu = ({target, pageX, pageY, menuWidth = 120, menuHeight = 40, menuData = null, menuId = null}) ->
  resolved_menu_id = menuId or nextId "test-menu"

  resolved_menu_data =
    id: resolved_menu_id
    data: [{text: "Open", action: -> return}]

  if menuData?
    resolved_menu_data = _.extend resolved_menu_data, menuData

  context.attach target, resolved_menu_data

  $menu = $("#dropdown-#{resolved_menu_id}")
  setMenuDimensions $menu,
    width: menuWidth
    height: menuHeight

  target.trigger $.Event "contextmenu",
    pageX: pageX
    pageY: pageY

  return {menuId: resolved_menu_id, $menu}

setMenuDimensions = ($menu, {width, height}) ->
  setMetrics $menu,
    outerWidth: width
    width: width
    height: height

  $menu.css
    width: "#{width}px"
    height: "#{height}px"

  return $menu

buildSubmenuHarness = ({mobileLayout, rtl, parentLeft, parentWidth, submenuWidth, windowWidth}) ->
  stubIsMobileLayout mobileLayout
  stubIsRtl rtl
  stubProperty window, "innerWidth", windowWidth

  $menu = context.buildMenu [
    {
      text: "Parent"
      subMenu: [
        {
          text: "Child"
          action: -> return
        }
      ]
    }
  ], nextId("submenu-menu")

  appendNode $menu.get(0)
  $menu.show()

  $submenu_item = $menu.find(".dropdown-submenu").first()
  $submenu = $submenu_item.find(".dropdown-context-sub").first()

  setMetrics $submenu_item,
    left: parentLeft
    top: 0
    outerWidth: parentWidth
    width: parentWidth
    height: 24

  setMetrics $submenu,
    outerWidth: submenuWidth
    width: submenuWidth
    height: 24

  $submenu_item.css width: "#{parentWidth}px"
  $submenu.css width: "#{submenuWidth}px"
  $submenu_item.trigger "mouseenter"

  return {$submenu_item, $submenu}

installJqueryHarness = ->
  originals =
    fadeIn: $.fn.fadeIn
    fadeOut: $.fn.fadeOut
    offset: $.fn.offset
    outerWidth: $.fn.outerWidth
    width: $.fn.width
    height: $.fn.height
    innerWidth: $.fn.innerWidth
    scrollLeft: $.fn.scrollLeft

  $.fn.fadeIn = ->
    callback = _.find arguments, (arg) -> typeof arg is "function"
    @show()
    @each ->
      callback?.call this
      return
    return @

  $.fn.fadeOut = ->
    callback = _.find arguments, (arg) -> typeof arg is "function"
    @hide()
    @each ->
      callback?.call this
      return
    return @

  $.fn.offset = ->
    element = @get 0
    if element?.__contextMenuTestOffset?
      return _.clone element.__contextMenuTestOffset

    return originals.offset.apply @, arguments

  $.fn.outerWidth = ->
    element = @get 0
    if element?.__contextMenuTestOuterWidth?
      return element.__contextMenuTestOuterWidth

    return originals.outerWidth.apply @, arguments

  $.fn.width = ->
    if arguments.length > 0
      return originals.width.apply @, arguments

    element = @get 0
    if element?.__contextMenuTestWidth?
      return element.__contextMenuTestWidth

    if element?.__contextMenuTestOuterWidth?
      return element.__contextMenuTestOuterWidth

    return originals.width.apply @, arguments

  $.fn.height = ->
    if arguments.length > 0
      return originals.height.apply @, arguments

    element = @get 0
    if element?.__contextMenuTestHeight?
      return element.__contextMenuTestHeight

    return originals.height.apply @, arguments

  $.fn.innerWidth = ->
    element = @get 0
    if element?.__contextMenuTestInnerWidth?
      return element.__contextMenuTestInnerWidth

    if element?.__contextMenuTestWidth?
      return element.__contextMenuTestWidth

    return originals.innerWidth.apply @, arguments

  $.fn.scrollLeft = (value) ->
    element = @get 0

    unless element?
      return if value? then @ else 0

    if value?
      if element.__contextMenuTestScrollLeft? or $(element).hasClass("context-scroll-container")
        element.__contextMenuTestScrollLeft = value
        return @

      return originals.scrollLeft.apply @, arguments

    if element.__contextMenuTestScrollLeft?
      return element.__contextMenuTestScrollLeft

    return originals.scrollLeft.apply @, arguments

  return ->
    for own method_name, method of originals
      $.fn[method_name] = method
    return

registerSharedHarness = ->
  before ->
    context = Package["jchristman:context-menu"]?.context or window.context
    expect(context?.init).to.be.a "function"
    jquery_restore = installJqueryHarness()

    unless context_initialized
      context.init
        fadeSpeed: 0
        preventDoubleContext: false
      context_initialized = true
    return

  beforeEach ->
    context.settings
      fadeSpeed: 0
      filter: ($obj) -> return
      above: "auto"
      left: "auto"
      preventDoubleContext: false
      compress: false

    setHtmlMetrics
      width: 400
      height: 240
    return

  afterEach ->
    context.clearScrollBinding()
    $(".dropdown-context").remove()

    while active_nodes.length > 0
      node = active_nodes.pop()
      node.parentNode?.removeChild node

    while restore_stack.length > 0
      restore_stack.pop()()
    return

  after ->
    jquery_restore?()
    jquery_restore = null
    return

  return

describe "Meteor Context Menu Mobile Positioning", ->
  registerSharedHarness()

  it "should fall back to desktop overflow positioning when APP.justdo_pwa is absent", ->
    target = createTarget
      left: 36
      top: 12
      width: 80

    stubIsRtl false
    if window.APP?
      stubProperty APP, "justdo_pwa", undefined
    setHtmlMetrics
      width: 240
      height: 120

    {$menu} = openMenu
      target: target
      pageX: 100
      pageY: 100
      menuWidth: 80
      menuHeight: 40

    expect($menu.hasClass("dropdown-context-up")).to.equal true
    expect(parseFloat($menu.css("top"))).to.equal 28
    expect(parseFloat($menu.css("left"))).to.equal 87
    return

  it "should anchor the menu to the target start edge in mobile LTR and skip dropdown-context-left", ->
    target = createTarget
      left: 14
      top: 18
      width: 60

    stubIsMobileLayout true
    stubIsRtl false
    setHtmlMetrics
      width: 120
      height: 220

    {$menu} = openMenu
      target: target
      pageX: 116
      pageY: 80
      menuWidth: 50
      menuHeight: 30

    expect(parseFloat($menu.css("left"))).to.equal 14
    expect(parseFloat($menu.css("top"))).to.equal 90
    expect($menu.hasClass("dropdown-context-left")).to.equal false
    expect($menu.hasClass("dropdown-context-up")).to.equal false
    return

  it "should anchor the menu to the target start edge in mobile RTL", ->
    target = createTarget
      left: 40
      top: 10
      width: 70

    stubIsMobileLayout true
    stubIsRtl true

    {$menu} = openMenu
      target: target
      pageX: 20
      pageY: 64
      menuWidth: 50
      menuHeight: 32

    expect(parseFloat($menu.css("left"))).to.equal 60
    expect(parseFloat($menu.css("top"))).to.equal 74
    return

  it "should always open downward in mobile layout even when bottom overflow would occur", ->
    target = createTarget
      left: 24
      top: 8
      width: 72

    stubIsMobileLayout true
    stubIsRtl false
    setHtmlMetrics
      width: 220
      height: 120

    {$menu} = openMenu
      target: target
      pageX: 160
      pageY: 100
      menuWidth: 80
      menuHeight: 40

    expect($menu.hasClass("dropdown-context-up")).to.equal false
    expect(parseFloat($menu.css("top"))).to.equal 110
    return

describe "Meteor Context Menu Submenu Collision Handling", ->
  registerSharedHarness()

  it "should add drop-left for a mobile LTR submenu when the left side has more free space", ->
    {$submenu} = buildSubmenuHarness
      mobileLayout: true
      rtl: false
      parentLeft: 80
      parentWidth: 40
      submenuWidth: 30
      windowWidth: 140

    expect($submenu.hasClass("drop-left")).to.equal true
    return

  it "should leave drop-left off for a mobile LTR submenu when the right side has more free space", ->
    {$submenu} = buildSubmenuHarness
      mobileLayout: true
      rtl: false
      parentLeft: 20
      parentWidth: 40
      submenuWidth: 30
      windowWidth: 140

    expect($submenu.hasClass("drop-left")).to.equal false
    return

  it "should add drop-left for a mobile RTL submenu when the right side has more free space", ->
    {$submenu} = buildSubmenuHarness
      mobileLayout: true
      rtl: true
      parentLeft: 20
      parentWidth: 40
      submenuWidth: 30
      windowWidth: 140

    expect($submenu.hasClass("drop-left")).to.equal true
    return

  it "should add drop-left for a desktop LTR submenu when opening right would overflow", ->
    {$submenu} = buildSubmenuHarness
      mobileLayout: false
      rtl: false
      parentLeft: 90
      parentWidth: 40
      submenuWidth: 30
      windowWidth: 140

    expect($submenu.hasClass("drop-left")).to.equal true
    return

  it "should add drop-left for a desktop RTL submenu when opening left would overflow", ->
    {$submenu} = buildSubmenuHarness
      mobileLayout: false
      rtl: true
      parentLeft: 10
      parentWidth: 40
      submenuWidth: 30
      windowWidth: 140

    expect($submenu.hasClass("drop-left")).to.equal true
    return

describe "Meteor Context Menu Scroll Binding", ->
  registerSharedHarness()

  it "should move the dropdown by the scroll delta when scrollContainer is provided through context.attach", ->
    target = createTarget
      left: 30
      top: 14
      width: 80

    $scroll_container = createScrollContainer scrollLeft: 10
    stubIsMobileLayout false
    stubIsRtl false

    {$menu} = openMenu
      target: target
      pageX: 120
      pageY: 70
      menuWidth: 80
      menuHeight: 30
      menuData:
        scrollContainer: $scroll_container

    initial_left = parseFloat $menu.css "left"
    $scroll_container.scrollLeft 35
    $scroll_container.trigger "scroll"

    expect(parseFloat($menu.css("left"))).to.equal initial_left - 25
    return

  it "should keep the dropdown fixed when onScrollContainerScroll returns freeze", ->
    target = createTarget
      left: 24
      top: 10
      width: 70

    $scroll_container = createScrollContainer scrollLeft: 0
    callback_calls = 0

    {$menu} = openMenu
      target: target
      pageX: 90
      pageY: 60
      menuWidth: 84
      menuHeight: 30
      menuData:
        scrollContainer: $scroll_container
        onScrollContainerScroll: ->
          callback_calls += 1
          return "freeze"

    initial_left = parseFloat $menu.css "left"
    $scroll_container.scrollLeft 40
    $scroll_container.trigger "scroll"

    expect(callback_calls).to.equal 1
    expect(parseFloat($menu.css("left"))).to.equal initial_left
    return

  it "should hide the dropdown and clear the binding when onScrollContainerScroll returns false", ->
    target = createTarget
      left: 28
      top: 18
      width: 60

    $scroll_container = createScrollContainer scrollLeft: 0
    callback_calls = 0

    {$menu} = openMenu
      target: target
      pageX: 100
      pageY: 68
      menuWidth: 80
      menuHeight: 34
      menuData:
        scrollContainer: $scroll_container
        onScrollContainerScroll: ->
          callback_calls += 1
          return false

    left_after_open = parseFloat $menu.css "left"
    $scroll_container.scrollLeft 25
    $scroll_container.trigger "scroll"

    expect(callback_calls).to.equal 1
    expect($menu.is(":visible")).to.equal false
    expect(parseFloat($menu.css("left"))).to.equal left_after_open

    $scroll_container.scrollLeft 40
    $scroll_container.trigger "scroll"

    expect(callback_calls).to.equal 1
    return

  it "should clear the active binding when the user clicks outside the menu", ->
    target = createTarget
      left: 32
      top: 18
      width: 72

    $scroll_container = createScrollContainer scrollLeft: 0
    callback_calls = 0

    {$menu} = openMenu
      target: target
      pageX: 110
      pageY: 62
      menuWidth: 90
      menuHeight: 34
      menuData:
        scrollContainer: $scroll_container
        onScrollContainerScroll: ->
          callback_calls += 1
          return true

    left_before_close = parseFloat $menu.css "left"
    $(document.body).trigger "mousedown"

    expect($menu.is(":visible")).to.equal false

    $scroll_container.scrollLeft 30
    $scroll_container.trigger "scroll"

    expect(callback_calls).to.equal 0
    expect(parseFloat($menu.css("left"))).to.equal left_before_close
    return
