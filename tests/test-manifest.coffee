TestManifest?.register "meteor-context-menu",
  configurations: [
    {
      id: "default"
      env:
        EXPECT_NO_BARRIER_DIRECTIVES: "true"
      mocha_tests: [
        "Meteor Context Menu Mobile Positioning"
        "Meteor Context Menu Submenu Collision Handling"
        "Meteor Context Menu Scroll Binding"
        "Meteor Context Menu Grid Header Desktop"
      ]
      primary: true
    }
  ]
  apps: ["web-app"]
