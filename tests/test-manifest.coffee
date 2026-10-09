TestManifest?.register "meteor-context-menu",
  configurations: [
    {
      id: "default"
      batch_safe: false
      batch_reason: "Keyboard navigation tests change global context-menu settings without restoring them."
      env: {}
      mocha_tests: [
        "Meteor Context Menu - Keyboard Navigation"
      ]
      fixtures: []
      primary: true
    }
  ]
  apps: ["web-app"]
