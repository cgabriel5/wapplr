"use strict";
// paths::BASES
var __PATHS_BASE = "./";
var __PATHS_CWD = process.cwd();
var __PATHS_HOMEDIR = ""; // "assets/";
// paths:JS
var __PATHS_JS_HOME = "js/";
var __PATHS_JS_OPTIONS_DYNAMIC;
// paths:GULP
var __PATHS_GULP_UTILS = `./${__PATHS_HOMEDIR}gulp/assets/utils/utils.js`;
var __PATHS_GULP_SETUP_QUESTIONS = `./${__PATHS_HOMEDIR}gulp/setup/exports/questions.js`;
var __PATHS_GULP_SETUP_TEMPLATES = `./${__PATHS_HOMEDIR}gulp/setup/exports/templates.js`;
var __PATHS_GULP_SETUP_JSCONFIGS = `./${__PATHS_HOMEDIR}gulp/setup/exports/jsconfigs.js`;
var __PATHS_GULP_FILE_NAME = "gulpfile.js";
var __PATHS_GULP_FILE_SETUP = "gulpfile.setup.js";
var __PATHS_GULP_SETUP = `./${__PATHS_HOMEDIR}gulp/setup/`;
var __PATHS_GULP_FILE_UNACTIVE = "gulpfile.unactive.js";
// paths:MARKDOWN
var __PATHS_MARKDOWN_PREVIEW = `${__PATHS_HOMEDIR}markdown/preview/`;
var __PATHS_MARKDOWN_SOURCE = `${__PATHS_HOMEDIR}markdown/source/`;
// paths:CONFIG_FILES
var __PATHS_CONFIG_USER = `./${__PATHS_HOMEDIR}gulp/assets/config/user.json`;
var __PATHS_CONFIG_INTERNAL = `./${__PATHS_HOMEDIR}gulp/assets/config/.hidden-internal.json`;
var __PATHS_PKG = `./${__PATHS_HOMEDIR}package.json`;
// paths:OTHER
var __PATHS_DOCS_README_TEMPLATE = "docs/readme_template.md";
var __PATHS_README = "README.md";
var __PATHS_LICENSE = "LICENSE.txt";
var __PATHS_HTML_HEADMETA = "html/source/head/meta.html";
var __PATHS_FILES_BEAUTIFY = "**/*.{html,css,js,json}";
var __PATHS_FILES_BEAUTIFY_EXCLUDE = "!**/*.min.*";
var __PATHS_NOT_NODE_MODULES = "!node_modules/**";
var __PATHS_GIT = ".git/";
// -------------------------------------
var path = require("path");
// -------------------------------------
var pump = require("pump");
var prompt = require("prompt");
var git = require("simple-git")();
var json = require("json-file");
var mds = require("markdown-styles");
var sequence = require("run-sequence");
var alphabetize = require("alphabetize-object-keys");
// -------------------------------------
var gulpif = require("gulp-if");
var eol = require("gulp-eol");
var clean = require("gulp-clean");
var rename = require("gulp-rename");
var replace = require("gulp-replace");
var json_sort = require("gulp-json-sort")
    .default;
// -------------------------------------
var uglify = require("gulp-uglify");
var beautify = require("gulp-jsbeautifier");
// -------------------------------------
// configuration information
var config_user = json.read(__PATHS_CONFIG_USER);
var config_internal = json.read(__PATHS_CONFIG_INTERNAL);
var pkg = json.read(__PATHS_PKG);
// -------------------------------------
// plugin options
var opts = config_user.get("options");
var opts_plugins = opts.plugins;
var opts_bt = opts_plugins.beautify;
var json_format = opts_plugins.json_format;
var json_spaces = json_format.indent_size;
// -------------------------------------
var questions = require(__PATHS_GULP_SETUP_QUESTIONS)
    .questions;
var templates = require(__PATHS_GULP_SETUP_TEMPLATES)
    .templates;
var jsconfigs = require(__PATHS_GULP_SETUP_JSCONFIGS)
    .jsconfigs;
var utils = require(__PATHS_GULP_UTILS);
var log = utils.log;
var time = utils.time;
var notify = utils.notify;
var gulp = utils.gulp;
var format = utils.format;
// -------------------------------------
var APPTYPE; // application-type
var __data__ = {}; // placeholder fillers
var INDEX = config_user.get("paths.index");
// -------------------------------------
gulp.task("default", function(done) {
    // show the user the init message
    log("Run \"gulp init\" before running gulp's default command.".yellow);
    done();
});
gulp.task("init", function(done) {
    prompt.start(); // start the prompt
    prompt.message = time();
    prompt.delimiter = " ";
    prompt.get(questions, function(err, result) {
        // kill prompt and show user error message
        if (err) {
            log(true, (err.message === "canceled") ? "Setup canceled.".red : err);
            return prompt.stop();
        }
        // get user input
        __data__ = result;
        // set the path for js option
        __PATHS_JS_OPTIONS_DYNAMIC = `gulp/setup/js/options/${__data__.apptype}/**/*.*`;
        // set the application type
        config_internal.set("apptype", __data__.apptype);
        // pick js bundle based on provided project type + reset the config js bundle
        config_user.data.bundles.js = jsconfigs[__data__.apptype];
        // set package.json properties
        pkg.set("name", __data__.name);
        pkg.set("version", __data__.version);
        pkg.set("description", __data__.description);
        pkg.set("author", format(templates.author, __data__));
        pkg.set("repository", {
            type: "git",
            url: format(templates["repository.url"], __data__)
        });
        pkg.set("bugs", {
            url: format(templates["bugs.url"], __data__)
        });
        pkg.set("homepage", format(templates.homepage, __data__));
        pkg.set("private", __data__.private);
        // sort keys
        config_user.data = alphabetize(config_user.data);
        config_internal.data = alphabetize(config_internal.data);
        pkg.data = alphabetize(pkg.data);
        // saves changes to files
        config_user.write(function() {
            config_internal.write(function() {
                pkg.write(function() {
                    // run initialization steps
                    return sequence("init-pick-js-option", "init-fill-placeholders", "init-setup-readme", "init-rename-gulpfile", "init-remove-setup", "init-beautify-files", "init-git", function() {
                        notify(`Project initialized (${__data__.apptype})`);
                        log("Project initialized ".bold.green + `(${__data__.apptype})`);
                        log("Run", "\"$ gulp\"".bold, "to build project files and start watching project for any file changes.");
                        done();
                    });
                }, null, json_spaces);
            }, null, json_spaces);
        }, null, json_spaces);
    });
});
// initialization step
gulp.task("init-pick-js-option", function(done) {
    // pick the js/ directory to use
    pump([gulp.src(__PATHS_JS_OPTIONS_DYNAMIC, {
            dot: true,
            cwd: __PATHS_BASE
        }),
        gulp.dest(__PATHS_JS_HOME, {
            cwd: __PATHS_BASE
        })
    ], done);
});
// initialization step
gulp.task("init-fill-placeholders", function(done) {
    // replace placeholder with real data
    pump([
        gulp.src([__PATHS_DOCS_README_TEMPLATE, __PATHS_LICENSE, __PATHS_HTML_HEADMETA, INDEX], {
            base: __PATHS_BASE
        }),
        replace(/\{\{\#(.*?)\}\}/g, function(match) {
            match = match.replace(/^\{\{\#|\}\}$/g, "");
            return __data__[match] ? __data__[match] : match;
        }), gulp.dest("")
    ], done);
});
// initialization step
gulp.task("init-setup-readme", function(done) {
    // move ./docs/readme_template.md to ./README.md
    pump([
        gulp.src(__PATHS_DOCS_README_TEMPLATE, {
            base: __PATHS_BASE
        }),
        clean(),
        rename(__PATHS_README),
        gulp.dest(__PATHS_BASE)
    ], function() {
        // markdown to html (with github style/layout)
        mds.render(mds.resolveArgs({
            input: path.join(__PATHS_CWD, __PATHS_README),
            output: path.join(__PATHS_CWD, __PATHS_MARKDOWN_PREVIEW),
            layout: path.join(__PATHS_CWD, __PATHS_MARKDOWN_SOURCE)
        }), function() {
            done();
        });
    });
});
// initialization step
gulp.task("init-rename-gulpfile", function(done) {
    // rename the gulpfile.unactive.js to gulpfile.js
    pump([
        gulp.src(__PATHS_GULP_FILE_UNACTIVE, {
            base: __PATHS_BASE
        }),
        clean(), // remove the file
        rename(__PATHS_GULP_FILE_NAME),
        gulp.dest(__PATHS_BASE)
    ], done);
});
// initialization step
gulp.task("init-remove-setup", function(done) {
    // remove the setup files/folders/old .git folder
    pump([
        gulp.src([__PATHS_GULP_FILE_SETUP, __PATHS_GULP_SETUP, __PATHS_GIT], {
            dot: true,
            read: false,
            base: __PATHS_BASE
        }),
        clean()
    ], done);
});
// initialization step
gulp.task("init-beautify-files", function(done) {
    // beautify html, js, css, & json files
    var condition = function(file) {
        return (path.extname(file.path) === ".json");
    };
    // get needed files
    pump([gulp.src([__PATHS_FILES_BEAUTIFY, __PATHS_FILES_BEAUTIFY_EXCLUDE, __PATHS_NOT_NODE_MODULES], {
            dot: true,
            cwd: __PATHS_BASE
        }),
        beautify(opts_bt),
        gulpif(condition, json_sort({
            "space": json_spaces
        })),
		eol(),
        gulp.dest(__PATHS_BASE),
    ], done);
});
// initialization step
gulp.task("init-git", function(done) {
    // git init new project
    git.init("", function() {
            log(`Git initialized (${__data__.apptype})`);
            notify(`Git initialized (${__data__.apptype})`);
            done();
        })
        .add("./*")
        .commit("chore: Initial commit\n\nProject initialization.");
});