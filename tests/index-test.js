/*eslint-env node*/
'use strict';

const Promise = require('rsvp').Promise;
const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const td = require('testdouble');

describe('corber plugin', function() {
  let context;
  let subject;

  before(function() {
    subject = require('../index');
  });

  beforeEach(function() {
    context = {
      commandOptions: {
      },
      config: {
        corber: {
          enabled: true,
        },
      },
      distDir: 'path/to/dist/dir',
      project: {
        root: 'path/to/project/root',
      },
      ui: {
        write: function() {
        },
        writeLine: function() {
        },
      },
    };
  });

  it('has a name', function() {
    let plugin = subject.createDeployPlugin({
      name: 'corber'
    });

    assert.equal(plugin.name, 'corber');
  });

  it('implements didBuild hooks', function() {
    let plugin = subject.createDeployPlugin({
      name: 'corber'
    });

    assert.typeOf(plugin.didBuild, 'function');
  });

  describe('configuration', function() {
    it('does not require any configuration', function() {
      let plugin = subject.createDeployPlugin({
        name: 'corber'
      });
      plugin.beforeHook(context);
      plugin.configure(context);
      assert.ok(true);
    });
  });

  describe('getBuildArgs function', function() {
    it('returns an array', function() {
      let plugin = subject.createDeployPlugin({
        name: 'corber'
      });
      plugin.beforeHook(context);
      assert.ok(Array.isArray(plugin.getBuildArgs()));
    });

    it('adds --skip-framework-build argument', function() {
      let plugin = subject.createDeployPlugin({
        name: 'corber'
      });
      plugin.beforeHook(context);
      assert.ok(plugin.getBuildArgs().indexOf('--skip-framework-build') !== -1);
    });

    it('adds --quiet argument', function() {
      let plugin = subject.createDeployPlugin({
        name: 'corber'
      });
      plugin.beforeHook(context);
      assert.ok(plugin.getBuildArgs().indexOf('--quiet') !== -1);
    });

    it('does not add --quiet argument if verbose is true', function() {
      let plugin = subject.createDeployPlugin({
        name: 'corber',
      });
      context.commandOptions.verbose = true;
      plugin.beforeHook(context);
      assert.ok(plugin.getBuildArgs().indexOf('--quiet') === -1);
    });

    it('adds options as arguments', function() {
      let plugin = subject.createDeployPlugin({
        name: 'corber',
      });
      context.config.corber.foo = 'bar';
      plugin.beforeHook(context);
      assert.ok(plugin.getBuildArgs().indexOf('--foo=bar') !== -1);
    });

    it('does not add enabled option as argument', function() {
      let plugin = subject.createDeployPlugin({
        name: 'corber',
      });
      plugin.beforeHook(context);
      assert.ok(plugin.getBuildArgs().indexOf('--enabled') === -1);
    });
  });

  describe('didBuild hook', function() {
    let CorberBuildMock;
    let cordovaOutputPathMock;
    let fsMock;

    beforeEach(() => {
      td.config({
        // Do not warn about using both td.when and td.verify for a single interaction.
        // We are stubbing the dependencies to make tests running without testing the
        // internals of our dependencies.
        // We use `td.verify` to ensure dependencies are called with correct arguments.
        ignoreWarnings: true,
      });

      CorberBuildMock = td.replace('corber/lib/commands/build');
      td.when(CorberBuildMock(td.matchers.anything())).thenReturn({
        validateAndRun() {
          return Promise.resolve();
        }
      });

      cordovaOutputPathMock = td.replace('corber/lib/targets/cordova/utils/get-path');
      td.when(cordovaOutputPathMock(td.matchers.anything())).thenReturn(context.project.root.concat('/corber/cordova'));

      fsMock = td.replace('fs-extra');
      td.when(fsMock.copySync(td.matchers.anything(), td.matchers.anything())).thenReturn();
      td.when(fsMock.removeSync(td.matchers.anything())).thenReturn();
      td.when(fsMock.readdirSync(td.matchers.anything())).thenReturn([]);

      subject = require('../index');
    });

    it('returns a promise', function() {
      let plugin = subject.createDeployPlugin({
        name: 'corber',
      });
      plugin.beforeHook(context);
      assert.ok(plugin.didBuild() instanceof Promise);
    });

    it('copies content of context.distDir to cordovaOutputPath', function() {
      let plugin = subject.createDeployPlugin({
        name: 'corber',
      });
      plugin.beforeHook(context);
      return plugin.didBuild(context).then(() => {
        td.verify(fsMock.copySync(context.distDir,`${context.project.root}/corber/cordova/www`));
      });
    });

    it('executes a corber build', function() {
      let executed = false;
      td.when(CorberBuildMock(td.matchers.anything())).thenReturn({
        validateAndRun() {
          executed = true;
          return Promise.resolve();
        }
      });
      let plugin = subject.createDeployPlugin({
        name: 'corber',
      });
      plugin.beforeHook(context);
      return plugin.didBuild(context).then(() => {
        td.verify(
          CorberBuildMock({
            ui: context.ui,
            project: context.project,
            settings: {}
          })
        );
        assert.ok(executed);
      });
    });

    it('clears build output folder (android platform)', function() {
      let subject = require('../index');
      let plugin = subject.createDeployPlugin({
        name: 'corber',
      });
      context.config.corber.platform = 'android';
      plugin.beforeHook(context);
      return plugin.didBuild(context).then(() => {
        td.verify(
          fsMock.removeSync(`${context.project.root}/corber/cordova/platforms/android/build/outputs/apk/`)
        );
      });
    });

    it('adds buildArtifacts to context (android platform)', function() {
      td.when(
        fsMock.readdirSync(td.matchers.anything())
      ).thenReturn(['foo.apk', 'bar.apk']);
      let subject = require('../index');
      let plugin = subject.createDeployPlugin({
        name: 'corber',
      });
      context.config.corber.platform = 'android';
      plugin.beforeHook(context);
      return plugin.didBuild(context).then((returnedContext) => {
        expect(returnedContext).to.deep.equal({
          corber: {
            android: [
              `${context.project.root}/corber/cordova/platforms/android/build/outputs/apk/foo.apk`,
              `${context.project.root}/corber/cordova/platforms/android/build/outputs/apk/bar.apk`
            ],
          },
        });
      });
    });

    it('returns immediately if enabled is false', function() {
      let plugin = subject.createDeployPlugin({
        name: 'corber',
      });
      context.config.corber.enabled = false;
      plugin.beforeHook(context);
      assert.ok(plugin.didBuild() === undefined);
    });
  });
});
