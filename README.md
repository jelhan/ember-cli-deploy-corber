# ember-cli-deploy-corber

[![Build Status](https://travis-ci.org/jelhan/ember-cli-deploy-corber.svg?branch=master)](https://travis-ci.org/jelhan/ember-cli-deploy-corber)

Plugin for ember-cli-deploy to build the project using [corber](http://corber.io/).

> This plugin is work in progress.
> It's only tested against android target platform so far.
> I would appreciate any feedback and pull requests.

## Installation

* `ember install ember-cli-deploy-corber`

## Usage

```
// config/deploy.js
module.exports = function(deployTarget) {
  let ENV = {
    build: {},
    corber: {
      platform: 'android'
    }
  };

  if (deployTarget === 'development') {
    ENV.build.environment = 'development';
    ENV.corber.enabled = false;
  }

  if (deployTarget === 'staging') {
    ENV.build.environment = 'production';
  }

  if (deployTarget === 'production') {
    ENV.build.environment = 'production';
    ENV.corber.release = true;
    ENV.corber.keystore = process.env.ANDROID_KEYSTORE;
    ENV.corber.storePassword = process.env.ANDROID_KEYSTORE_STORE_PASSWORD;
    ENV.corber.alias = process.env.ANDROID_KEYSTORE_ALIAS;
    ENV.corber.password = process.env.ANDROID_KEYSTORE_PASSWORD;
  }

  return ENV;
};
```

## Configuration

The plugin supports all options supported by `corber build`. Have a look at [corber docs](http://corber.io/pages/cli#build).

Additionally an `enabled` option controls if a corber build should be run. It defaults to `true`.

This plugin implements `didBuild` hook. If you run any modifications to generated web artifacts, make sure the modifications are executed before this plugin. Otherwise they won't effect corber builds. You should [customize plugin order](http://ember-cli-deploy.com/docs/v1.0.x/configuration/#advanced-plugin-configuration) if needed.

Cou could [include the plugin multiple times](http://ember-cli-deploy.com/docs/v1.0.x/including-a-plugin-twice/) to build for more than one platform.
