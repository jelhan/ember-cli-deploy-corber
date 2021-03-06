/* eslint-env node */
'use strict';

const BasePlugin = require('ember-cli-deploy-plugin');
const Build = require('corber/lib/commands/build');
const getCordovaPath = require('corber/lib/targets/cordova/utils/get-path');
const { Promise } = require('rsvp');
const { dasherize } = require('ember-cli-string-utils');
const { copySync, readdirSync, remove } = require('fs-extra');

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
        return new Promise((resolve, reject) => {
          // Clear build output folder.
          // Since cordova does not provide any public api to retrieve build atrifacts, we retrieve them from content
          // in build output folder and therefore it must be empty.
          let buildOutputPath = this.getBuildOutputPath(context);

          if (!buildOutputPath) {
            // resolve immediately if build output path for this platform is unknown
            resolve();
          }

          remove(buildOutputPath, (err) => {
            if (err) {
              this.log(`Failed to clear build output at ${buildOutputPath}.`, { color: 'red' });
              this.log(err, { color: 'red' });
              reject();
            }

            resolve();
          });
        });
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

          // corber changes log level of context.ui passed in if called with `--quiet` flag
          // store current log level to reset it afterwards
          let logLevel = this.getLogLevel(context.ui);

          this.log(`Running: corber build ${buildArgs.join(' ')}`, { verbose: true });
          let build = new Build({
            ui: context.ui,
            project: context.project,
            settings: {}
          });
          return build.validateAndRun(buildArgs).then(() => {
            // reset log level which got changed by corber called with `--quiet` flag
            context.ui.setWriteLevel(logLevel);

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
        args.push('--quiet');

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
      },

      getLogLevel: function(ui) {
        // console-ui does not provide any public api to retrieve current log log level
        // guess it by wirteLevelVisible method
        let logLevels = [
          'DEBUG',
          'INFO',
          'WARNING',
          'ERROR'
        ];
        let currentLogLevel = logLevels.find((logLevel) => {
          return ui.writeLevelVisible(logLevel);
        });

        if (!currentLogLevel) {
          this.log('Could not guess current log level. Using ERROR as fallback.', { color: 'red' });
          return 'ERROR';
        }

        return currentLogLevel;
      }
    });

    return new DeployPlugin();
  }
};
