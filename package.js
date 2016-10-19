Package.describe({
    name: 'jchristman:context-menu',
    summary: 'Meteor package to wrap a bootstrap context menu',
    version: '1.2.0_1',
    git: 'https://github.com/jchristman/meteor-bootstrap-context-menu.git'
});

Package.onUse(function(api) {
    api.versionsFrom('METEOR@1.0');

    api.use("fourseven:scss@3.2.0", client);

    api.use('jquery');
    api.use('twbs:bootstrap@3.3.2'); // Need this for the glyphicons

    api.addFiles('lib/context.js','client');
    api.addFiles('lib/context.scss','client');

    api.export('context', 'client');
});
