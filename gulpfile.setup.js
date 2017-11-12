//#! requires.js -- ./gulp/setup/source/requires.js

// node modules
var fs = require("fs");
var path = require("path");

// lazy load gulp plugins
var $ = require("gulp-load-plugins")({
	rename: {
		"gulp-if": "gulpif",
		"gulp-markdown": "marked",
		"gulp-purifycss": "purify",
		"gulp-clean-css": "clean_css",
		"gulp-json-sort": "json_sort",
		"gulp-jsbeautifier": "beautify",
		"gulp-minify-html": "minify_html",
		"gulp-prettier-plugin": "prettier",
		"gulp-inject-content": "injection",
		"gulp-real-favicon": "real_favicon",
		"gulp-strip-json-comments": "strip_jsonc"
	},
	postRequireTransforms: {
		json_sort: function(plugin) {
			return plugin.default;
		},
		uglify: function(plugin) {
			// [https://stackoverflow.com/a/45554108]
			// By default es-uglify is used to uglify JS.
			var uglifyjs = require("uglify-es");
			var composer = require("gulp-uglify/composer");
			return composer(uglifyjs, console);
		}
	}
});

// universal modules
var pump = require("pump");
var yargs = require("yargs");
var chalk = require("chalk");
var cmd = require("node-cmd");
var marked = require("marked");
var prism = require("prismjs");
var json = require("json-file");
var git = require("simple-git")();
var inquirer = require("inquirer");
var jsonc = require("comment-json");
var sequence = require("run-sequence");
var alphabetize = require("alphabetize-object-keys");

//#! paths.js -- ./gulp/setup/source/paths.js

// get and fill in path placeholders
var $paths = expand_paths(require("./gulp/setup/exports/paths.js"));

//#! configs.js -- ./gulp/setup/source/configs.js

// dynamic configuration files (load via json-file to modify later)
var $internal = require("./gulp/setup/exports/internal.json");
var $pkg = json.read($paths.config_pkg);

// get individual plugin settings
var $app = jsonc.parse(fs.readFileSync($paths.config_app).toString());
var $ap = require($paths.config_autoprefixer);
var $bundles = json.read($paths.config_bundles);
var $jsbeautify = require($paths.config_jsbeautify);
var $json_format = require($paths.config_json_format);
var jindent = $json_format.indent_size;
var $perfectionist = require($paths.config_perfectionist);
var $prettier = require($paths.config_prettier);

// setup exports
var $questions = require($paths.gulp_setup_questions);
var $templates = require($paths.gulp_setup_templates);
var $jsconfigs = require($paths.gulp_setup_jsconfigs);

//#! vars.js -- ./gulp/setup/source/vars.js

var utils = require($paths.gulp_utils);
var log = utils.log;
var time = utils.time;
var notify = utils.notify;
var gulp = utils.gulp;
var format = utils.format;

var __data__ = {}; // placeholder fillers
var INDEX = $app.index;

var opts_sort = {
	// sort based on dirname alphabetically
	comparator: function(file1, file2) {
		var dir1 = path.dirname(file1.path);
		var dir2 = path.dirname(file2.path);
		if (dir1 > dir2) return 1;
		if (dir1 < dir2) return -1;
		return 0;
	}
};

//#! functions.js -- ./gulp/setup/source/functions.js

/**
 * @description [Add a bang to the start of the string.]
 * @param  {String} string [The string to add the bang to.]
 * @return {String}        [The new string with bang added.]
 */
function bangify(string) {
	return "!" + (string || "");
}

/**
 * @description [Appends the ** pattern to string.]
 * @param  {String} string [The string to add pattern to.]
 * @return {String}        [The new string with added pattern.]
 */
function globall(string) {
	return (string || "") + "**";
}

/**
 * @description [Returns the provided file's extension or checks it against the provided extension type.]
 * @param  {Object} file [The Gulp file object.]
 * @param  {Array} types [The optional extension type(s) to check against.]
 * @return {String|Boolean}      [The file's extension or boolean indicating compare result.]
 */
function ext(file, types) {
	// when no file exists return an empty string
	if (!file) return "";

	// get the file extname
	var extname = path
		.extname(file.path)
		.toLowerCase()
		.replace(/^\./, "");

	// simply return the extname when no type is
	// provided to check against.
	if (!types) return extname;

	// else when a type is provided check against it
	return Boolean(-~types.indexOf(extname));
}

// check for the usual file types
ext.ishtml = function(file) {
	return ext(file, ["html"]);
};
ext.iscss = function(file) {
	return ext(file, ["css"]);
};
ext.isjs = function(file) {
	return ext(file, ["js"]);
};
ext.isjson = function(file) {
	return ext(file, ["json"]);
};

/**
 * @description  [Recursively fill-in the placeholders in each path contained
 *               in the provided paths object.]
 * @param  {Object} $paths [Object containing the paths.]
 * @return {Object}           [The object with paths filled-in.]
 */
function expand_paths($paths) {
	// path placeholders substitutes. these paths will also get added to the
	// paths object after substitution down below.
	var __paths_subs__ = {
		// paths::BASES
		del: "/",
		base: "./",
		base_dot: ".",
		dirname: __dirname,
		cwd: process.cwd(),
		homedir: "" // "assets/"
	};

	var replacer = function(match) {
		var replacement = __paths_subs__[match.replace(/^\$\{|\}$/g, "")];
		return replacement !== undefined ? replacement : undefined;
	};
	// recursively replace all the placeholders
	for (var key in $paths) {
		if ($paths.hasOwnProperty(key)) {
			var __path = $paths[key];

			// find all the placeholders
			while (/\$\{.*?\}/g.test(__path)) {
				__path = __path.replace(/\$\{.*?\}/g, replacer);
			}
			// reset the substituted string back in the $paths object
			$paths[key] = __path;
		}
	}

	// add the subs to the paths object
	for (var key in __paths_subs__) {
		if (__paths_subs__.hasOwnProperty(key)) {
			$paths[key] = __paths_subs__[key];
		}
	}

	// filled-in paths
	return $paths;
}

//#! init.js -- ./gulp/setup/source/tasks/init.js

// @internal
gulp.task("default", function(done) {
	var task = this;
	// show the user the init message
	log('Run "$ gulp init" before running Gulp\'s default command.');
	done();
});

gulp.task("default", function(done) {
	var task = this;

	inquirer.prompt($questions).then(function(answers) {
		// get answers
		__data__ = answers;
		var type = __data__.apptype;

		// set the path for js option
		$paths.js_options_dynamic = `gulp/setup/js/options/${type}/**/*.*`;

		// set the application type
		$internal.apptype = type;
		// pick js bundle based on provided project type + reset the config js bundle
		$bundles.data.js = $jsconfigs[type];

		// remove distribution configuration if type is library
		// as the project is defaulted for a webapp project.
		if (type === "library") {
			// remove the distribution configuration
			delete $bundles.data.dist;
			// add the library configuration
			$bundles.data.lib = $jsconfigs.lib;
		} // else leave as-is for webapp project

		// set package.json properties
		$pkg.set("name", __data__.name);
		$pkg.set("version", __data__.version);
		$pkg.set("description", __data__.description);
		$pkg.set("author", format($templates.author, __data__));
		$pkg.set("repository", {
			type: "git",
			url: format($templates["repository.url"], __data__)
		});
		$pkg.set("bugs", {
			url: format($templates["bugs.url"], __data__)
		});
		$pkg.set("homepage", format($templates.homepage, __data__));
		$pkg.set("private", __data__.private);

		// sort keys
		$bundles.data = alphabetize($bundles.data);
		$pkg.data = alphabetize($pkg.data);

		// saves changes to files
		$bundles.writeSync(null, jindent);
		$pkg.write(
			function() {
				// run initialization steps
				var tasks = [
					"init:settings-internal",
					"init:settings-main",
					"init:remove-webapp-files",
					"init:add-library-files",
					"init:fill-placeholders",
					"init:setup-readme",
					"init:rename-gulpfile",
					"init:remove-setup",
					"init:pretty",
					"init:git"
				];
				// remove steps that are only for library project setup
				// when the apptype is set to webapp.
				if (__data__.apptype === "webapp") {
					tasks.splice(2, 2);
				}
				tasks.push(function() {
					var message = `Project initialized (${type})`;
					notify(message);
					log(message, "\n");
					log(
						"Run",
						chalk.green("$ gulp"),
						"to start watching project for any file changes.\n"
					);
					done();
				});
				return sequence.apply(task, tasks);
			},
			null,
			jindent
		);
	});
});

//#! steps.js -- ./gulp/setup/source/tasks/steps.js

// initialization step
// @internal
gulp.task("init:settings-internal", function(done) {
	var task = this;

	// save the $internal JSON object
	fs.writeFile(
		$paths.config_home + $paths.gulp_setup_settings_internal_name,
		JSON.stringify(alphabetize($internal), null, jindent),
		function() {
			done();
		}
	);
});

// initialization step
// @internal
gulp.task("init:settings-main", function(done) {
	var task = this;

	// make the main settings file
	pump(
		[
			gulp.src($paths.config_settings_json_files, {
				cwd: $paths.base
			}),
			$.debug(),
			$.strip_jsonc(), // remove any json comments
			$.jsoncombine($paths.config_settings_name, function(data, meta) {
				return new Buffer(JSON.stringify(data, null, jindent));
			}),
			gulp.dest($paths.config_home),
			$.debug.edit()
		],
		done
	);
});

// initialization step
// @internal
gulp.task("init:remove-webapp-files", function(done) {
	// only when apptype is library:
	// replace ./js/source/ to later add the needed library
	// project files, i.e. ./js/vendor/__init__.js and
	// ./js/bundles/.

	var task = this;

	pump(
		[
			gulp.src($paths.js_source, {
				dot: true,
				cwd: $paths.base
			}),
			$.debug.clean(),
			$.clean()
		],
		done
	);
});

// initialization step
// @internal
gulp.task("init:add-library-files", function(done) {
	// copy the library project files from the setup
	// directory into the ./js/ directory. this will
	// also overwrite needed files, like the bundle files.

	var task = this;

	pump(
		[
			gulp.src($paths.js_options_dynamic, {
				dot: true,
				cwd: $paths.base_dot
			}),
			$.debug(),
			gulp.dest($paths.js_home),
			$.debug.edit()
		],
		done
	);
});

// initialization step
// @internal
gulp.task("init:fill-placeholders", function(done) {
	var task = this;
	// replace placeholder with real data
	pump(
		[
			gulp.src(
				[
					$paths.gulp_setup_readme_template,
					$paths.gulp_setup_license_template,
					$paths.html_headmeta,
					INDEX
				],
				{
					base: $paths.base
				}
			),
			$.injection(__data__),
			gulp.dest($paths.base),
			$.debug.edit()
		],
		done
	);
});

// initialization step
// @internal
gulp.task("init:setup-readme", function(done) {
	var task = this;
	// move templates to new locations
	pump(
		[
			gulp.src([
				$paths.gulp_setup_readme_template,
				$paths.gulp_setup_license_template
			]),
			$.debug(),
			gulp.dest($paths.base),
			$.debug.edit()
		],
		done
	);
});

// initialization step
// @internal
gulp.task("init:rename-gulpfile", function(done) {
	var task = this;
	// rename the gulpfile.main.js to gulpfile.js
	pump(
		[
			gulp.src($paths.gulp_file_main, {
				base: $paths.base
			}),
			$.debug(),
			$.clean(), // remove the file
			$.rename($paths.gulp_file_name),
			gulp.dest($paths.base),
			$.debug.edit()
		],
		done
	);
});

// initialization step
// @internal
gulp.task("init:remove-setup", function(done) {
	var task = this;
	// remove the setup files/folders/old .git folder
	pump(
		[
			gulp.src([$paths.gulp_file_setup, $paths.gulp_setup, $paths.git], {
				dot: true,
				read: false,
				base: $paths.base
			}),
			$.debug.clean(),
			$.clean()
		],
		done
	);
});

// initialization step
// @internal
gulp.task("init:git", function(done) {
	var task = this;

	// git init new project
	git.init("", function() {
		// set gitconfig values
		cmd.get(
			`
		git config --local core.fileMode false
		git config --local core.autocrlf input
		git config --local user.email ${__data__.email}
		git config --local user.name ${__data__.git_id}`,
			function(err, data, stderr) {
				// make the first commit
				git
					.add("./*")
					.commit(
						"chore: Initial commit\n\nProject initialization.",
						function() {
							console.log("");
							log(
								"Make sure to set your editor of choice with Git if not already set."
							);
							log(
								"For example, if using Sublime Text run ",
								chalk.green(
									'$ git config core.editor "subl -n w"'
								)
							);
							log("More information can be found here:");
							log(
								"https://git-scm.com/book/en/v2/Customizing-Git-Git-Configuration\n"
							);
							log(`Git initialized and configured.\n`);
							notify(
								`Git initialized and configured (${__data__.apptype})`
							);
							done();
						}
					);
			}
		);
	});
});

//#! pretty.js -- ./gulp/setup/source/helpers/pretty.js

// beautify html, js, css, & json files
// @internal
gulp.task("pretty", function(done) {
	var unprefix = require("postcss-unprefix");
	var autoprefixer = require("autoprefixer");
	var perfectionist = require("perfectionist");
	var shorthand = require("postcss-merge-longhand");

	var task = this;

	// default files to clean:
	// HTML, CSS, JS, and JSON files. exclude files containing
	// a ".min." as this is the convention used for minified files.
	// the node_modules/, .git/, and all vendor/ files are also excluded.
	var files = [
		$paths.files_beautify,
		$paths.files_beautify_exclude_min,
		bangify(globall($paths.node_modules_name)),
		bangify(globall($paths.git)),
		$paths.not_vendor,
		$paths.not_ignore
	];

	// get needed files
	pump(
		[
			gulp.src(files, {
				dot: true,
				base: $paths.base_dot
			}),
			$.sort(opts_sort),
			$.gulpif(ext.ishtml, $.beautify($jsbeautify)),
			$.gulpif(
				function(file) {
					// file must be a JSON file and cannot contain the comment (.cm.) sub-extension
					// to be sortable as comments are not allowed in JSON files.
					return ext(file, ["json"]) && !-~file.path.indexOf(".cm.")
						? true
						: false;
				},
				$.json_sort({
					space: jindent
				})
			),
			$.gulpif(function(file) {
				// exclude HTML and CSS files
				return ext(file, ["html", "css"]) ? false : true;
			}, $.prettier($prettier)),
			$.gulpif(
				ext.iscss,
				$.postcss([
					unprefix(),
					shorthand(),
					autoprefixer($ap),
					perfectionist($perfectionist)
				])
			),
			$.eol(),
			$.debug.edit(),
			gulp.dest($paths.base)
		],
		done
	);
});

// initialization step::alias
// @internal
gulp.task("init:pretty", ["pretty"]);

//#! make.js -- ./gulp/setup/source/helpers/make.js

// build gulpfile.setup.js
// @internal
gulp.task("make", function(done) {
	var task = this;
	var files = [
		"requires.js",
		"paths.js",
		"configs.js",
		"vars.js",
		"functions.js",
		"tasks/init.js",
		"tasks/steps.js",
		"helpers/pretty.js",
		"helpers/make.js"
	];
	pump(
		[
			gulp.src(files, {
				cwd: $paths.gulp_setup_source
			}),
			$.debug(),
			$.foreach(function(stream, file) {
				var filename = path.basename(file.path);
				var filename_rel = path.relative(process.cwd(), file.path);
				return stream.pipe(
					$.insert.prepend(
						`//#! ${filename} -- ./${filename_rel}\n\n`
					)
				);
			}),
			$.concat($paths.gulp_file_setup),
			$.prettier($prettier),
			gulp.dest($paths.base),
			$.debug.edit()
		],
		done
	);
});
