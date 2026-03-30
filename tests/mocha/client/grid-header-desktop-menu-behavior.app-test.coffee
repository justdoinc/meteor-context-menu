{expect} = require "chai"

describe "Meteor Context Menu Grid Header Desktop", ->
  @timeout 10000

  restore_stack = []
  active_hosts = []
  menu_seq = 0
  context_initialized = false
  context_api = null

  stub = (obj, key, value) ->
    original = obj[key]
    obj[key] = value
    restore_stack.push ->
      obj[key] = original
      return
    return value

  ensureNamespace = (root, key) ->
    return root[key] if root[key]?

    root[key] = {}
    restore_stack.push ->
      delete root[key]
      return

    return root[key]

  getContextApi = ->
    return window.context if window.context?.init?
    return Package["jchristman:context-menu"]?.context if Package["jchristman:context-menu"]?.context?.init?
    return null

  stubHtmlHeight = (height_px) ->
    original_height = $.fn.height

    $.fn.height = ->
      if arguments.length is 0 and @length is 1 and @get(0) is document.documentElement
        return height_px
      return original_height.apply(this, arguments)

    restore_stack.push ->
      $.fn.height = original_height
      return

    return

  buildHost = (opts = {}) ->
    host = document.createElement "div"
    host.className = "meteor-context-menu-test-host"
    host.style.cssText = """
      position: relative;
      width: #{opts.width or 2000}px;
      height: #{opts.height or 400}px;
      margin: 0;
      padding: 0;
      overflow: visible;
      z-index: 1;
    """

    document.body.appendChild host
    active_hosts.push host

    return $(host)

  buildHarness = (opts = {}) ->
    $host = buildHost
      width: opts.host_width
      height: opts.host_height

    $parent = $host
    $viewport = $()

    if opts.scrollable
      viewport = document.createElement "div"
      viewport.className = "slick-viewport meteor-context-menu-test-viewport"
      viewport.style.cssText = """
        position: relative;
        width: #{opts.viewport_width or 320}px;
        height: #{opts.viewport_height or 80}px;
        overflow-x: auto;
        overflow-y: hidden;
        border: 0;
      """

      track = document.createElement "div"
      track.className = "meteor-context-menu-test-track"
      track.style.cssText = """
        position: relative;
        width: #{opts.track_width or 1400}px;
        height: #{opts.track_height or 80}px;
      """

      viewport.appendChild track
      $host.append viewport
      $viewport = $(viewport)
      $parent = $(track)

    header = document.createElement "div"
    header.className = "slick-header-column meteor-context-menu-test-target"
    header.textContent = opts.label or "Grid Header"
    header.style.cssText = """
      position: absolute;
      left: #{opts.left or 0}px;
      top: #{opts.top or 0}px;
      width: #{opts.header_width or 160}px;
      height: #{opts.header_height or 28}px;
      padding: 4px 8px;
      box-sizing: border-box;
      background: #f3f4f6;
      border: 1px solid #cbd5e1;
      white-space: nowrap;
    """

    $header = $(header)
    $header.data "column",
      field: opts.field or "grid-field"

    $parent.append header

    return {$host, $viewport, $header}

  buildMenuData = (opts = {}) ->
    menu_items = []

    if opts.tall_menu
      for idx in [1..12]
        menu_items.push
          text: "Desktop Item #{idx}"
          action: -> return
    else
      menu_items.push
        text: "Inspect"
        action: -> return

      menu_items.push
        text: "Rename"
        action: -> return

    menu_items.push
      text: "Add Column"
      subMenu: [
        {
          text: opts.submenu_text or "A fairly wide submenu option for collision testing"
          action: -> return
        }
        {
          text: "Another submenu option"
          action: -> return
        }
      ]

    return menu_items

  attachMenu = ($header, opts = {}) ->
    menu_seq += 1
    menu_id = opts.menu_id or "meteor-context-menu-test-#{menu_seq}"

    context_api.attach $header,
      id: menu_id
      data: opts.menu_data or buildMenuData(opts)
      scrollContainer: opts.scroll_container
      onScrollContainerScroll: opts.on_scroll

    return menu_id

  getMenu = (menu_id) ->
    return $("#dropdown-#{menu_id}")

  openMenu = ($header, menu_id, opts = {}) ->
    header_offset = $header.offset()
    page_x = opts.page_x
    page_y = opts.page_y

    page_x ?= header_offset.left + Math.floor($header.outerWidth() / 2)
    page_y ?= header_offset.top + Math.floor($header.outerHeight() / 2)

    event = $.Event "contextmenu",
      pageX: page_x
      pageY: page_y

    $header.trigger event

    return getMenu(menu_id)

  waitFor = (description, predicate) ->
    await TestAsync.waitUntil
      description: description
      timeout_ms: 1000
      interval_ms: 10
      predicate: predicate

  waitForVisibility = ($el, expected_visibility) ->
    await waitFor "element visibility to become #{expected_visibility}", ->
      $el.is(":visible") is expected_visibility

  numericCss = ($el, property_name) ->
    value = parseFloat($el.css(property_name))
    return 0 if isNaN(value)
    return value

  prepareSubmenuForMeasurement = ($menu, width_px = 220) ->
    $submenu_parent = $menu.find(".dropdown-submenu").first()
    $submenu = $submenu_parent.children(".dropdown-context-sub").first()

    $submenu.css
      display: "block"
      visibility: "hidden"
      width: "#{width_px}px"

    return {$submenu_parent, $submenu}

  dispatchSubmenuMouseover = ($submenu_parent) ->
    event = new MouseEvent "mouseover",
      bubbles: true
      cancelable: true
      view: window

    $submenu_parent.get(0).dispatchEvent event
    return

  closeMenus = ->
    context_api?.clearScrollBinding()
    $(".dropdown-context").stop(true, true).remove()
    return

  before ->
    context_api = getContextApi()
    throw new Error "Expected jchristman:context-menu export to be available" unless context_api?

    unless context_initialized
      context_api.init
        fadeSpeed: 0
      context_initialized = true
    return

  beforeEach ->
    app = ensureNamespace window, "APP"
    justdo_pwa = ensureNamespace app, "justdo_pwa"
    justdo_i18n = ensureNamespace app, "justdo_i18n"

    stub justdo_pwa, "isMobileLayout", -> false
    stub justdo_i18n, "isRtl", -> false

    document.documentElement.classList.remove "right-to-left"

    context_api.settings
      fadeSpeed: 0
      filter: ($obj) -> return
      above: "auto"
      left: "auto"
      preventDoubleContext: true
      compress: false
    return

  afterEach ->
    closeMenus()

    while active_hosts.length > 0
      host = active_hosts.pop()
      host.parentNode?.removeChild host

    while restore_stack.length > 0
      restore_stack.pop()()

    document.documentElement.classList.remove "right-to-left"
    return

  it "should anchor desktop grid header menus to the cursor and open downward when space allows", ->
    stubHtmlHeight 1200

    {$header} = buildHarness
      left: 240
      top: 24

    menu_id = attachMenu $header
    header_offset = $header.offset()
    page_x = header_offset.left + 92
    page_y = header_offset.top + 12
    $menu = openMenu $header, menu_id, {page_x, page_y}

    await waitForVisibility $menu, true

    expect($menu.hasClass("dropdown-context-up")).to.equal false
    expect(numericCss($menu, "top")).to.be.closeTo page_y + context_api.CONSTANTS.VERTICAL_OFFSET_BELOW, 0.5
    expect(numericCss($menu, "left")).to.be.closeTo page_x - context_api.CONSTANTS.HORIZONTAL_OFFSET, 0.5
    expect(Math.abs(numericCss($menu, "left") - header_offset.left)).to.be.greaterThan 20
    return

  it "should open upward for desktop grid headers when the menu would overflow below the document", ->
    stubHtmlHeight 420

    {$header} = buildHarness
      left: 180
      top: 24

    menu_id = attachMenu $header,
      tall_menu: true

    page_x = $header.offset().left + 60
    page_y = 415
    $menu = openMenu $header, menu_id, {page_x, page_y}

    await waitForVisibility $menu, true

    expected_top = page_y - context_api.CONSTANTS.VERTICAL_OFFSET_ABOVE - ($menu.height() + context_api.CONSTANTS.HEIGHT_BUFFER)

    expect($menu.hasClass("dropdown-context-up")).to.equal true
    expect(numericCss($menu, "top")).to.be.closeTo expected_top, 0.5
    expect(numericCss($menu, "left")).to.be.closeTo page_x - context_api.CONSTANTS.HORIZONTAL_OFFSET, 0.5
    return

  it "should flip the desktop grid header menu left when the cursor is near the right edge", ->
    {$header} = buildHarness
      left: 80
      top: 24

    menu_id = attachMenu $header
    page_x = $("html").width() - 5
    page_y = $header.offset().top + 10
    $menu = openMenu $header, menu_id, {page_x, page_y}

    await waitForVisibility $menu, true

    expected_left = page_x - $menu.outerWidth() + context_api.CONSTANTS.HORIZONTAL_OFFSET

    expect($menu.hasClass("dropdown-context-left")).to.equal true
    expect(numericCss($menu, "left")).to.be.closeTo expected_left, 0.5
    return

  it "should keep the Add Column submenu on its default side when there is enough room on desktop", ->
    {$header} = buildHarness
      left: 40
      top: 24

    menu_id = attachMenu $header
    $menu = openMenu $header, menu_id,
      page_x: $header.offset().left + 20
      page_y: $header.offset().top + 10

    await waitForVisibility $menu, true

    {$submenu_parent, $submenu} = prepareSubmenuForMeasurement $menu
    dispatchSubmenuMouseover $submenu_parent

    expect($submenu.hasClass("drop-left")).to.equal false
    return

  it "should flip the Add Column submenu away from the viewport edge on desktop", ->
    {$header} = buildHarness
      left: Math.max(0, window.innerWidth - 230)
      top: 24
      header_width: 190

    menu_id = attachMenu $header
    $menu = openMenu $header, menu_id,
      page_x: $header.offset().left + 20
      page_y: $header.offset().top + 10

    await waitForVisibility $menu, true

    {$submenu_parent, $submenu} = prepareSubmenuForMeasurement $menu
    dispatchSubmenuMouseover $submenu_parent

    expect($submenu.hasClass("drop-left")).to.equal true
    return

  it "should follow horizontal grid header scrolling by the same delta on desktop", ->
    {$viewport, $header} = buildHarness
      scrollable: true
      viewport_width: 320
      left: 260
      top: 18
      host_height: 120

    menu_id = attachMenu $header,
      scroll_container: $viewport

    $menu = openMenu $header, menu_id,
      page_x: $header.offset().left + 40
      page_y: $header.offset().top + 10

    await waitForVisibility $menu, true

    initial_left = numericCss($menu, "left")
    $viewport.scrollLeft 90
    $viewport.trigger "scroll"

    expect(numericCss($menu, "left")).to.equal initial_left - 90
    return

  it "should keep the menu anchored when the grid header scroll callback returns freeze", ->
    {$viewport, $header} = buildHarness
      scrollable: true
      viewport_width: 320
      left: 260
      top: 18
      host_height: 120

    menu_id = attachMenu $header,
      scroll_container: $viewport
      on_scroll: -> "freeze"

    $menu = openMenu $header, menu_id,
      page_x: $header.offset().left + 40
      page_y: $header.offset().top + 10

    await waitForVisibility $menu, true

    initial_left = numericCss($menu, "left")
    $viewport.scrollLeft 120
    $viewport.trigger "scroll"

    expect(numericCss($menu, "left")).to.equal initial_left
    expect($menu.is(":visible")).to.equal true
    return

  it "should close the menu when the tracked grid header scroll callback returns false", ->
    {$viewport, $header} = buildHarness
      scrollable: true
      viewport_width: 320
      left: 260
      top: 18
      host_height: 120

    menu_id = attachMenu $header,
      scroll_container: $viewport
      on_scroll: -> false

    $menu = openMenu $header, menu_id,
      page_x: $header.offset().left + 40
      page_y: $header.offset().top + 10

    await waitForVisibility $menu, true

    $viewport.scrollLeft 120
    $viewport.trigger "scroll"

    await waitForVisibility $menu, false

    expect($menu.is(":visible")).to.equal false
    return
