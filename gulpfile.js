var gulp = require('gulp');
var gulpPlugins = require('gulp-load-plugins')();
var runSequence = require('run-sequence');
var merge = require('merge');
var gulpTraceur = require('./tools/transpiler/gulp-traceur');

var clean = require('./tools/build/clean');
var transpile = require('./tools/build/transpile');
var html = require('./tools/build/html');
var pubget = require('./tools/build/pubget');
var linknodemodules = require('./tools/build/linknodemodules');
var pubbuild = require('./tools/build/pubbuild');
var dartanalyzer = require('./tools/build/dartanalyzer');
var jsserve = require('./tools/build/jsserve');
var pubserve = require('./tools/build/pubserve');
var rundartpackage = require('./tools/build/rundartpackage');
var copy = require('./tools/build/copy');
var karma = require('karma').server;
var minimist = require('minimist');
var es5build = require('./tools/build/es5build');
var runServerDartTests = require('./tools/build/run_server_dart_tests');
var util = require('./tools/build/util');

var DART_SDK = require('./tools/build/dartdetect')(gulp);
// -----------------------
// configuration

var _COMPILER_CONFIG_JS_DEFAULT = {
  sourceMaps: true,
  annotations: true, // parse annotations
  types: true, // parse types
  script: false, // parse as a module
  memberVariables: true, // parse class fields
  modules: 'instantiate'
};

var _HTLM_DEFAULT_SCRIPTS_JS = [
  {src: '../../traceur-runtime.js', mimeType: 'text/javascript'},
  {src: '../../es6-module-loader-sans-promises.src.js', mimeType: 'text/javascript'},
  {src: '../../zone.js', mimeType: 'text/javascript'},
  {src: '../../long-stack-trace-zone.js', mimeType: 'text/javascript'},
  {src: '../../system.src.js', mimeType: 'text/javascript'},
  {src: '../../extension-register.js', mimeType: 'text/javascript'},
  {src: '../../runtime_paths.js', mimeType: 'text/javascript'},
  {
    inline: 'System.import(\'$MODULENAME$\').then(function(m) { m.main(); }, console.log.bind(console))',
    mimeType: 'text/javascript'
  }
];

var _HTML_DEFAULT_SCRIPTS_DART = [
  {src: '$MODULENAME_WITHOUT_PATH$.dart', mimeType: 'application/dart'},
  {src: 'packages/browser/dart.js', mimeType: 'text/javascript'}
];

var BASE_PACKAGE_JSON = require('./package.json');
var COMMON_PACKAGE_JSON = {
  version: BASE_PACKAGE_JSON.version,
  homepage: BASE_PACKAGE_JSON.homepage,
  bugs: BASE_PACKAGE_JSON.bugs,
  license: BASE_PACKAGE_JSON.license,
  contributors: BASE_PACKAGE_JSON.contributors,
  dependencies: BASE_PACKAGE_JSON.dependencies,
  devDependencies: {
    "yargs": BASE_PACKAGE_JSON.devDependencies['yargs'],
    "gulp-sourcemaps": BASE_PACKAGE_JSON.devDependencies['gulp-sourcemaps'],
    "gulp-traceur": BASE_PACKAGE_JSON.devDependencies['gulp-traceur'],
    "gulp": BASE_PACKAGE_JSON.devDependencies['gulp'],
    "gulp-rename": BASE_PACKAGE_JSON.devDependencies['gulp-rename'],
    "through2": BASE_PACKAGE_JSON.devDependencies['through2']
  }
};

var SRC_FOLDER_INSERTION = {
    js: {
      '**': ''
    },
    dart: {
      '**': 'lib',
      '*/test/**': '',
      'benchmarks/**': 'web',
      'benchmarks/test/**': '',
      'benchmarks_external/**': 'web',
      'benchmarks_external/test/**': '',
      'example*/**': 'web',
      'example*/test/**': ''
    }
  };

var ES5_DEPS = [
  gulpTraceur.RUNTIME_PATH,
  'node_modules/es6-module-loader/dist/es6-module-loader-sans-promises.src.js',
  'node_modules/systemjs/dist/system.src.js',
  'node_modules/systemjs/lib/extension-register.js',
  'node_modules/zone.js/zone.js',
  'node_modules/zone.js/long-stack-trace-zone.js',
  'tools/build/snippets/runtime_paths.js',
  'tools/build/snippets/url_params_to_form.js',
  'node_modules/angular/angular.js'
];

var CONFIG = {
  dest: {
    js: {
      all: 'dist/js',
      dev: {
        es6: 'dist/js/dev/es6',
        es5: 'dist/js/dev/es5'
      },
      prod: {
        es6: 'dist/js/prod/es6',
        es5: 'dist/js/prod/es5'
      },
      cjs: 'dist/js/cjs',
      dart2js: 'dist/js/dart2js'
    },
    dart: 'dist/dart',
    docs: 'dist/docs'
  },
  srcFolderInsertion: SRC_FOLDER_INSERTION,
  transpile: {
    src: {
      js: ['modules/**/*.js', 'modules/**/*.es6'],
      dart: ['modules/**/*.js'],
    },
    options: {
      js: {
        dev: merge(true, _COMPILER_CONFIG_JS_DEFAULT, {
          typeAssertionModule: 'rtts_assert/rtts_assert',
          typeAssertions: true,
          outputLanguage: 'es6'
        }),
        prod: merge(true, _COMPILER_CONFIG_JS_DEFAULT, {
          typeAssertions: false,
          outputLanguage: 'es6'
        }),
        cjs: merge(true, _COMPILER_CONFIG_JS_DEFAULT, {
          typeAssertionModule: 'rtts_assert/rtts_assert',
          typeAssertions: true,
          modules: 'commonjs'
        })
      },
      dart: {
        sourceMaps: true,
        annotations: true, // parse annotations
        types: true, // parse types
        script: false, // parse as a module
        memberVariables: true, // parse class fields
        outputLanguage: 'dart'
      }
    }
  },
  copy: {
    js: {
      cjs: {
        src: ['modules/**/README.js.md', 'modules/**/package.json', 'modules/**/*.cjs'],
        pipes: {
          '**/*.cjs': gulpPlugins.rename({extname: '.js'}),
          '**/*.js.md': gulpPlugins.rename(function(file) {
            file.basename = file.basename.substring(0, file.basename.lastIndexOf('.'));
          }),
          '**/package.json': gulpPlugins.template({ 'packageJson': COMMON_PACKAGE_JSON })
        }
      },
      dev: {
        src: ['modules/**/*.css'],
        pipes: {}
      },
      prod: {
        src: ['modules/**/*.css'],
        pipes: {}
      }
    },
    dart: {
      src: ['modules/**/README.dart.md', 'modules/**/*.dart', 'modules/*/pubspec.yaml', 'modules/**/*.css', '!modules/**/e2e_test/**'],
      pipes: {
        '**/*.dart': util.insertSrcFolder(gulpPlugins, SRC_FOLDER_INSERTION.dart),
        '**/*.dart.md': gulpPlugins.rename(function(file) {
          file.basename = file.basename.substring(0, file.basename.lastIndexOf('.'));
        }),
        '**/pubspec.yaml': gulpPlugins.template({ 'packageJson': COMMON_PACKAGE_JSON })
      }
    }
  },
  multicopy: {
    js: {
      cjs: {
        src: [
          'LICENSE'
        ],
        pipes: {}
      },
      dev: {
        es6: {
          src: ['tools/build/es5build.js'],
          pipes: {}
        },
        es5: {
          src: ES5_DEPS,
          pipes: {}
        }
      },
      prod: {
        es6: {
          src: ['tools/build/es5build.js'],
          pipes: {}
        },
        es5: {
          src: ES5_DEPS,
          pipes: {}
        }
      },
      dart2js: {
        src: ['tools/build/snippets/url_params_to_form.js'],
        exclude: ['rtts_assert/'],
        pipes: {}
      }
    },
    dart: {
      src: ['LICENSE'],
      exclude: ['rtts_assert/'],
      pipes: {}
    }
  },
  html: {
    src: {
      js: ['modules/*/src/**/*.html'],
      dart: ['modules/*/src/**/*.html']
    },
    scriptsPerFolder: {
      js: {
        '**': _HTLM_DEFAULT_SCRIPTS_JS,
        'benchmarks/**':
          [
            { src: '../../url_params_to_form.js', mimeType: 'text/javascript' }
          ].concat(_HTLM_DEFAULT_SCRIPTS_JS),
        'benchmarks_external/**':
          [
            { src: '../../angular.js', mimeType: 'text/javascript' },
            { src: '../../url_params_to_form.js', mimeType: 'text/javascript' }
          ].concat(_HTLM_DEFAULT_SCRIPTS_JS)
      },
      dart: {
        '**': _HTML_DEFAULT_SCRIPTS_DART,
        'benchmarks*/**':
          [
            { src: '../../url_params_to_form.js', mimeType: 'text/javascript' }
          ].concat(_HTML_DEFAULT_SCRIPTS_DART)
      }
    }
  },
  formatDart: {
    packageName: 'dart_style',
    args: ['dart_style:format', '-w', 'dist/dart']
  }
};

// ------------
// clean

gulp.task('build/clean.js', clean(gulp, gulpPlugins, {
  path: CONFIG.dest.js.all
}));

gulp.task('build/clean.dart', clean(gulp, gulpPlugins, {
  path: CONFIG.dest.dart
}));

gulp.task('build/clean.docs', clean(gulp, gulpPlugins, {
    path: CONFIG.dest.docs
}));


// ------------
// transpile

gulp.task('build/transpile.js.dev.es6', transpile(gulp, gulpPlugins, {
  src: CONFIG.transpile.src.js,
  dest: CONFIG.dest.js.dev.es6,
  outputExt: 'es6',
  options: CONFIG.transpile.options.js.dev,
  srcFolderInsertion: CONFIG.srcFolderInsertion.js
}));

gulp.task('build/transpile.js.dev.es5', function() {
  return es5build({
    src: CONFIG.dest.js.dev.es6,
    dest: CONFIG.dest.js.dev.es5,
    modules: 'instantiate'
  });
});

gulp.task('build/transpile.js.dev', function(done) {
  runSequence(
    'build/transpile.js.dev.es6',
    'build/transpile.js.dev.es5',
    done
  );
});

gulp.task('build/transpile.js.prod.es6', transpile(gulp, gulpPlugins, {
  src: CONFIG.transpile.src.js,
  dest: CONFIG.dest.js.prod.es6,
  outputExt: 'es6',
  options: CONFIG.transpile.options.js.prod,
  srcFolderInsertion: CONFIG.srcFolderInsertion.js
}));

gulp.task('build/transpile.js.prod.es5', function() {
  return es5build({
    src: CONFIG.dest.js.prod.es6,
    dest: CONFIG.dest.js.prod.es5,
    modules: 'instantiate'
  });
});

gulp.task('build/transpile.js.prod', function(done) {
  runSequence(
    'build/transpile.js.prod.es6',
    'build/transpile.js.prod.es5',
    done
  );
});

gulp.task('build/transpile.js.cjs', transpile(gulp, gulpPlugins, {
  src: CONFIG.transpile.src.js,
  dest: CONFIG.dest.js.cjs,
  outputExt: 'js',
  options: CONFIG.transpile.options.js.cjs,
  srcFolderInsertion: CONFIG.srcFolderInsertion.js
}));

gulp.task('build/transpile.dart', transpile(gulp, gulpPlugins, {
  src: CONFIG.transpile.src.dart,
  dest: CONFIG.dest.dart,
  outputExt: 'dart',
  options: CONFIG.transpile.options.dart,
  srcFolderInsertion: CONFIG.srcFolderInsertion.dart
}));

// ------------
// html

gulp.task('build/html.js.dev', html(gulp, gulpPlugins, {
  src: CONFIG.html.src.js,
  dest: CONFIG.dest.js.dev.es5,
  srcFolderInsertion: CONFIG.srcFolderInsertion.js,
  scriptsPerFolder: CONFIG.html.scriptsPerFolder.js
}));

gulp.task('build/html.js.prod', html(gulp, gulpPlugins, {
  src: CONFIG.html.src.js,
  dest: CONFIG.dest.js.prod.es5,
  srcFolderInsertion: CONFIG.srcFolderInsertion.js,
  scriptsPerFolder: CONFIG.html.scriptsPerFolder.js
}));

gulp.task('build/html.dart', html(gulp, gulpPlugins, {
  src: CONFIG.html.src.dart,
  dest: CONFIG.dest.dart,
  srcFolderInsertion: CONFIG.srcFolderInsertion.dart,
  scriptsPerFolder: CONFIG.html.scriptsPerFolder.dart
}));

// ------------
// copy

gulp.task('build/copy.js.cjs', copy.copy(gulp, gulpPlugins, {
  src: CONFIG.copy.js.cjs.src,
  pipes: CONFIG.copy.js.cjs.pipes,
  dest: CONFIG.dest.js.cjs
}));

gulp.task('build/copy.js.dev', copy.copy(gulp, gulpPlugins, {
  src: CONFIG.copy.js.dev.src,
  pipes: CONFIG.copy.js.dev.pipes,
  dest: CONFIG.dest.js.dev.es5
}));

gulp.task('build/copy.js.prod', copy.copy(gulp, gulpPlugins, {
  src: CONFIG.copy.js.prod.src,
  pipes: CONFIG.copy.js.prod.pipes,
  dest: CONFIG.dest.js.prod.es5
}));

gulp.task('build/copy.dart', copy.copy(gulp, gulpPlugins, {
  src: CONFIG.copy.dart.src,
  pipes: CONFIG.copy.dart.pipes,
  dest: CONFIG.dest.dart
}));


// ------------
// multicopy

gulp.task('build/multicopy.js.cjs', copy.multicopy(gulp, gulpPlugins, {
  src: CONFIG.multicopy.js.cjs.src,
  pipes: CONFIG.multicopy.js.cjs.pipes,
  exclude: CONFIG.multicopy.js.cjs.exclude,
  dest: CONFIG.dest.js.cjs
}));

gulp.task('build/multicopy.js.dev.es6', copy.multicopy(gulp, gulpPlugins, {
  src: CONFIG.multicopy.js.dev.es6.src,
  pipes: CONFIG.multicopy.js.dev.es6.pipes,
  exclude: CONFIG.multicopy.js.dev.es6.exclude,
  dest: CONFIG.dest.js.dev.es6
}));

gulp.task('build/multicopy.js.dev.es5', copy.multicopy(gulp, gulpPlugins, {
  src: CONFIG.multicopy.js.dev.es5.src,
  pipes: CONFIG.multicopy.js.dev.es5.pipes,
  exclude: CONFIG.multicopy.js.dev.es5.exclude,
  dest: CONFIG.dest.js.dev.es5
}));

gulp.task('build/multicopy.js.prod.es6', copy.multicopy(gulp, gulpPlugins, {
  src: CONFIG.multicopy.js.prod.es6.src,
  pipes: CONFIG.multicopy.js.prod.es6.pipes,
  exclude: CONFIG.multicopy.js.prod.es6.exclude,
  dest: CONFIG.dest.js.prod.es6
}));

gulp.task('build/multicopy.js.prod.es5', copy.multicopy(gulp, gulpPlugins, {
  src: CONFIG.multicopy.js.prod.es5.src,
  pipes: CONFIG.multicopy.js.prod.es5.pipes,
  exclude: CONFIG.multicopy.js.prod.es5.exclude,
  dest: CONFIG.dest.js.prod.es5
}));

gulp.task('build/multicopy.dart', copy.multicopy(gulp, gulpPlugins, {
  src: CONFIG.multicopy.dart.src,
  pipes: CONFIG.multicopy.dart.pipes,
  exclude: CONFIG.multicopy.dart.exclude,
  dest: CONFIG.dest.dart
}));

gulp.task('build/multicopy.js.dart2js', copy.multicopy(gulp, gulpPlugins, {
  src: CONFIG.multicopy.js.dart2js.src,
  pipes: CONFIG.multicopy.js.dart2js.pipes,
  exclude: CONFIG.multicopy.js.dart2js.exclude,
  dest: CONFIG.dest.js.dart2js
}));


// ------------
// pubspec

gulp.task('build/pubspec.dart', pubget(gulp, gulpPlugins, {
  dir: CONFIG.dest.dart,
  command: DART_SDK.PUB
}));

// ------------
// linknodemodules

gulp.task('build/linknodemodules.js.cjs', linknodemodules(gulp, gulpPlugins, {
  dir: CONFIG.dest.js.cjs
}));

// ------------
// dartanalyzer

gulp.task('build/analyze.dart', dartanalyzer(gulp, gulpPlugins, {
  dest: CONFIG.dest.dart,
  command: DART_SDK.ANALYZER
}));

// ------------
// pubbuild

gulp.task('build/pubbuild.dart', pubbuild(gulp, gulpPlugins, {
  src: CONFIG.dest.dart,
  dest: CONFIG.dest.js.dart2js,
  command: DART_SDK.PUB
}));

// ------------
// format dart

gulp.task('build/format.dart', rundartpackage(gulp, gulpPlugins, {
  pub: DART_SDK.PUB,
  packageName: CONFIG.formatDart.packageName,
  args: CONFIG.formatDart.args
}));

// ------------------
// web servers
gulp.task('serve.js.dev', jsserve(gulp, gulpPlugins, {
  path: CONFIG.dest.js.dev.es5,
  port: 8000
}));

gulp.task('serve.js.prod', jsserve(gulp, gulpPlugins, {
  path: CONFIG.dest.js.prod.es5,
  port: 8001
}));

gulp.task('serve.js.dart2js', jsserve(gulp, gulpPlugins, {
  path: CONFIG.dest.js.dart2js,
  port: 8002
}));

gulp.task('serve/examples.dart', pubserve(gulp, gulpPlugins, {
  command: DART_SDK.PUB,
  path: CONFIG.dest.dart + '/examples'
}));

gulp.task('serve/benchmarks.dart', pubserve(gulp, gulpPlugins, {
  command: DART_SDK.PUB,
  path: CONFIG.dest.dart + '/benchmarks'
}));

gulp.task('serve/benchmarks_external.dart', pubserve(gulp, gulpPlugins, {
  command: DART_SDK.PUB,
  path: CONFIG.dest.dart + '/benchmarks_external'
}));

// --------------
// doc generation
var Dgeni = require('dgeni');
gulp.task('docs/dgeni', function() {
  try {
    var dgeni = new Dgeni([require('./docs/dgeni-package')]);
    return dgeni.generate();
  } catch(x) {
    console.log(x.stack);
    throw x;
  }
});

var bower = require('bower');
gulp.task('docs/bower', function() {
  var bowerTask = bower.commands.install(undefined, undefined, { cwd: 'docs' });
  bowerTask.on('log', function (result) {
    console.log('bower:', result.id, result.data.endpoint.name);
  });
  bowerTask.on('error', function(error) {
    console.log(error);
  });
  return bowerTask;
});

gulp.task('docs/assets', ['docs/bower'], function() {
  return gulp.src('docs/bower_components/**/*')
    .pipe(gulp.dest('dist/docs/lib'));
});

gulp.task('docs/app', function() {
  return gulp.src('docs/app/**/*')
    .pipe(gulp.dest('dist/docs'));
});

gulp.task('docs', ['docs/assets', 'docs/app', 'docs/dgeni']);
gulp.task('docs/watch', function() {
  return gulp.watch('docs/app/**/*', ['docs/app']);
});

var jasmine = require('gulp-jasmine');
gulp.task('docs/test', function () {
  return gulp.src('docs/**/*.spec.js')
      .pipe(jasmine({
        includeStackTrace: true
      }));
});

var webserver = require('gulp-webserver');
gulp.task('docs/serve', function() {
  gulp.src('dist/docs/')
    .pipe(webserver({
      fallback: 'index.html'
    }));
});

// ------------------
// karma tests
//     These tests run in the browser and are allowed to access
//     HTML DOM APIs.
function getBrowsersFromCLI() {
  var args = minimist(process.argv.slice(2));
  return [args.browsers?args.browsers:'DartiumWithWebPlatform']
}
gulp.task('test.unit.js', function (done) {
  karma.start({configFile: __dirname + '/karma-js.conf.js'}, done);
});
gulp.task('test.unit.dart', function (done) {
  karma.start({configFile: __dirname + '/karma-dart.conf.js'}, done);
});
gulp.task('test.unit.js/ci', function (done) {
  karma.start({configFile: __dirname + '/karma-js.conf.js',
      singleRun: true, reporters: ['dots'], browsers: getBrowsersFromCLI()}, done);
});
gulp.task('test.unit.dart/ci', function (done) {
  karma.start({configFile: __dirname + '/karma-dart.conf.js',
      singleRun: true, reporters: ['dots'], browsers: getBrowsersFromCLI()}, done);
});

// ------------------
// server tests
//     These tests run on the VM on the command-line and are
//     allowed to access the file system and network.
gulp.task('test.server.dart', runServerDartTests(gulp, gulpPlugins, {
  dest: 'dist/dart'
}));

// -----------------
// test builders
gulp.task('test.transpiler.unittest', function (done) {
  return gulp.src('tools/transpiler/unittest/**/*.js')
      .pipe(jasmine({
        includeStackTrace: true
      }))
});

// Copy test resources to dist
gulp.task('tests/transform.dart', function() {
  return gulp.src('modules/angular2/test/transform/**')
    .pipe(gulp.dest('dist/dart/angular2/test/transform'));
});



// -----------------
// orchestrated targets

// Builds all Dart packages, but does not compile them
gulp.task('build/packages.dart', function(done) {
  runSequence(
    ['build/transpile.dart', 'build/html.dart', 'build/copy.dart', 'build/multicopy.dart'],
    'tests/transform.dart',
    'build/format.dart',
    'build/pubspec.dart',
    done
  );
});

// Builds and compiles all Dart packages
gulp.task('build.dart', function(done) {
  runSequence(
    'build/packages.dart',
    'build/analyze.dart',
    'build/pubbuild.dart',
    // Note: pubbuild.dart will clear the dart2js folder, so we need to copy
    // our files after this :-(
    'build/multicopy.js.dart2js',
    done
  );
});

gulp.task('build.js.dev', function(done) {
  runSequence(
    ['build/transpile.js.dev', 'build/html.js.dev', 'build/copy.js.dev', 'build/multicopy.js.dev.es6', 'build/multicopy.js.dev.es5'],
    done
  );
});

gulp.task('build.js.prod', function(done) {
  runSequence(
    ['build/transpile.js.prod', 'build/html.js.prod', 'build/copy.js.prod', 'build/multicopy.js.prod.es6', 'build/multicopy.js.prod.es5'],
    done
  );
});

gulp.task('build.js.cjs', function(done) {
  runSequence(
    ['build/transpile.js.cjs', 'build/copy.js.cjs', 'build/multicopy.js.cjs'],
    ['build/linknodemodules.js.cjs'],
    done
  );;
});

gulp.task('build.js', ['build.js.dev', 'build.js.prod', 'build.js.cjs']);

gulp.task('clean', ['build/clean.js', 'build/clean.dart', 'build/clean.docs']);

gulp.task('build', ['build.js', 'build.dart']);
