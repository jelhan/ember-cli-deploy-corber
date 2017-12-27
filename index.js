/* eslint-env node */
'use strict';

const BasePlugin = require('ember-cli-deploy-plugin');
const Build = require('corber/lib/commands/build');
const cordovaPath = require('corber/lib/targets/cordova/utils/get-path');
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

      didBuild: function(context) {
        if (!this.readConfig('enabled')) {
          return;
        }

        return new Promise((resolve, reject) => {
          let platform = this.readConfig('platform');
          let cordovaOutputPath = cordovaPath(context.project).concat('/www');
          let buildArgs = this.getBuildArgs();

          // cordova requires web artifacts to be in cordova's `www` sub directory
          this.log(`Copying framework build to ${cordovaOutputPath}`, { verbose: true });
          copySync(context.distDir, cordovaOutputPath);

          // Clear build output folder.
          // Since cordova does not provide any public api to retrieve build atrifacts, we retrieve them from content
          // in build output folder.
          let buildOutputPath;
          switch (platform) {
            case 'android':
              buildOutputPath = cordovaPath(context.project).concat(ANDROID_BUILD_OUTPUT_PATH);
              break;

            default:
              this.log('Adding build artifacts to ember-cli-build context is ' +
                       `not supported yet for platform ${platform}`, { color: 'red' });
          }
          if (buildOutputPath) {
            removeSync(buildOutputPath);
          }

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
            let context = {
              corber: {}
            };
            context.corber[platform] = buildArtifacts;
            resolve(context);
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
      }
    });

    return new DeployPlugin();
  }
};
