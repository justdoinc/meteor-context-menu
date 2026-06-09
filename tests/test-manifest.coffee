TestManifest?.register "meteor-context-menu",
  configurations: [
    {
      id: "default"
      env: {}
      mocha_tests: [
        "Meteor Context Menu - Keyboard Navigation"
      ]
      fixtures: []
      primary: true
    }
  ]
  apps: ["web-app"]
