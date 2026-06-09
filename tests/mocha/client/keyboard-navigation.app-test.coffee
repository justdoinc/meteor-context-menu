{expect} = require "chai"

describe "Meteor Context Menu - Keyboard Navigation", ->
  @timeout 5000

  sequence = 0
  created_menu_ids = []
  context_initialized = false

  getContextMenu = ->
    return Package["jchristman:context-menu"].context

  ensureContextInitialized = ->
    return if context_initialized

    getContextMenu().init({})
    context_initialized = true
    return

  makeInputHeader = ->
    return {
      header: """<input class="context-keyboard-test-input" type="text">"""
    }

  makeAction = (text, calls) ->
    return {
      text: text
      action: ->
        calls.push text
        return
    }

  makeMenu = (options={}) ->
    sequence += 1
    id = "context-keyboard-test-#{sequence}"
    calls = options.calls or []
    menu_data = options.data or [
      makeInputHeader()
      makeAction("Alpha", calls)
      makeAction("Beta", calls)
      makeAction("Gamma", calls)
    ]

    getContextMenu().settings
      fadeSpeed: 0
      above: "auto"
      left: "auto"
      filter: ->
        return

    $target = $("<button class='context-keyboard-test-target'>Target</button>").appendTo("body")

    attach_options =
      id: id
      data: menu_data
      keyboardNavigation: options.keyboardNavigation is true

    if options.scrollContainer?
      attach_options.scrollContainer = options.scrollContainer

    if options.onScrollContainerScroll?
      attach_options.onScrollContainerScroll = options.onScrollContainerScroll

    getContextMenu().attach $target, attach_options

    $target.trigger $.Event("contextmenu",
      pageX: 20
      pageY: 20
    )

    $menu = $("#dropdown-#{id}")
    $menu.show()
    created_menu_ids.push id

    return {
      calls: calls
      id: id
      $input: $menu.find(".context-keyboard-test-input:first")
      $menu: $menu
      $target: $target
    }

  triggerKey = ($element, key, key_code, options={}) ->
    event = $.Event "keydown",
      key: key
      which: key_code
      keyCode: key_code

    event.isComposing = true if options.is_composing

    $element.trigger(event)

    return event

  activeText = ($menu) ->
    return $.trim($menu.children("li.active:first").children("a:first").text())

  activeCount = ($menu) ->
    return $menu.find("li.active").length

  afterEach ->
    $(".context-keyboard-test-target").remove()
    $(".context-keyboard-test-outside").remove()
    $(".context-keyboard-test-scroll").remove()
    for id in created_menu_ids
      $("#dropdown-#{id}").remove()
    created_menu_ids = []
    return

  it "does nothing when keyboardNavigation is not enabled", ->
    {$menu, $input} = makeMenu()

    triggerKey($input, "ArrowDown", 40)

    expect(activeCount($menu)).to.equal 0

    return

  it "highlights the first visible action item on ArrowDown", ->
    {$menu, $input} = makeMenu keyboardNavigation: true

    triggerKey($input, "ArrowDown", 40)

    expect(activeText($menu)).to.equal "Alpha"

    return

  it "highlights the last visible action item on ArrowUp", ->
    {$menu, $input} = makeMenu keyboardNavigation: true

    triggerKey($input, "ArrowUp", 38)

    expect(activeText($menu)).to.equal "Gamma"

    return

  it "skips headers, dividers, disabled rows, hidden rows, and non-action labels", ->
    calls = []
    menu_data = [
      makeInputHeader()
      {header: "Section"}
      {divider: true}
      makeAction("Disabled", calls)
      makeAction("Hidden", calls)
      {text: "Label Only"}
      makeAction("Selectable", calls)
    ]
    {$menu, $input} = makeMenu
      keyboardNavigation: true
      calls: calls
      data: menu_data

    $menu.children("li").eq(3).addClass("disabled")
    $menu.children("li").eq(4).hide()

    triggerKey($input, "ArrowDown", 40)
    triggerKey($input, "Enter", 13)

    expect(activeText($menu)).to.equal "Selectable"
    expect(calls).to.deep.equal ["Selectable"]

    return

  it "does nothing visibly when there are no selectable items", ->
    menu_data = [
      makeInputHeader()
      {header: "Section"}
      {divider: true}
      {text: "Label Only"}
    ]
    {$menu, $input} = makeMenu
      keyboardNavigation: true
      data: menu_data

    triggerKey($input, "ArrowDown", 40)
    triggerKey($input, "ArrowUp", 38)

    expect(activeCount($menu)).to.equal 0

    return

  it "moves through items and clamps at the first and last selectable rows", ->
    {$menu, $input} = makeMenu keyboardNavigation: true

    triggerKey($input, "ArrowDown", 40)
    triggerKey($input, "ArrowDown", 40)
    triggerKey($input, "ArrowDown", 40)
    triggerKey($input, "ArrowDown", 40)

    expect(activeText($menu)).to.equal "Gamma"

    triggerKey($input, "ArrowUp", 38)
    triggerKey($input, "ArrowUp", 38)
    triggerKey($input, "ArrowUp", 38)
    triggerKey($input, "ArrowUp", 38)

    expect(activeText($menu)).to.equal "Alpha"

    return

  it "invokes the highlighted action exactly once on Enter", ->
    {$menu, $input, calls} = makeMenu keyboardNavigation: true

    triggerKey($input, "ArrowDown", 40)
    triggerKey($input, "Enter", 13)

    expect(activeText($menu)).to.equal "Alpha"
    expect(calls).to.deep.equal ["Alpha"]

    return

  it "activates Enter through the same mousedown lifecycle as mouse selection", ->
    ensureContextInitialized()

    calls = []
    activation_events = []
    menu_data = [
      makeInputHeader()
      {
        text: "Alpha"
        action: (e, $target) ->
          calls.push "Alpha"
          activation_events.push
            type: e.type
            which: e.which
            target_text: $.trim($target.text())
          return
      }
    ]
    {$menu, $input} = makeMenu
      keyboardNavigation: true
      calls: calls
      data: menu_data
    hidden_details = null

    $menu.on "context-menu-hidden", (e, details) ->
      hidden_details = details
      return

    triggerKey($input, "ArrowDown", 40)
    triggerKey($input, "Enter", 13)

    await TestAsync.waitUntil
      description: "context menu hidden after Enter action mousedown"
      predicate: ->
        return hidden_details?

    expect(calls).to.deep.equal ["Alpha"]
    expect(activation_events).to.deep.equal [
      {
        type: "mousedown"
        which: 1
        target_text: "Target"
      }
    ]
    expect(hidden_details.reason).to.equal "outside-click"
    expect($menu.is(":visible")).to.equal false

    return

  it "does nothing on Enter when no item is highlighted", ->
    {$input, calls} = makeMenu keyboardNavigation: true

    triggerKey($input, "Enter", 13)

    expect(calls).to.deep.equal []

    return

  it "ignores Tab so normal focus movement can continue", ->
    {$menu, $input} = makeMenu keyboardNavigation: true

    event = triggerKey($input, "Tab", 9)

    expect(activeCount($menu)).to.equal 0
    expect(event.isDefaultPrevented()).to.equal false

    return

  it "hides the menu on Escape after Tab moves focus outside the menu", ->
    ensureContextInitialized()

    {$menu, $input} = makeMenu keyboardNavigation: true
    hidden_details = null
    $outside = $("<button class='context-keyboard-test-outside'>Outside</button>").appendTo("body")

    $menu.on "context-menu-hidden", (e, details) ->
      hidden_details = details
      return

    triggerKey($input, "Tab", 9)
    $outside.focus()
    triggerKey($outside, "Escape", 27)

    await TestAsync.waitUntil
      description: "context menu hidden after outside-focus Escape"
      predicate: ->
        return hidden_details?

    expect(hidden_details.reason).to.equal "escape"
    expect($menu.is(":visible")).to.equal false

    $outside.remove()

    return

  it "hides the menu and emits context-menu-hidden on Escape", ->
    {$menu, $input} = makeMenu keyboardNavigation: true
    hidden_details = null

    $menu.on "context-menu-hidden", (e, details) ->
      hidden_details = details
      return

    triggerKey($input, "Escape", 27)

    await TestAsync.waitUntil
      description: "context menu hidden event"
      predicate: ->
        return hidden_details?

    expect(hidden_details.reason).to.equal "escape"
    expect($menu.is(":visible")).to.equal false

    return

  it "hides the menu and emits context-menu-hidden on outside click", ->
    ensureContextInitialized()

    {$menu} = makeMenu keyboardNavigation: true
    hidden_details = null
    $outside = $("<button class='context-keyboard-test-outside'>Outside</button>").appendTo("body")

    $menu.on "context-menu-hidden", (e, details) ->
      hidden_details = details
      return

    $outside.trigger("mousedown")

    await TestAsync.waitUntil
      description: "outside-click context menu hidden event"
      predicate: ->
        return hidden_details?

    expect(hidden_details.reason).to.equal "outside-click"
    expect($menu.is(":visible")).to.equal false

    $outside.remove()

    return

  it "hides the menu and emits context-menu-hidden when scroll closes it", ->
    $scrollContainer = $("<div class='context-keyboard-test-scroll'></div>").appendTo("body")
    hidden_details = null
    {$menu} = makeMenu
      keyboardNavigation: true
      scrollContainer: $scrollContainer
      onScrollContainerScroll: ->
        return false

    $menu.on "context-menu-hidden", (e, details) ->
      hidden_details = details
      return

    $scrollContainer.trigger("scroll")

    await TestAsync.waitUntil
      description: "scroll-out-of-view context menu hidden event"
      predicate: ->
        return hidden_details?

    expect(hidden_details.reason).to.equal "scroll-out-of-view"
    expect($menu.is(":visible")).to.equal false

    $scrollContainer.remove()

    return

  it "emits context-menu-hidden when a new context menu opens over a visible menu", ->
    first_menu = makeMenu keyboardNavigation: true
    hidden_details = null

    first_menu.$menu.on "context-menu-hidden", (e, details) ->
      hidden_details = details
      return

    second_menu = makeMenu keyboardNavigation: true

    expect(hidden_details?.reason).to.equal "new-context-menu"
    expect(first_menu.$menu.is(":visible")).to.equal false
    expect(second_menu.$menu.is(":visible")).to.equal true

    return

  it "ignores composing key events", ->
    {$menu, $input} = makeMenu keyboardNavigation: true

    triggerKey($input, "ArrowDown", 40, is_composing: true)

    expect(activeCount($menu)).to.equal 0

    return

  it "starts from current visible items when the active DOM row was removed", ->
    {$menu, $input} = makeMenu keyboardNavigation: true

    triggerKey($input, "ArrowDown", 40)
    $menu.children("li.active:first").remove()
    triggerKey($input, "ArrowDown", 40)

    expect(activeText($menu)).to.equal "Beta"

    return

  it "scrolls the highlighted item into view inside long menus", ->
    calls = []
    menu_data = [makeInputHeader()]

    for index in [1..20]
      menu_data.push makeAction("Item #{index}", calls)

    {$menu, $input} = makeMenu
      keyboardNavigation: true
      data: menu_data

    $menu.css
      height: "40px"
      overflow: "auto"

    for index in [1..20]
      triggerKey($input, "ArrowDown", 40)

    expect(activeText($menu)).to.equal "Item 20"
    expect($menu.scrollTop()).to.be.above 0

    return

  it "keeps mouse hover and keyboard highlight in the same active state", ->
    {$menu, $input} = makeMenu keyboardNavigation: true

    triggerKey($input, "ArrowDown", 40)
    $menu.children("li").eq(2).trigger("mouseenter")

    expect(activeText($menu)).to.equal "Beta"

    return

  it "clears keyboard highlight when mouse enters a non-action submenu row", ->
    calls = []
    menu_data = [
      makeInputHeader()
      makeAction("Alpha", calls)
      {
        text: "More"
        subMenu: [
          makeAction("Nested", calls)
        ]
      }
    ]
    {$menu, $input} = makeMenu
      keyboardNavigation: true
      calls: calls
      data: menu_data

    triggerKey($input, "ArrowDown", 40)
    $menu.children("li").eq(2).trigger("mouseenter")

    expect(activeCount($menu)).to.equal 0

    return
