/* eslint-env node */
'use strict';

const BasePlugin = require('ember-cli-deploy-plugin');
const Build = require('corber/lib/commands/build');
const getCordovaPath = require('corber/lib/targets/cordova/utils/get-path');
const { Promise } = require('rsvp');
const { dasherize } = require('ember-cli-string-utils');
const { copySync, readdirSync, removeSync } = require('fs-extra');

// path to cordova android build output folder relative to `corber/corodva` project folder
const ANDROID_BUILD_OUTPUT_PATH = '/platforms/android/build/outputs/apk/';

module.exports = {
  name: 'ember-cli-deploy-corber',

  createDeployPlugin: function(options) {
    let DeployPlugin = BasePlugin.extend({
      name: options.name,

      defaultConfig: {
        enabled: true
      },

      setup: function(context) {
        // Clear build output folder.
        // Since cordova does not provide any public api to retrieve build atrifacts, we retrieve them from content
        // in build output folder and therefore it must be empty.
        let buildOutputPath = this.getBuildOutputPath(context);
        if (buildOutputPath) {
          return removeSync(buildOutputPath);
        }
      },

      didBuild: function(context) {
        if (!this.readConfig('enabled')) {
          return;
        }

        return new Promise((resolve, reject) => {
          let cordovaOutputPath = getCordovaPath(context.project).concat('/www');
          let buildArgs = this.getBuildArgs();
          let buildOutputPath = this.getBuildOutputPath(context);
          let platform = this.readConfig('platform');

          // cordova requires web artifacts to be in cordova's `www` sub directory
          this.log(`Copying framework build to ${cordovaOutputPath}`, { verbose: true });
          copySync(context.distDir, cordovaOutputPath);

          this.log(`Running: corber build ${buildArgs.join(' ')}`, { verbose: true });
          let build = new Build({
            ui: context.ui,
            project: context.project,
            settings: {}
          });
          return build.validateAndRun(buildArgs).then(() => {
            this.log('Corber build okay', { verbose: true });

            let buildArtifacts;
            if (buildOutputPath) {
              buildArtifacts = readdirSync(buildOutputPath).map((filename) => {
                return buildOutputPath.concat(filename);
              });
            }

            if (!Array.isArray(buildArtifacts) || buildArtifacts.length === 0) {
              this.log('Could not capture any build artifacts', { color: 'red' });
              resolve();
            }

            this.log(`Build artifacts: ${buildArtifacts.join(', ')}`, { verbose: true });

            // add build artifacts to context
            let additionalContext = {
              corber: {}
            };

            if (context.corber && Array.isArray(context.corber[platform])) {
              additionalContext.corber[platform] = context.corber[platform].concat(buildArtifacts);
            } else {
              additionalContext.corber[platform] = buildArtifacts;
            }

            resolve(additionalContext);
          }).catch(reject);
        });
      },

      getBuildArgs: function() {
        let ignoredOptions = ['enabled'];
        let pluginOptions = this.pluginConfig;
        let verbose = this.context.commandOptions.verbose;

        let args = Object.keys(pluginOptions).filter(pluginOption => {
          return ignoredOptions.indexOf(pluginOption) === -1;
        }).map(pluginOption => {
          let value = this.readConfig(pluginOption);
          let arg = `--${dasherize(pluginOption)}`;

          if (value === true) {
            return arg;
          }

          return `${arg}=${value}`;
        });

        args.push('--skip-framework-build');
        args.push('--add-cordova-js');
        if (!verbose) {
          args.push('--quiet');
        }

        return args;
      },

      getBuildOutputPath: function(context) {
        let platform = this.readConfig('platform');
        let projectPath = context.project;
        let cordovaPath = getCordovaPath(projectPath);

        switch (platform) {
          case 'android':
            return cordovaPath.concat(ANDROID_BUILD_OUTPUT_PATH);

          default:
            this.log('Adding build artifacts to ember-cli-build context is ' +
                     `not supported yet for platform ${platform}`, { color: 'red' });
            return;
        }
      }
    });

    return new DeployPlugin();
  }
};
