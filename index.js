/* eslint-env node */
'use strict';

const BasePlugin = require('ember-cli-deploy-plugin');
const Build = require('corber/lib/commands/build');
const Promise = require('rsvp').Promise;
const cordovaPath = require('corber/lib/targets/cordova/utils/get-path');
const dasherize = require('ember-cli-string-utils').dasherize;
const cordovaEvents = require('cordova-common').events;
const fs = require('fs-extra');

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
          fs.copySync(context.distDir, cordovaOutputPath);

          // capture build artifacts
          // Cordova does not support any public api to retrieve build atrifacts.
          // Have to use platform specific hacks.
          let buildArtifacts;
          switch (platform) {
            case 'android':
              cordovaEvents.on('log', function(message) {
                if (message.includes('Built the following apk(s): \n\t')) {
                  buildArtifacts = message.split('\n\t').slice(1);
                }
              });
              break;

            default:
              this.log('Adding build artifacts to ember-cli-build context is ' +
                       `not supported yet for platform ${platform}`, { color: 'red' });
          }

          this.log(`Running: corber build ${buildArgs.join(' ')}`, { verbose: true });
          let build = new Build({
            ui: context.ui,
            project: context.project,
            settings: {}
          });
          return build.validateAndRun(buildArgs).then(() => {
            this.log('Corber build okay', { verbose: true });
            if (Array.isArray(buildArtifacts)) {
              this.log(`Build artifacts: ${buildArtifacts.join(', ')}`, { verbose: true });
            } else {
              this.log('Could not capture any build artifacts', { color: 'red' });
            }

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
