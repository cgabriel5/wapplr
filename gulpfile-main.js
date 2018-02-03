// -----------------------------------------------------------------------------
// requires.js -- ./gulp/main/source/requires.js
// -----------------------------------------------------------------------------

/*jshint bitwise: false*/
/*jshint browser: false*/
/*jshint esversion: 6 */
/*jshint node: true*/
/*jshint -W014 */
/*jshint -W018 */

"use strict";

// Node modules.
var fs = require("fs");
var path = require("path");

// Lazy load gulp plugins.
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
		uglify: function() {
			// By default es-uglify is used to uglify JS.
			// [https://stackoverflow.com/a/45554108]
			var uglifyjs = require("uglify-es");
			var composer = require("gulp-uglify/composer");
			return composer(uglifyjs, console);
		}
	}
});

// Universal modules.
var del = require("del");
var pump = require("pump");
var yargs = require("yargs");
var chalk = require("chalk");
var dir = require("node-dir");
var cmd = require("node-cmd");
var mkdirp = require("mkdirp");
var fe = require("file-exists");
var json = require("json-file");
var jsonc = require("comment-json");
var de = require("directory-exists");
var get = require("object-path-get");
var sequence = require("run-sequence");
var browser_sync = require("browser-sync");
var bs_autoclose = require("browser-sync-close-hook");

// Project utils.
var utils = require("./gulp/assets/utils/utils.js");
var print = utils.print;
var notify = utils.notify;
var gulp = utils.gulp;
var uri = utils.uri;
var browser = utils.browser;
var bangify = utils.bangify;
var globall = utils.globall;
var extension = utils.ext;
var expand_paths = utils.expand_paths;
var opts_sort = utils.opts_sort;
var escape = utils.escape;
var unique = utils.unique;
var cli_highlight = utils.cli_highlight;

// -----------------------------------------------------------------------------
// paths.js -- ./gulp/main/source/paths.js
// -----------------------------------------------------------------------------

// Get and fill in path placeholders.
var $paths = expand_paths(
	Object.assign(
		jsonc.parse(
			fs.readFileSync("./configs/paths.cm.json").toString(),
			null,
			true
		),
		{
			// Add in the following paths:

			dirname: __dirname,
			cwd: process.cwd(),

			// Store the project folder name.
			rootdir: path.basename(process.cwd()),
			filepath: __filename,

			// Get the filepath file name.
			filename: path.basename(__filename)
		}
	)
);

// -----------------------------------------------------------------------------
// preconfig.js -- ./gulp/main/source/preconfig.js
// -----------------------------------------------------------------------------

// Dynamic configuration files (load via json-file to modify later).
var $internal = json.read($paths.config_internal);

// Object will contain all the configuration settings.
var $configs = {};

// Settings configuration file must exist to populate the configs object.
if (fe.sync($paths.config_settings)) {
	// Static configuration files (just need to read file).
	var $settings = jsonc.parse(
		fs.readFileSync($paths.config_settings).toString()
	);

	// Get individual plugin settings and store in an object.
	for (var $config in $paths) {
		// configuration files must match this pattern.
		var config_file_pattern = /^config_\$[a-z_.]+$/i.test($config);

		// Path must match the following pattern to be a config path.
		if ($paths.hasOwnProperty($config) && config_file_pattern) {
			// Remove any file name sub-extensions. For example,
			// turn "csslint.cm" to "csslint".
			var config_name = $paths[$config].split(".")[0];

			// Get the config settings and add to the settings object.
			$configs[config_name] = $settings[$paths[$config]];
		}
	}
} else {
	// Run yargs.
	var __flags = yargs.argv;

	// Note: When the settings file is missing this error message will get
	// shown. Follow the rebuild command and the file will get rebuilt. The
	// code is only allowed to run when the rebuild flag is set.

	if (!__flags.rebuild || !-~__flags._.indexOf("settings")) {
		// Settings file does not exist so give a message and exit process.
		print.gulp.error(
			chalk.magenta($paths.config_settings),
			"is missing (settings file)."
		);
		print.gulp.info(
			"Rebuild file by running:",
			"$ gulp settings --rebuild"
		);

		process.exit();
	}
}

// -----------------------------------------------------------------------------
// configs.js -- ./gulp/main/source/configs.js
// -----------------------------------------------------------------------------

// Get all needed configuration values.

// Bundles.
var BUNDLE_HTML = get($configs, "bundles.html", "");
var BUNDLE_CSS = get($configs, "bundles.css", "");
var BUNDLE_JS = get($configs, "bundles.js", "");
// var BUNDLE_IMG = get($configs, "bundles.img", "");
var BUNDLE_GULP = get($configs, "bundles.gulp", "");
var BUNDLE_DIST = get($configs, "bundles.dist", "");
var BUNDLE_LIB = get($configs, "bundles.lib", "");

// App configuration information.

// App directory information.
var INDEX = get($configs, "app.index", "");
var APPDIR = path.join(get($configs, "app.base", ""), $paths.rootdir);

// App settings editor.
var EDITOR = get($configs, "app.editor", {});
var EDITOR_ACTIVE = get(EDITOR, "active", false);
var EDITOR_CMD = get(EDITOR, "command", "");
var EDITOR_FLAGS = get(EDITOR, "flags", []);

// App line ending information.
var EOL = get($configs, "app.eol", "");
var EOL_ENDING = get(EOL, "ending", "");
// var EOL_STYLE = EOL.style;

// Use https or not.
var HTTPS = get($configs, "app.https", false);

// App JSON indentation.
var JINDENT = get($configs, "app.indent_char", "\t");

// Plugin configurations.
var PRETTIER = get($configs, "prettier", {});
var JSBEAUTIFY = get($configs, "jsbeautify", {});
var AUTOPREFIXER = get($configs, "autoprefixer", {});
var PERFECTIONIST = get($configs, "perfectionist", {});

// Internal information.
var INT_APPTYPE = get($internal.data, "apptype", "");
var INT_PROCESS = get($internal.data, "process", "");
var INT_PID = get(INT_PROCESS, "pid", "");
var INT_TITLE = get(INT_PROCESS, "title", "");
var INT_PORTS = get(INT_PROCESS, "ports", "");

// Get the current Gulp file name.
var GULPFILE = path.basename($paths.filename);
var GULPCLI = `gulp --gulpfile ${GULPFILE}`;

// -----------------------------------------------------------------------------
// vars.js -- ./gulp/main/source/vars.js
// -----------------------------------------------------------------------------

// Create browsersync server.
var bs = browser_sync.create(get($configs, "browsersync.server_name", ""));

// Get current branch name.
var branch_name;

// Remove options.
var opts_remove = {
	read: false,
	cwd: $paths.basedir
};

// -----------------------------------------------------------------------------
// injection.js -- ./gulp/main/source/injection.js
// -----------------------------------------------------------------------------

// HTML injection variable object.
var html_injection = {
	css_bundle_app:
		$paths.css_bundles + get(BUNDLE_CSS, "source.names.main", ""),
	css_bundle_vendor:
		$paths.css_bundles + get(BUNDLE_CSS, "vendor.names.main", ""),
	js_bundle_app: $paths.js_bundles + get(BUNDLE_JS, "source.names.main", ""),
	js_bundle_vendor:
		$paths.js_bundles + get(BUNDLE_JS, "vendor.names.main", "")
};

// -----------------------------------------------------------------------------
// functions.js -- ./gulp/main/source/functions.js
// -----------------------------------------------------------------------------

/**
 * Opens the provided file in the user's browser.
 *
 * @param {string} filepath - The path of the file to open.
 * @param {number} port - The port to open on.
 * @param {function} callback - The Gulp task callback to run.
 * @return {undefined} - Nothing.
 */
function open_file_in_browser(filepath, port, callback) {
	pump(
		[
			gulp.src(filepath, {
				cwd: $paths.basedir,
				dot: true
			}),
			$.open({
				app: browser,
				uri: uri({
					appdir: APPDIR,
					filepath: filepath,
					port: port,
					https: HTTPS
				})
			}),
			$.debug({ loader: false })
		],
		function() {
			notify("File opened!");
			callback();
		}
	);
}

/**
 * Determine the user's default text editor.
 *
 * @param  {object} options - Options object.
 * @return {object} - Object containing the user's editor and CLI flags
 */
function get_editor(options) {
	// Default options.
	options = options || {};

	// Note: Honor the provided editor information first. If nothing is
	// provided look at the app settings for the set editor if the active
	// flag is set. If not set then try the environment variables.

	// Use the provided editor.
	var editor = options.editor;

	// If still no editor use the app settings provided editor.
	if (!editor && EDITOR_ACTIVE) {
		// Form the command string: "editor + flags".
		editor = EDITOR_CMD + " " + EDITOR_FLAGS.join(" ");
	}

	// If still no editor try the environment variables.
	if (!editor) editor = process.env.EDITOR || process.env.VISUAL;

	// Finally, if nothing is found, default to the tried and true editors.
	if (!editor) editor = /^win/.test(process.platform) ? "notepad" : "vim";

	// Lowercase everything.
	editor = editor.toLowerCase();

	// If nothing is found should we check the check the Git config??

	// If an editor is found in an environment variable it will simply
	// be a command followed by a flag(s). For example, it could be
	// something like this: "subl -w -n". "subl" being the editor command
	// and "-w -n" the flags to use.

	// Editor flags will be stored here.
	var flags = [];

	// When flags are provided via the options object join them.
	if (options.flags) {
		// Add the provided flags to the flags array.
		flags = flags.concat(options.flags);
	}

	// Now get any flags found in the editor string.
	var parts = editor.split(/\s+/);

	// Since the editor is the first item in the array there must be at
	// least 1 item. Check for any flags present in the string.
	if (parts.length > 1) {
		// Reset variable and remove the editor from the parts array.
		editor = parts.shift();
		// Add all the flags to the flags array.
		flags = flags.concat(parts);
	} // Else there only exists an editor in the string.

	// Add other needed flags to make this work...
	// Code lifted and modified from here:
	// [https://github.com/sindresorhus/open-editor]

	// Get the file parts.
	var file = options.file;
	var name = file.name;
	var line = file.line || 1;
	var column = file.column || 1;

	// Visual Studio Code needs a flag to open file at line number/column.
	// [https://code.visualstudio.com/docs/editor/command-line#_core-cli-options]
	if (-~["code"].indexOf(editor)) {
		flags.push("--goto");
	}

	// Add needed flags depending on the editor being used.
	if (-~["atom", "code"].indexOf(editor) || /^subl/.test(editor)) {
		// Open in a new window and wait for the file to close.
		// Format: editor --FLAGS... <FILE>[:LINE][:COLUMN]
		flags.push("--new-window", "--wait", `${name}:${line}:${column}`);
	} else if (editor === "gedit") {
		// Format: editor --FLAGS... <FILE> +[LINE][:COLUMN]
		flags.push("--new-window", "--wait", name, `+${line}:${column}`);
	} else if (-~["webstorm", "intellij"].indexOf(editor)) {
		// Format: editor <FILE>[:LINE]
		flags.push(`${name}:${line}`);
	} else if (editor === "textmate") {
		// Format: editor --line [LINE][:COLUMN] <FILE>
		flags.push("--line", `${line}:${column}`, name);
	} else if (-~["vim", "neovim"].indexOf(editor)) {
		// Format: editor +call cursor([LINE], [COLUMN]) <FILE>
		flags.push(`+call cursor(${line}, ${column})`, name);
	} else {
		// If the editor is none of the above only pass in the file name.
		flags.push(name);
	}

	// Return the editor command with the flags to apply.
	return {
		command: editor,
		flags: flags
	};
}

/**
 * Build the config file path with the provided file name.
 *
 * @param  {string} name - The name of the config file.
 * @return {string} - The built file path.
 */
function get_config_file(name) {
	return `${$paths.config_home}${name}.json`;
}

// -----------------------------------------------------------------------------
// init.js -- ./gulp/main/source/tasks/init.js
// -----------------------------------------------------------------------------

/**
 * When Gulp is closed, either on error, crash, or intentionally, do
 *     a quick cleanup.
 */
var cleanup = require("node-cleanup");
cleanup(function(exit_code, signal) {
	// Is alphabetize really needed for an internal file?
	var alphabetize = require("alphabetize-object-keys");

	// The purpose of this cleanup is to cleanup the internal settings
	// file. This code will run when the current Gulp instance is closed
	// for whatever reason. When the process ID matches that of the stored
	// PID then the file will get cleared. Non-matching PIDs will not
	// cause any cleanup, as they should not.

	// Termination signal explanation: [https://goo.gl/rJNKNZ]

	// Re-read the file to get the most current value.
	$internal = json.read($paths.config_internal);
	INT_PROCESS = get($internal.data, "process", "");
	INT_PID = get(INT_PROCESS, "pid", "");

	// If the process is closed and it matches the recorded PID it is
	// the original process so close it and clear the internal file.
	if (INT_PID && INT_PID === process.pid) {
		// Don't call cleanup handler again.
		cleanup.uninstall();

		// When closed due to an error give an error message & notification.
		if (exit_code) {
			var message = `Error caused instance ${chalk.green(
				process.pid
			)} to close.`;
			notify(message, true);
			print.gulp.error(message);
		} else {
			// Else simply show that the process was successfully stopped.
			print.gulp.success(
				`Gulp instance ${chalk.green(process.pid)} stopped.`
			);
		}

		// Clear stored internal process values.
		$internal.set("process", null);
		$internal.data = alphabetize($internal.data);
		$internal.writeSync(null, JINDENT);

		// Cleanup other variables.
		branch_name = undefined;
		if (bs) {
			bs.exit();
		}

		// Finally kill the process.
		process.kill(INT_PID, signal);

		return false;
	}
});

/**
 * Store the current process information (internal config. file).
 *
 * Notes
 *
 * • This will write current process information to an internal gulp
 *     configuration file. This is done to prevent multiple Gulp
 *     instances from being spawned. Only one can be made at a time.
 *
 * @internal - Used with the default task.
 */
gulp.task("init:save-pid", function(done) {
	// Set the process information.
	$internal.set("process.pid", process.pid);
	$internal.set("process.title", process.title);
	$internal.set("process.argv", process.argv);

	// Store and save changes to file.
	$internal.write(
		function() {
			done();
		},
		null,
		JINDENT
	);
});

/**
 * Watch for Git branch changes.
 *
 * Notes
 *
 * • Branch name checks are done to check whether the branch was changed
 *     after the Gulp instance was made. When switching branches files
 *     and file structure might be different. This can cause problems
 *     like making performing unnecessary tasks calls. Therefore, after
 *     making a branch change simply restart Gulp. This is something that
 *     needs to be made seamless.
 *
 * @internal - Used with the default task.
 */
gulp.task("init:watch-git-branch", function(done) {
	var git = require("git-state");

	git.isGit($paths.dirname, function(exists) {
		// If no .git/ exists simply ignore and return done.
		if (!exists) {
			return done();
		}

		// Else it does exist so continue.
		git.check($paths.dirname, function(err, result) {
			if (err) {
				throw err;
			}

			// Record branch name.
			branch_name = result.branch;

			// Create a Gulp watcher as .git/ exists.
			gulp.watch(
				[$paths.githead],
				{
					cwd: $paths.basedir,
					dot: true
				},
				function() {
					// Get the branch name.
					var brn_current = git.checkSync($paths.dirname).branch;

					// Print the branch name being watched.
					if (branch_name) {
						print.gulp.info(
							"Gulp is monitoring branch:",
							chalk.magenta(branch_name)
						);
					}

					// When the branch names do not match a switch was made.
					// Print some messages and exit the process.
					if (brn_current !== branch_name) {
						// message + exit
						print.gulp.warn(
							"Gulp stopped due to a branch switch.",
							`(branch_name => ${chalk.magenta(brn_current)})`
						);
						print.gulp.info(
							"Restart Gulp to monitor",
							chalk.magenta(brn_current),
							"branch."
						);

						process.exit();
					}
				}
			);

			done();
		});
	});
});

/**
 * Build app files.
 *
 * @internal - Used with the default task.
 */
gulp.task("init:build", function(done) {
	// Cache task.
	var task = this;

	// Get the gulp build tasks.
	var tasks = BUNDLE_GULP.tasks;

	// Add callback to the sequence.
	tasks.push(function() {
		notify("Build complete");
		done();
	});

	// Apply the tasks and callback to sequence and run the tasks.
	return sequence.apply(task, tasks);
});

/**
 * Variables are declared outside of tasks to be able to use them in
 *     multiple tasks. The variables are populated in the
 *     default:active-pid-check task and used in the default task.
 */
var __process_exists;
var __process_stopped;

/**
 * Checks for an active Gulp process before making another.
 *
 * @internal - Used with the default task.
 */
gulp.task("default:active-pid-check", function(done) {
	var __flags = yargs.argv; // Get cli parameters.

	// When the --stop flag is provided the Gulp instance must be stopped.
	if (__flags.stop) {
		// Set the task variable to true.
		__process_stopped = true;

		if (INT_PID) {
			// Kill the Gulp instance.
			print.gulp.success(
				`Gulp instance ${chalk.green(INT_PID)} stopped.`
			);
			process.kill(INT_PID);
		} else {
			// No open process exists so simply print out a message.
			print.gulp.warn("No Gulp process exists.");
		}

		return done();
	}

	// If a PID is stored it means a Gulp instance has already started
	// or the file was not cleared properly. This task will help determine
	// which case of the two it is.

	var find = require("find-process");

	// If no stored PID simply continue. No stored PID means there is
	// no active running gulp instance so continue the task normally
	// to create the Gulp instance.
	if (!INT_PID) {
		return done();
	} else {
		// Else if a PID exists determine if its active and a Gulp process.

		// Get the process information using the stored PID.
		find("pid", INT_PID).then(
			function(processes) {
				// This module will return an array containing the found
				// process in objects. Because we are supplying it the
				// PID the array will only return 1 object if the process
				// exists.

				// Get the process.
				var p = processes[0];

				// If no process exists then the process with the stored PID
				// does not exist and so we can proceed to the next task to
				// create a new instance.
				if (!p) {
					return done();
				}

				// When a process does exist then the following have to match
				// to make sure the process is legit. In other words if they
				// match then the process exists. An existing process will
				// prevent making other processes.
				// To-Do: Make this check better in the future.
				if (p.cmd === INT_TITLE && p.name.toLowerCase() === "gulp") {
					// A process exists so store the process information
					// to access it in the following task.
					__process_exists = p;
				}

				return done();
			},
			function(err) {
				if (err) {
					throw err;
				}
			}
		);
	}
});

/**
 * Runs Gulp.
 *
 * Notes
 *
 * • This is the default task that will build project files, watch files,
 *     run browser-sync, etc.
 * • Only one instance can be run at a time.
 *
 * Flags
 *
 * -s, --stop
 *     [boolean] Flag indicating to stop Gulp.
 *
 * Usage
 *
 * $ gulp
 *     Run Gulp.
 *
 * $ gulp --stop
 *     Stops the active Gulp process, if running.
 */
gulp.task("default", ["default:active-pid-check"], function(done) {
	// Check the default:active-pid-check variables before the actual
	// task code runs.

	// When the --stop flag is provided do not let the task run.
	if (__process_stopped) {
		return done();
	}

	// As only one Gulp instance is allowed return if a process exists.
	if (__process_exists) {
		print.gulp.warn(
			`Gulp process ${chalk.green(__process_exists.pid)}`,
			"is running. Stop it before starting a new one."
		);
		print.gulp.info(
			"Stop current instance by running: $ gulp settings --rebuild"
		);

		return done();
	}

	// Actual task starts here.

	var find_free_port = require("find-free-port");

	// Find free ports to open browser-sync on.
	return find_free_port(
		$configs.findfreeport.range.start,
		$configs.findfreeport.range.end,
		$configs.findfreeport.ip,
		$configs.findfreeport.count,
		function(err, p1, p2) {
			// Store the ports.
			$internal.set("process", {
				ports: {
					local: p1,
					ui: p2
				}
			});

			// Save ports.
			$internal.write(
				function() {
					// Store ports on the browser-sync object itself.
					bs.__ports = [p1, p2]; // [app, ui]

					// After getting the free ports run the build task.
					return sequence(
						"init:save-pid",
						"init:watch-git-branch",
						"init:build",
						function() {
							// Pretty files before working on them for
							// the first time.
							cmd.get(`${GULPCLI} pretty -q`, function(
								err,
								data
							) {
								if (err) {
									throw err;
								}

								// Highlight data string.
								print(cli_highlight(data));

								// Finally, watch files for changes.
								return sequence("watch", function() {
									done();
								});
							});
						}
					);
				},
				null,
				JINDENT
			);
		}
	);
});

// -----------------------------------------------------------------------------
// dist.js -- ./gulp/main/source/tasks/dist.js
// -----------------------------------------------------------------------------

/**
 * Remove old dist/ folder.
 *
 * @internal - Used to prepare the dist task.
 */
gulp.task("dist:clean", function(done) {
	pump(
		[gulp.src($paths.dist_home, opts_remove), $.debug.clean(), $.clean()],
		done
	);
});

/**
 * Copy new file/folders.
 *
 * @internal - Used to prepare the dist task.
 */
gulp.task("dist:favicon", function(done) {
	pump(
		[
			gulp.src(BUNDLE_DIST.source.files.favicon, {
				dot: true,
				cwd: $paths.basedir,
				// To keep the sub-folders define the base in the options.
				// [https://github.com/gulpjs/gulp/issues/151#issuecomment-41508551]
				base: $paths.dot
			}),
			$.debug(),
			gulp.dest($paths.dist_home),
			$.debug.edit()
		],
		done
	);
});

/**
 * Build the distribution CSS files/folders.
 *
 * @internal - Used to prepare the dist task.
 */
gulp.task("dist:css", function(done) {
	pump(
		[
			gulp.src(BUNDLE_DIST.source.files.css, {
				dot: true,
				cwd: $paths.basedir,
				base: $paths.dot
			}),
			$.debug(),
			$.gulpif(extension.iscss, $.clean_css()),
			gulp.dest($paths.dist_home),
			$.debug.edit()
		],
		done
	);
});

/**
 * Run images through imagemin to optimize them.
 *
 * @internal - Used to prepare the dist task.
 */
gulp.task("dist:img", function(done) {
	// Copy hidden files/folders?
	// [https://github.com/klaascuvelier/gulp-copy/issues/5]

	pump(
		[
			gulp.src(BUNDLE_DIST.source.files.img, {
				dot: true,
				cwd: $paths.basedir,
				base: $paths.dot
			}),
			$.cache(
				$.imagemin([
					$.imagemin.gifsicle({
						interlaced: true
					}),
					$.imagemin.jpegtran({
						progressive: true
					}),
					$.imagemin.optipng({
						optimizationLevel: 5
					}),
					$.imagemin.svgo({
						plugins: [
							{
								removeViewBox: true
							}
						]
					})
				])
			),
			gulp.dest($paths.dist_home),
			$.debug.edit()
		],
		done
	);
});

/**
 * Build the distribution JS files/folders.
 *
 * @internal - Used to prepare the dist task.
 */
gulp.task("dist:js", function(done) {
	pump(
		[
			gulp.src(BUNDLE_DIST.source.files.js, {
				dot: true,
				cwd: $paths.basedir,
				base: $paths.dot
			}),
			$.debug(),
			$.gulpif(extension.isjs, $.uglify()),
			gulp.dest($paths.dist_home),
			$.debug.edit()
		],
		done
	);
});

/**
 * Copy over the root files to the distribution folder.
 *
 * @internal - Used to prepare the dist task.
 */
gulp.task("dist:root", function(done) {
	pump(
		[
			gulp.src(BUNDLE_DIST.source.files.root, {
				dot: true,
				cwd: $paths.basedir,
				base: $paths.dot
			}),
			$.debug(),
			$.gulpif(extension.ishtml, $.minify_html()),
			gulp.dest($paths.dist_home),
			$.debug.edit()
		],
		done
	);
});

/**
 * Build the dist/ folder (webapp projects only).
 *
 * Usage
 *
 * $ gulp dist
 *     Create dist/ folder.
 */
gulp.task("dist", function(done) {
	// Cache task.
	var task = this;

	// If the apptype is not a webapp then stop task.
	if (INt_APPTYPE !== "webapp") {
		print.gulp.warn(
			"This helper task is only available for webapp projects."
		);
		return done();
	}

	// Get the gulp build tasks.
	var tasks = BUNDLE_DIST.tasks;

	// Add callback to the sequence.
	tasks.push(function() {
		var message = "Distribution folder complete.";
		notify(message);
		print.gulp.success(message);
		done();
	});

	// Apply the tasks and callback to sequence and run the tasks.
	return sequence.apply(task, tasks);
});

// -----------------------------------------------------------------------------
// lib.js -- ./gulp/main/source/tasks/lib.js
// -----------------------------------------------------------------------------

/**
 * Remove old lib/ folder.
 *
 * @internal - Used to prepare the lib task.
 */
gulp.task("lib:clean", function(done) {
	pump(
		[gulp.src($paths.lib_home, opts_remove), $.debug.clean(), $.clean()],
		done
	);
});

/**
 * Build the library JS files/folders.
 *
 * @internal - Used to prepare the lib task.
 */
gulp.task("lib:js", function(done) {
	pump(
		[
			gulp.src(BUNDLE_JS.source.files, {
				nocase: true,
				cwd: $paths.js_source
			}),
			// Filter out all but test files (^test*/i).
			$.filter([$paths.files_all, $paths.not_tests]),
			$.debug(),
			$.concat(BUNDLE_JS.source.names.libs.main),
			$.prettier(PRETTIER),
			gulp.dest($paths.lib_home),
			$.debug.edit(),
			$.uglify(),
			$.rename(BUNDLE_JS.source.names.libs.min),
			gulp.dest($paths.lib_home),
			$.debug.edit()
		],
		done
	);
});

/**
 * Build the lib/ folder. (only for library projects).

 * Usage
 *
 * $ gulp lib
 *     Create lib/ folder.
 */
gulp.task("lib", function(done) {
	// Cache task.
	var task = this;

	// If the apptype is not a library then stop task.
	if (INT_APPTYPE !== "library") {
		print.gulp.warn(
			"This helper task is only available for library projects."
		);
		return done();
	}

	// Get the gulp build tasks.
	var tasks = BUNDLE_LIB.tasks;

	// Add callback to the sequence.
	tasks.push(function() {
		var message = "Library folder complete.";
		notify(message);
		print.gulp.success(message);
		done();
	});

	// Apply the tasks and callback to sequence and run the tasks.
	return sequence.apply(task, tasks);
});

// -----------------------------------------------------------------------------
// watch.js -- ./gulp/main/source/tasks/watch.js
// -----------------------------------------------------------------------------

/**
 * Watch for file changes.
 */
gulp.task("watch", function(done) {
	// Add auto tab closing capability to browser-sync. This will
	// auto close the created browser-sync tabs when gulp closes.
	bs.use({
		plugin() {},
		hooks: {
			"client:js": bs_autoclose
		}
	});

	// Start browser-sync.
	bs.init(
		{
			browser: browser,
			proxy: uri({
				appdir: APPDIR,
				filepath: INDEX,
				https: HTTPS
			}),
			port: bs.__ports[0],
			ui: {
				port: bs.__ports[1]
			},
			notify: false,
			open: true
		},
		function() {
			// Gulp watcher paths.
			var watch_paths = BUNDLE_GULP.watch;

			// Watch for any changes to HTML source files.
			$.watcher.create("watcher:html", watch_paths.html, ["html"]);

			// Watch for any changes to CSS source files.
			$.watcher.create("watcher:css:app", watch_paths.css.app, [
				"css:app"
			]);

			// Watch for any changes to CSS vendor files.
			$.watcher.create("watcher:css:vendor", watch_paths.css.vendor, [
				"css:vendor"
			]);

			// Watch for any changes to JS source files.
			$.watcher.create("watcher:js:app", watch_paths.js.app, ["js:app"]);

			// Watch for any changes to JS vendor files.
			$.watcher.create("watcher:js:vendor", watch_paths.js.vendor, [
				"js:vendor"
			]);

			// Watch for any changes to IMG files.
			$.watcher.create("watcher:img", watch_paths.img, ["img"]);

			// Watch for any changes to config files.
			$.watcher.create("watcher:settings", watch_paths.config, [
				"settings"
			]);

			// Is the following watcher needed?

			// // Watch for any changes to README.md.
			// gulp.watch([$paths.readme], {
			//     cwd: $paths.basedir
			// }, function() {
			//     return sequence("tohtml", function() {
			//         bs.reload();
			//     });
			// });

			done();
		}
	);
});

// -----------------------------------------------------------------------------
// html.js -- ./gulp/main/source/tasks/html.js
// -----------------------------------------------------------------------------

/**
 * Init HTML files + minify.
 */
gulp.task("html", function(done) {
	// Pause the watcher to prevent infinite loops.
	$.watcher.pause("watcher:html");

	pump(
		[
			gulp.src(BUNDLE_HTML.source.files, {
				cwd: $paths.html_source
			}),
			$.debug(),
			$.concat(BUNDLE_HTML.source.names.main),
			$.injection.pre({ replacements: html_injection }),
			$.beautify(JSBEAUTIFY),
			$.injection.post({ replacements: html_injection }),
			gulp.dest($paths.basedir),
			$.debug.edit(),
			bs.stream()
		],
		function() {
			// Un-pause and re-start the watcher.
			$.watcher.start("watcher:html");

			done();
		}
	);
});

// -----------------------------------------------------------------------------
// css.js -- ./gulp/main/source/tasks/css.js
// -----------------------------------------------------------------------------

/**
 * Build app.css + autoprefix + minify.
 *
 * @internal - Ran via the "css" task.
 */
gulp.task("css:app", function(done) {
	// Pause the watcher to prevent infinite loops.
	$.watcher.pause("watcher:css:app");

	var unprefix = require("postcss-unprefix");
	var autoprefixer = require("autoprefixer");
	var perfectionist = require("perfectionist");
	var shorthand = require("postcss-merge-longhand");

	pump(
		[
			gulp.src(BUNDLE_CSS.source.files, {
				cwd: $paths.css_source
			}),
			$.debug(),
			$.concat(BUNDLE_CSS.source.names.main),
			$.postcss([
				unprefix(),
				shorthand(),
				autoprefixer(AUTOPREFIXER),
				perfectionist(PERFECTIONIST)
			]),
			gulp.dest($paths.css_bundles),
			$.debug.edit(),
			bs.stream()
		],
		function() {
			// Un-pause and re-start the watcher.
			$.watcher.start("watcher:css:app");

			done();
		}
	);
});

/**
 * Build vendor bundle + minify + beautify.
 *
 * @internal - Ran via the "css" task.
 */
gulp.task("css:vendor", function(done) {
	// Pause the watcher to prevent infinite loops.
	$.watcher.pause("watcher:css:vendor");

	var unprefix = require("postcss-unprefix");
	var autoprefixer = require("autoprefixer");
	var perfectionist = require("perfectionist");
	var shorthand = require("postcss-merge-longhand");

	// Note: Absolute vendor library file paths should be used.
	// The paths should be supplied in ./configs/bundles.json
	// within the css.vendor.files array.

	pump(
		[
			gulp.src(BUNDLE_CSS.vendor.files),
			$.debug(),
			$.concat(BUNDLE_CSS.vendor.names.main),
			$.postcss([
				unprefix(),
				shorthand(),
				autoprefixer(AUTOPREFIXER),
				perfectionist(PERFECTIONIST)
			]),
			gulp.dest($paths.css_bundles),
			$.debug.edit(),
			bs.stream()
		],
		function() {
			// Un-pause and re-start the watcher.
			$.watcher.start("watcher:css:vendor");

			done();
		}
	);
});

/**
 * Build app.css & css vendor files + autoprefix + minify.
 */
gulp.task("css", function(done) {
	// Runs the css:* tasks.
	return sequence("css:app", "css:vendor", function() {
		done();
	});
});

// -----------------------------------------------------------------------------
// js.js -- ./gulp/main/source/tasks/js.js
// -----------------------------------------------------------------------------

/**
 * Build app.js + minify + beautify.
 *
 * @internal - Ran via the "js" task.
 */
gulp.task("js:app", function(done) {
	// Pause the watcher to prevent infinite loops.
	$.watcher.pause("watcher:js:app");

	pump(
		[
			gulp.src(BUNDLE_JS.source.files, {
				cwd: $paths.js_source
			}),
			$.debug(),
			$.concat(BUNDLE_JS.source.names.main),
			$.prettier(PRETTIER),
			gulp.dest($paths.js_bundles),
			$.debug.edit(),
			bs.stream()
		],
		function() {
			// Un-pause and re-start the watcher.
			$.watcher.start("watcher:js:app");

			done();
		}
	);
});

/**
 * Build vendor bundle + minify + beautify.
 *
 * @internal - Ran via the "js" task.
 */
gulp.task("js:vendor", function(done) {
	// Pause the watcher to prevent infinite loops.
	$.watcher.pause("watcher:js:vendor");

	// Note: absolute vendor library file paths should be used.
	// The paths should be supplied in ./configs/bundles.json
	// within the js.vendor.files array.

	pump(
		[
			gulp.src(BUNDLE_JS.vendor.files),
			$.debug(),
			$.concat(BUNDLE_JS.vendor.names.main),
			$.prettier(PRETTIER),
			gulp.dest($paths.js_bundles),
			$.debug.edit(),
			bs.stream()
		],
		function() {
			// Un-pause and re-start the watcher.
			$.watcher.start("watcher:js:vendor");

			done();
		}
	);
});

/**
 * Build app.js & js vendor files + autoprefix + minify.
 */
gulp.task("js", function(done) {
	// Runs the js:* tasks.
	return sequence("js:app", "js:vendor", function() {
		done();
	});
});

// -----------------------------------------------------------------------------
// img.js -- ./gulp/main/source/tasks/img.js
// -----------------------------------------------------------------------------

/**
 * Just trigger a browser-sync stream.
 */
gulp.task("img", function(done) {
	// Pause the watcher to prevent infinite loops.
	$.watcher.pause("watcher:img");

	// Copy hidden files/folders?
	// [https://github.com/klaascuvelier/gulp-copy/issues/5]

	pump([gulp.src($paths.img_source), $.debug(), bs.stream()], function() {
		// Un-pause and re-start the watcher.
		$.watcher.start("watcher:img");

		done();
	});
});

// -----------------------------------------------------------------------------
// modernizr.js -- ./gulp/main/source/helpers/modernizr.js
// -----------------------------------------------------------------------------

/**
 * Build Modernizr file.
 *
 * Usage
 *
 * $ gulp modernizr
 *     Build modernizr.js (uses ./modernizr.config.json).
 */
gulp.task("modernizr", function(done) {
	var modernizr = require("modernizr");

	modernizr.build($configs.modernizr, function(build) {
		// Build the modernizr file path.
		var file_location =
			$paths.vendor_modernizr + $paths.modernizr_file_name;

		// Create any missing folders.
		mkdirp($paths.vendor_modernizr, function(err) {
			if (err) {
				throw err;
			}

			// Save the file to vendor.
			fs.writeFile(file_location, build + EOL_ENDING, function() {
				// The following is only needed to log the file.
				pump(
					[
						gulp.src(file_location, {
							cwd: $paths.basedir
						}),
						$.debug.edit()
					],
					done
				);
			});
		});
	});
});

// -----------------------------------------------------------------------------
// tohtml.js -- ./gulp/main/source/helpers/tohtml.js
// -----------------------------------------------------------------------------

/**
 * Variables are declared outside of tasks to be able to use them in
 *     multiple tasks. The variables are populated in the tohtml:prepcss
 *     task and used in the tohtml task.
 */
var __markdown_styles;
var __markdown_stopped;

/**
 * Get the CSS markdown + prismjs styles.
 *
 * @internal - Used to prepare the tohtml task.
 */
gulp.task("tohtml:prepcss", function(done) {
	// Run yargs.
	var __flags = yargs.option("file", {
		type: "string"
	}).argv;

	// Get the command line arguments from yargs.
	var filename = __flags.f || __flags.file;

	// Check that the file is a markdown file.
	if (!extension.ismd({ path: filename })) {
		print.gulp.warn(
			`.${extension({
				path: filename
			})} file was provided.`
		);
		print.gulp.info("Need a .md (Markdown) file.");

		// Set the variable.
		__markdown_stopped = true;

		return done();
	}

	// Run gulp process.
	pump(
		[
			gulp.src(
				[$paths.markdown_styles_github, $paths.markdown_styles_prismjs],
				{
					cwd: $paths.markdown_assets
				}
			),
			$.debug(),
			$.concat($paths.markdown_concat_name),
			$.modify({
				fileModifier: function(file, contents) {
					// Store the contents in variable.
					__markdown_styles = contents;
					return contents;
				}
			}),
			$.debug.edit()
		],
		done
	);
});

/**
 * Converts Markdown (.md) file to .html.
 *
 * Notes
 *
 * • Files will get placed in ./markdown/previews/.
 *
 * Flags
 *
 * -f, --file
 *     [string] Path of file to convert. Defaults to ./README.md
 *
 * -o, --open
 *     [boolean] Flag indicating whether to open the converted file
 *     in the browser.
 *
 * Usage
 *
 * $ gulp tohtml --file ./README.md
 *     Convert README.md to README.html.
 *
 * $ gulp tohtml --file ./README.md --open
 *     Convert README.md to README.html and open file in browser.
 */
gulp.task("tohtml", ["tohtml:prepcss"], function(done) {
	// Check the tohtml:prepcss variables before the actual task code runs.
	if (__markdown_stopped) {
		return done();
	}

	// Actual task starts here.

	var prism = require("prismjs");
	// Extend the default prismjs languages.
	require("prism-languages");

	// Run yargs.
	var __flags = yargs
		.option("file", {
			alias: "f",
			default: "./README.md",
			type: "string"
		})
		.option("open", {
			alias: "o",
			type: "boolean"
		}).argv;

	// Get the command line arguments from yargs.
	var filename = __flags.f || __flags.file;
	var open = __flags.o || __flags.open;

	// Task logic:
	// - Get file markdown file contents.
	// - Convert contents into HTML via marked.
	// - Inject HTML fragment into HTML markdown template.
	// - Save file in markdown/previews/.

	// Make marked use prism for syntax highlighting.
	// [https://github.com/krasimir/techy/issues/30#issuecomment-238850743]
	$.marked.marked.setOptions({
		highlight: function(code, language) {
			// Default to markup when language is undefined or get an error.
			return prism.highlight(code, prism.languages[language || "markup"]);
		}
	});

	// Run gulp process.
	pump(
		[
			gulp.src(filename),
			$.debug(),
			$.marked(),
			$.modify({
				fileModifier: function(file, contents) {
					// Path offsets.
					var fpath = "../../favicon/";
					// Get file name.
					var filename = path.basename(file.path);

					// Return filled in template.
					return `
<!doctype html>
<html lang="en">
<head>
    <title>${filename}</title>
    <meta charset="utf-8">
    <meta name="description" content="Markdown to HTML preview.">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <link rel="apple-touch-icon" sizes="180x180" href="${fpath}/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="${fpath}/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="${fpath}/favicon-16x16.png">
    <link rel="manifest" href="${fpath}/manifest.json">
    <link rel="mask-icon" href="${fpath}/safari-pinned-tab.svg" color="#699935">
    <link rel="shortcut icon" href="${fpath}/favicon.ico">
    <meta name="msapplication-TileColor" content="#00a300">
    <meta name="msapplication-TileImage" content="${fpath}/mstile-144x144.png">
    <meta name="msapplication-config" content="${fpath}/browserconfig.xml">
    <meta name="theme-color" content="#f6f5dd">
    <!-- https://github.com/sindresorhus/github-markdown-css -->
	<style>${__markdown_styles}</style>
</head>
    <body class="markdown-body">${contents}</body>
</html>`;
				}
			}),
			$.beautify(JSBEAUTIFY),
			gulp.dest($paths.markdown_preview),
			// Open the file when the open flag is provided.
			$.gulpif(
				open,
				$.modify({
					fileModifier: function(file, contents) {
						// Note: fileModifier is being used here in a 'hacky'
						// way. fileModifier is intended to modify the file's
						// contents. However, the original file contents are
						// being returned. fileModifier in this case is being
						// used as a callback function to run the open task
						// as a shell command.

						// Get the converted HTML file name.
						var filename_rel = path.relative($paths.cwd, file.path);

						// Run the open task as a shell command to not
						// re-write the task logic.
						cmd.get(
							`${GULPCLI} open --file ${filename_rel}`,
							function(err, data) {
								if (err) {
									throw err;
								}
							}
						);

						return contents;
					}
				})
			),
			$.debug.edit(),
			bs.stream()
		],
		done
	);
});

// -----------------------------------------------------------------------------
// open.js -- ./gulp/main/source/helpers/open.js
// -----------------------------------------------------------------------------

/**
 * Opens provided file in browser.
 *
 * Notes
 *
 * • Tabs should be opened using the terminal via this task. Doing
 *   so will ensure the generated tab will auto-close when Gulp is
 *   closed. Opening tabs by typing/copy-pasting the project URL
 *   into the browser address bar will not auto-close the tab(s)
 *   due to security issues as noted here:
 *   [https://stackoverflow.com/q/19761241].
 *
 * Flags
 *
 * -f, --file
 *     <file> The path of the file to open.
 *
 * -p, --port
 *     [number] The port to open in. (Defaults to browser-sync port if
 *     available or no port at all.)
 *
 * -d, --directory
 *     [string] The directory path to open in a file manager.
 *
 * -e, --editor
 *     [string] The file path to open in the user's text editor to edit.
 *
 * --wait
 *     [boolean] To be Used with the -e/--editor flag. If provided the
 *     editor will wait to close and will only close manually (i.e.
 *     close the editor or exit the terminal task).
 *
 * --line
 *     [number] To be used with -e/--editor flag. Open the file at the
 *     provided line.
 *
 * --column
 *     [number] To be used with -e/--editor flag. Open the file at the
 *     provided column.
 *
 * --use
 *     [string] To be used with -e/--editor flag. Manually set the editor
 *     to use. Will default to the user's default editor via ($EDITOR/$VISUAL)
 *     environment variables.
 *
 * Usage
 *
 * $ gulp open --file index.html --port 3000
 *     Open index.html in port 3000.
 *
 * $ gulp open --file index.html
 *     Open index.html in browser-sync port is available or no port.
 *
 * $ gulp open --editor ./index.html --wait --line 12 --column 20 --use atom
 *     Open "./index.html" using the text editor Atom if available. Set
 *     the line to 12 and column 20. Use the --wait flag to close the process
 *     after the editor is close or the process is killed via the terminal.
 *
 * $ gulp open --directory .
 *     Open the root directory in a file manager.
 *
 * $ gulp open --directory ./docs
 *     Open the docs directory in a file manager.
 *
 * $ gulp open --directory docs/subextensions.md
 *     When a file is provided along with the directory, only the directory
 *     section of the path will be used to try and open in a file manager.
 */
gulp.task("open", function(done) {
	// Cache task.
	var task = this;

	// Run yargs.
	var __flags = yargs
		.option("directory", {
			alias: "d",
			type: "string"
		})
		.option("editor", {
			alias: "e",
			type: "string"
		}).argv;

	// Get the command line arguments from yargs.
	var directory = __flags.d || __flags.directory;
	var editor = __flags.e || __flags.editor;

	// If the directory flag is provided open directory in a file manager.
	if (directory) {
		// Parse the directory.
		var parts = path.parse(directory);

		if (!parts.ext) {
			// No file was passed in so reset the directory.
			directory = parts.dir + "/" + parts.base + "/";
		} else {
			// If a file is passed only get the directory part.
			directory = parts.dir + "/";
		}

		// Make the path absolute and relative to the main project root.
		directory = path.join("./", directory);

		// Check that the directory exists.
		if (!de.sync(directory)) {
			print.gulp.warn(
				"The directory",
				chalk.magenta(directory),
				"does not exist."
			);
			return done();
		}

		// Else the directory exists so open the file manager.
		require("opener")(directory, function() {
			done();
		});
	} else if (editor) {
		// If the editor flag is provided open the given file in the user's
		// default editor.

		var spawn = require("child_process").spawn;

		// Check that the file exists.
		if (!fe.sync(editor)) {
			print.gulp.warn(
				"The file",
				chalk.magenta(directory),
				"does not exist."
			);
			return done();
		}

		// Run yargs.
		var __flags = yargs
			.option("wait", {
				type: "boolean"
			})
			.option("line", {
				type: "number"
			})
			.option("column", {
				type: "number"
			})
			.option("use", {
				type: "string"
			}).argv;

		// Get the command line arguments from yargs.
		var wait = __flags.wait;
		var line = __flags.line;
		var column = __flags.column;
		var use_editor = __flags.use;

		// Get user's editor/flags needed to open file via the terminal.
		var editor = get_editor({
			file: {
				name: editor,
				line: line,
				column: 0
			},
			editor: use_editor
		});

		// Create the child process to open the editor.
		var child_process = spawn(editor.command, editor.flags, {
			stdio: "inherit",
			detached: true
		});

		// If an error occurs throw it.
		child_process.on("error", function(err) {
			if (err) {
				throw err;
			}
		});

		// If the wait flag is provided make the process hold until the
		// user closes the file or the terminal process is ended manually.
		if (wait) {
			// Once the file is closed continue with the task...
			child_process.on("exit", function(code, sig) {
				done();
			});
		} else {
			// Else close the process immediately.
			child_process.unref();
			return done();
		}
	} else {
		// Else open the file in a browser. Which is what this task was
		// originally set out to do.

		// Run yargs.
		var __flags = yargs
			.option("file", {
				alias: "f",
				demandOption: true,
				type: "string"
			})
			.option("port", {
				alias: "p",
				type: "number"
			}).argv;

		// Get the command line arguments from yargs.
		var file = __flags.f || __flags.file;

		// Check for explicitly provided port. If none is provided check
		// the internally fetched free ports and get the local port.
		var port =
			__flags.p ||
			__flags.port ||
			(
				INT_PORTS || {
					local: null
				}
			).local;

		// Open the file in the browser.
		return open_file_in_browser(file, port, done, task);
	}
});

// -----------------------------------------------------------------------------
// instance.js -- ./gulp/main/source/helpers/instance.js
// -----------------------------------------------------------------------------

/**
 * Print whether there is an active Gulp instance.
 *
 * Usage
 *
 * $ gulp status
 *     Print Gulp status.
 */
gulp.task("status", function(done) {
	print.gulp.info(
		INT_PID
			? `Gulp instance running. Process ${chalk.green(INT_PID)}.`
			: "Gulp is not running."
	);
	done();
});

/**
 * Print the currently used ports for browser-sync.
 *
 * Usage
 *
 * $ gulp ports
 *     Print uses ports.
 */
gulp.task("ports", function(done) {
	// No ports are in use so return and print message.
	if (!INT_PORTS) {
		print.gulp.info("No ports are in use.");
		return done();
	}

	// Ports exist.
	print.gulp.info(
		`Local: ${chalk.green(INT_PORTS.local)}, UI: ${chalk.green(
			INT_PORTS.ui
		)}`
	);
	done();
});

// -----------------------------------------------------------------------------
// pretty.js -- ./gulp/main/source/helpers/pretty.js
// -----------------------------------------------------------------------------

/**
 * Variable is declared outside of tasks to be able to use it in
 *     multiple tasks. The variable is populated in the pretty:gitfiles
 *     task and used in the pretty task.
 */
var __modified_git_files;

/**
 * Gets the modified files via Git.
 *
 * Flags
 *
 * -q, --quick
 *     [boolean] Only prettify the git modified files.
 *
 * --staged
 *     [boolean] Used with the --quick flag it only prettifies the staged
 *     files.
 *
 * @internal - Used to prepare the pretty task.
 */
gulp.task("pretty:gitfiles", function(done) {
	// Run yargs.
	var __flags = yargs
		.option("quick", {
			alias: "q",
			type: "boolean"
		})
		.option("staged", {
			type: "boolean"
		}).argv;

	// Get the command line arguments from yargs.
	var quick = __flags.quick;
	var staged = __flags.staged;

	// The flags must be present to get the modified files or else
	// skip to the main pretty task.
	if (!(quick || staged)) return done();

	// Reset the variable when the staged flag is provided.
	staged = staged ? "--cached" : "";

	// Diff filter: [https://stackoverflow.com/a/6879568]
	// Example plugin: [https://github.com/azz/pretty-quick]

	// The command to run.
	var command = `git diff --name-only --diff-filter="ACMRTUB" ${staged}`;

	// Get the list of modified files.
	cmd.get(command, function(err, data, stderr) {
		// Clean the data.
		data = data.trim();

		// Set the variable. If the data is empty there are no
		// files to prettify so return an empty array.
		__modified_git_files = data ? data.split("\n") : [];

		return done();
	});
});

/**
 * Beautify all HTML, JS, CSS, and JSON project files.
 *
 * Notes
 *
 * • By default files in the following directories or containing the
 *   following sub-extensions are ignored: ./node_modules/, ./git/,
 *   vendor/, .ig., and .min. files.
 * • Special characters in globs provided via the CLI (--pattern) might
 *   need to be escaped if getting an error.
 *
 * Flags
 *
 * -t, --type
 *     [string] The file extensions types to clean.
 *
 * -p, --pattern
 *     [array] Use a glob to find files to prettify.
 *
 * -i, --ignore
 *     [array] Use a glob to ignore files.
 *
 * --test
 *     [boolean] A test run that only shows the used globs before
 *     prettifying. Does not prettify at all.
 *
 * -e, --empty
 *     [boolean] Empty default globs array. Careful as this can prettify
 *     all project files. By default the node_modules/ is ignored, for
 *     example. Be sure to exclude files that don't need to be prettified
 *     by adding the necessary globs with the --pattern option.
 *
 * -l, --line-ending
 *     [string] If provided, the file ending will get changed to provided
 *     character(s). Line endings default to LF ("\n").
 *
 * Usage
 *
 * $ gulp pretty
 *     Prettify all HTML, CSS, JS, JSON files.
 *
 * $ gulp pretty --type "js, json"
 *     Only prettify JS and JSON files.
 *
 * $ gulp pretty --pattern "some/folder/*.js"
 *     Prettify default files and all JS files.
 *
 * $ gulp pretty --ignore "*.js"
 *     Prettify default files and ignore JS files.
 *
 * $ gulp pretty --test
 *     Halts prettifying to show the globs to be used for prettifying.
 *
 * $ gulp pretty --empty --pattern "some/folder/*.js"
 *     Flag indicating to remove default globs.
 *
 * $ gulp pretty --line-ending "\n"
 *     Make files have "\n" line-ending.
 *
 * $ gulp pretty --quick
 *     Only prettify the git modified files.
 *
 * $ gulp pretty --staged
 *     Performs a --quick prettification on Git staged files.
 */
gulp.task("pretty", ["pretty:gitfiles"], function(done) {
	var unprefix = require("postcss-unprefix");
	var autoprefixer = require("autoprefixer");
	var perfectionist = require("perfectionist");
	var shorthand = require("postcss-merge-longhand");

	// Run yargs.
	var __flags = yargs
		.option("type", {
			alias: "t",
			type: "string"
		})
		.option("pattern", {
			alias: "p",
			type: "array"
		})
		.option("ignore", {
			alias: "i",
			type: "array"
		})
		.option("test", {
			type: "boolean"
		})
		.option("empty", {
			alias: "e",
			type: "boolean"
		})
		.option("line-ending", {
			alias: "l",
			type: "string"
		}).argv;

	// Get the command line arguments from yargs.
	var type = __flags.t || __flags.type;
	var patterns = __flags.p || __flags.pattern;
	var ignores = __flags.i || __flags.ignore;
	var test = __flags.test;
	var empty = __flags.e || __flags.empty;
	var ending = __flags.l || __flags["line-ending"] || EOL_ENDING;

	// Default globs: look for HTML, CSS, JS, and JSON files. They also
	// exclude files containing a ".min." as this is the convention used
	// for minified files. The node_modules/, .git/, and all vendor/
	// files are also excluded.
	var files = [
		$paths.files_common,
		$paths.not_min,
		bangify(globall($paths.node_modules_name)),
		bangify(globall($paths.git)),
		$paths.not_vendor,
		$paths.not_ignore
	];

	// When the empty flag is provided the files array will be emptied.
	if (empty) {
		files.length = 0;
	}

	// Merge the changed files to the patterns array. This means that the
	// --quick/--staged flags are set.
	if (__modified_git_files) {
		// Note: When the __modified_git_files variable is an empty array
		// this means that there are no Git modified/staged files. So
		// simply remove all the globs from the files array to prevent
		// anything from being prettified.
		if (!__modified_git_files.length) {
			files.length = 0;
		}

		// Add the changed files to the patterns array.
		patterns = (patterns || []).concat(__modified_git_files);
	}

	// Reset the files array when extension types are provided.
	if (type) {
		// Remove all spaces from provided types string.
		type = type.replace(/\s+?/g, "");

		// Note: When using globs and there is only 1 file type like in
		// ".{js}", for example, it will not work. As this won't work the
		// "{}" must not be present. They only seem to work when multiple
		// options are used like .{js,css,html}. This is normalized below.
		if (-~type.indexOf(",")) {
			type = "{" + type + "}";
		}

		// Finally, reset the files array.
		files[0] = `**/*.${type}`;
	}

	// Add user provided glob patterns.
	if (patterns) {
		// Only do changes when the type flag is not provided. Therefore,
		// in other words, respect the type flag.
		if (!type) {
			files.shift();
		}

		// Add the globs.
		patterns.forEach(function(glob) {
			files.push(glob);
		});
	}

	// Add user provided exclude/negative glob patterns. This is useful
	// when needing to exclude certain files/directories.
	if (ignores) {
		// Add the globs.
		ignores.forEach(function(glob) {
			files.push(bangify(glob));
		});
	}

	// Show the used glob patterns when the flag is provided.
	if (test) {
		print.ln();
		print(chalk.underline("Patterns"));

		// Log the globs.
		files.forEach(function(glob) {
			print(`  ${glob}`);
		});

		print.ln();

		return done();
	}

	pump(
		[
			gulp.src(files, {
				dot: true,
				base: $paths.dot
			}),
			// Note: Filter out all non common files. This is more so a
			// preventive measure as when using the --quick flag any modified
			// files will get passed in. This makes sure to remove all image,
			// markdown files for example.
			$.filter([$paths.files_common]),
			$.sort(opts_sort),
			// Prettify HTML files.
			$.gulpif(extension.ishtml, $.beautify(JSBEAUTIFY)),
			// Sort JSON files.
			$.gulpif(
				function(file) {
					// Note: File must be a JSON file and cannot contain the
					// comment (.cm.) sub-extension to be sortable as comments
					// are not allowed in JSON files.
					return extension(file, ["json"]) &&
						!-~file.path.indexOf(".cm.")
						? true
						: false;
				},
				$.json_sort({
					space: JINDENT
				})
			),
			// Prettify JS/JSON files.
			$.gulpif(function(file) {
				// Exclude HTML and CSS files.
				return extension(file, ["html", "css"]) ? false : true;
			}, $.prettier(PRETTIER)),
			// Prettify CSS files.
			$.gulpif(
				extension.iscss,
				$.postcss([
					unprefix(),
					shorthand(),
					autoprefixer(AUTOPREFIXER),
					perfectionist(PERFECTIONIST)
				])
			),
			$.eol(ending),
			$.debug.edit(),
			gulp.dest($paths.basedir)
		],
		done
	);
});

// -----------------------------------------------------------------------------
// module.js -- ./gulp/main/source/helpers/module.js
// -----------------------------------------------------------------------------

/**
 * Beautify all HTML, JS, CSS, and JSON project files.
 *
 * Flags
 *
 * --filename
 *     <string> The file name of the new module file.
 *
 * --remove
 *     [string] The file name of the module to remove.
 *
 * --modname
 *     [string] The name of the module within the app. Defaults to the
 *     filename without the extension.
 *
 * --description
 *     [string] Optional description of the module.
 *
 * --mode
 *     [string] The mode the module should load via. (interactive/complete)
 *
 * --same
 *     [boolean] Flag indicating whether to use the same filename for the
 *     modname.
 *
 * Usage
 *
 * $ gulp module --filename "my_module" --same --mode "complete"
 *     Make a module "new_module.js". The extension will be added it not
 *     provided. The same file name will be used for the modname. It will
 *     also load when the document readyState hits complete.
 *
 * $ gulp module --filename "test" --same --description "My cool module."
 *     Make a module "test.js" with a description of "My cool module."
 *
 * $ gulp module --filename "my_cool_module"
 *     Simplest way to make a module. This will make a module with the name
 *     "my_cool_module.js". Have the name of "my_cool_module", load on
 *     "complete", and have an empty description.
 *
 * $ gulp module --filename "my_cool_module" --modname "coolModule"
 *     This will make a module with the name "my_cool_module.js". Have the
 *     name of "coolModule", load on "complete", and have an empty
 *     description.
 *
 * $ gulp module --remove "my_cool_module.js"
 *     This will remove the module "my_cool_module.js".
 */
gulp.task("module", function(done) {
	var linenumber = require("linenumber");

	// Run yargs.
	var __flags = yargs.option("remove", {
		type: "string"
	}).argv;

	// Get the command line arguments from yargs.
	var remove = __flags.remove;

	// Get the configuration file.
	var config_file = get_config_file($paths.config_$bundles);

	// Remove the module when the remove flag is provided.
	if (remove) {
		// Check for a file extension.
		var ext = extension({ path: remove });

		// If no extension make sure to add the extension.
		if (!ext) {
			remove += ".js";
		}

		// Path to the config file.
		var file = path.join($paths.js_source_modules, remove);

		// Before anything is done make sure to check that the name
		// is not already taken by another file. We don't want to
		// overwrite an existing file.
		if (!fe.sync(file)) {
			print.gulp.warn(
				"The module",
				chalk.magenta(remove),
				"does not exist."
			);
			return done();
		}

		pump(
			[gulp.src(file, opts_remove), $.debug.clean(), $.clean()],
			function() {
				// Get the line number where the configuration array exists.
				// Looking for the js.source.files array.
				var line = (linenumber(
					config_file,
					/\s"js":\s+\{\n\s+"source":\s+\{\n\s+"files":\s+\[/gim
				) || [{ line: 0 }])[0].line;

				cmd.get(
					`${GULPCLI} open -e ${config_file} --line ${line} --wait`,
					function(err, data) {
						if (err) {
							throw err;
						}

						// Update the js:app bundle.
						return sequence("js:app", function() {
							done();
						});
					}
				);
			}
		);
	} else {
		// Run yargs.
		var __flags = yargs
			.option("filename", {
				type: "string",
				demandOption: true
			})
			.option("modname", {
				type: "string"
			})
			.option("description", {
				default: "",
				type: "string"
			})
			.option("mode", {
				choices: ["interactive", "complete"],
				default: "complete",
				type: "string",
				demandOption: true
			})
			.option("same", {
				type: "boolean"
			}).argv;

		// Get the command line arguments from yargs.
		var filename = __flags.filename;
		var modname = __flags.modname;
		var description = __flags.description;
		var mode = __flags.mode;
		var same = __flags.same;
		var ending = __flags["line-ending"] || EOL_ENDING;

		// Get the basename from the filename.
		var ext = path.extname(filename);

		// When no extension is found reset it and the file name.
		if (!ext) {
			ext = ".js";
			filename = filename + ext;
		}

		// If the same flag is provided this means to use the same filename
		// for the name flag as well. Also, if no name is provided use the
		// filename without the extension as the name.
		if (same || !modname) {
			// Get the filename without the extension.
			modname = path.basename(filename, ext);
		}

		// The content template string for a module.
		var content = `app.module(
	"${modname}",
	function(modules, name) {
		// App logic...
	},
	"${mode}",
	"${description}"
);`;

		// Path to the config file.
		var file = path.join($paths.js_source_modules, filename);

		// Before anything is done make sure to check that the name
		// is not already taken by another file. We don't want to
		// overwrite an existing file.
		if (fe.sync(file)) {
			print.gulp.warn("The module", chalk.magenta(modname), "exists.");
			print.gulp.info("Use another file name.");
			return done();
		}

		pump(
			[
				// Create the file via gulp-file and use is at the Gulp.src.
				$.file(file, content, {
					src: true
				}),
				$.debug.edit(),
				gulp.dest($paths.basedir)
			],
			function() {
				// Get the line number where the config array exists.
				// Looking for the js.source.files array.
				var line = (linenumber(
					config_file,
					/\s"js":\s+\{\n\s+"source":\s+\{\n\s+"files":\s+\[/gim
				) || [{ line: 0 }])[0].line;

				cmd.get(
					`${GULPCLI} open -e ${config_file} --line ${line} --wait`,
					function(err, data) {
						if (err) {
							throw err;
						}

						// Update the js:app bundle.
						return sequence("js:app", function() {
							done();
						});
					}
				);
			}
		);
	}
});

// -----------------------------------------------------------------------------
// eol.js -- ./gulp/main/source/helpers/eol.js
// -----------------------------------------------------------------------------

/**
 * Correct file line endings.
 *
 * Flags
 *
 * -l, --line-ending
 *     [string] The type of line ending to use. Defauls to "\n".
 *
 * Usage
 *
 * $ gulp eol
 *     Check file line endings.
 *
 * $ gulp eol --line-ending "\n"
 *     Enforce "\n" line endings.
 */
gulp.task("eol", function(done) {
	// Run yargs.
	var __flags = yargs.option("line-ending", {
		alias: "l",
		type: "string"
	}).argv;

	// Get the command line arguments from yargs.
	var ending = __flags.l || __flags["line-ending"] || EOL_ENDING;

	// Check: HTML, CSS, JS, JSON, TXT, TEXT, and MD files. They also
	// exclude files containing a ".min." as this is the convention used
	// for minified files. The node_modules/, .git/, and all vendor/
	// files are also excluded.
	var files = [
		$paths.files_code,
		$paths.not_min,
		bangify($paths.img_source),
		bangify(globall($paths.node_modules_name)),
		bangify(globall($paths.git))
	];

	// Get needed files.
	pump(
		[
			gulp.src(files, {
				dot: true,
				base: $paths.dot
			}),
			$.sort(opts_sort),
			$.eol(ending),
			$.debug.edit(),
			gulp.dest($paths.basedir)
		],
		done
	);
});

// -----------------------------------------------------------------------------
// stats.js -- ./gulp/main/source/helpers/stats.js
// -----------------------------------------------------------------------------

/**
 * Prints table containing project file type breakdown.
 *
 * Notes
 *
 * • Depending on the project size, this task might take a while to run.
 *
 * Usage
 *
 * $ gulp stats
 *     Print a table containing project files type information.
 */
gulp.task("stats", function(done) {
	var Table = require("cli-table2");

	// Run yargs.
	var __flags = yargs.option("all", {
		type: "boolean"
	}).argv;

	// Get the command line arguments from yargs.
	var all = __flags.all;

	// Get all files excluding: node_modules/, .git/, and img/.
	var files = [
		// If the --all flag is provided use all the file types else
		// only use the common web file types.
		$paths["files_" + (all ? "code" : "common")],
		bangify($paths.img_source),
		bangify(globall($paths.node_modules_name)),
		bangify(globall($paths.git))
	];

	var file_count = 0;
	var extensions = {};

	// Get needed files.
	pump(
		[
			gulp.src(files, {
				dot: true,
				read: false
			}),
			$.fn(function(file) {
				// Get the extension type.
				var ext = path
					.extname(file.path)
					.toLowerCase()
					.slice(1);

				// Exclude any extension-less files.
				if (!ext) {
					return;
				}

				var ext_count = extensions[ext];

				file_count++;

				if (ext_count === undefined) {
					// Does not exist, so start extension count.
					extensions[ext] = 1;
				} else {
					// Already exists just increment the value.
					extensions[ext] = ++ext_count;
				}
			})
		],
		function() {
			// Instantiate.
			var table = new Table({
				head: ["Extensions", `Count (${file_count})`, "% Of Project"],
				style: { head: ["green"] }
			});

			// Add data to table.
			for (var ext in extensions) {
				if (extensions.hasOwnProperty(ext)) {
					var count = +extensions[ext];
					table.push([
						ext.toUpperCase(),
						count,
						Math.round(count / file_count * 100)
					]);
				}
			}

			// Sort table descendingly.
			table.sort(function(a, b) {
				return b[2] - a[2];
			});

			print(table.toString());

			done();
		}
	);
});

// -----------------------------------------------------------------------------
// files.js -- ./gulp/main/source/helpers/files.js
// -----------------------------------------------------------------------------

/**
 * List project files.
 *
 * Flags
 *
 * -t, --type
 *     [string] The optional extensions of files to list.
 *
 * -s, --stypes
 *     [string] The optional sub-extensions of files to list.
 *
 * -w, --whereis
 *     [string] Substring to search for. Uses fuzzy search by
 *     and default. (Ignores ./node_modules/ and .git/).
 *
 * -n, --nofuzzy
 *     [string] Flag indicating to turn off fuzzy search. Will
 *     use a simple indexOf() search instead.
 *
 * -h, --highlight
 *     [string] Highlight the --whereis term in the file path.
 *
 * Usage
 *
 * $ gulp files
 *     Shows all files excluding files in ./node_modules/ &
 *     .git/.
 *
 * $ gulp files --type "js html"
 *     Only list HTML and JS files.
 *
 * $ gulp files --type "js" --whereis "jquery"
 *     Print JS files containing "jquery" in path.
 *
 * $ gulp files --whereis "fastclick.js"
 *     Prints files containing fastclick.js in path.
 *
 * $ gulp files --stype "ig" --nofuzzy --highlight
 *     Turn off fuzzy search, find all files containing
 *     the "ig" sub-extension, and highlight string matches.
 *
 * $ gulp files --stype "min" --type "js"
 *     Find all files of type JS and containing the sub-extension
 *     "min".
 *
 * $ gulp files --subs
 *     List all used file sub-extensions.
 */
gulp.task("files", function(done) {
	var fuzzy = require("fuzzy");

	// Run yargs.
	var __flags = yargs
		.option("type", {
			alias: "t",
			type: "string"
		})
		.option("stype", {
			alias: "s",
			type: "string"
		})
		.option("whereis", {
			alias: "w",
			type: "string"
		})
		.option("nofuzzy", {
			alias: "n",
			type: "boolean"
		})
		.option("highlight", {
			alias: "H",
			type: "boolean"
		})
		.option("subs", {
			type: "boolean"
		}).argv;

	// Get the command line arguments from yargs.
	var types = __flags.t || __flags.type;
	var stypes = __flags.s || __flags.stype;
	var whereis = __flags.w || __flags.whereis;
	var no_fuzzy = __flags.n || __flags.nofuzzy;
	var highlight = __flags.H || __flags.highlight;
	var sub_extensions = __flags.subs;

	var clean_types = function(text) {
		// Collapse multiple spaces + remove left/right padding.
		text = text.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
		// Turn to an array.
		text = text.split(/\s+/);

		return text;
	};

	// If types provided clean them.
	if (types) {
		types = clean_types(types);
	}

	// If sub types provided clean them.
	if (stypes) {
		stypes = clean_types(stypes);
	}

	// Where files will be contained.
	var files = [];

	// Get all project files.
	dir.files($paths.dirname, function(err, paths) {
		if (err) {
			throw err;
		}

		// Skip files from these locations: .git/, node_modules/.
		loop1: for (var i = 0, l = paths.length; i < l; i++) {
			// Only get the relative path (relative to the root directory
			// of the project). The absolute path is not needed.
			var filepath = path.relative($paths.cwd, paths[i]);

			// Globs to ignore.
			var ignores = [$paths.node_modules_name, $paths.git];
			// Ignore files containing the above globs.
			for (var j = 0, ll = ignores.length; j < ll; j++) {
				var ignore = ignores[j];
				if (-~filepath.indexOf(ignore)) {
					continue loop1;
				}
			}
			// Add to files array.
			files.push(filepath);
		}

		// Filter the files based on their file extensions when the type
		// argument is provided.
		if (types) {
			files = files.filter(function(filepath) {
				return ext({ path: filepath }, types);
			});
		}

		// Filter the files based on their sub extensions when the type
		// argument is provided.
		if (stypes) {
			files = files.filter(function(filepath) {
				var subs_extensions = extension.subs({ path: filepath });

				// Check if path contains any of the passed in subs.
				for (var i = 0, l = stypes.length; i < l; i++) {
					var sub = stypes[i];
					if (-~subs_extensions.indexOf(sub)) {
						return true;
					}
				}

				// Else nothing matched so filter path out.
				return false;
			});
		}

		// List the used sub-extensions.
		if (sub_extensions) {
			// Store used sub-extensions.
			var subs_ = [];

			print.ln();
			print(chalk.underline("Sub-extensions"));

			// Loop over each path to find the sub-extensions.
			files.forEach(function(path_) {
				// Get the paths sub-extensions.
				var subs = extension.subs({ path: path_ });

				// Loop over the found sub-extensions and print them.
				if (subs.length) {
					subs.forEach(function(sub) {
						// If the sub does not exist store it and print.
						if (!-~subs_.indexOf(sub)) {
							print(`  ${sub}`);
							subs_.push(sub);
						}
					});
				}
			});

			print.ln();

			return done();
		}

		// Note: This lookup object is only used for highlight purposes
		// and will only be populate when the --whereis flag is provided.
		// It is a work around the fuzzy module. It will store the relative
		// file path with its file path containing the highlight wrappers
		// so it can be accessed in the debug modifier function.
		// Basically: { relative_file_path: file_path_with_wrappers}
		var lookup = whereis ? {} : false;

		// If whereis parameter is provided run a search on files.
		if (whereis) {
			// Filtered files containing the whereis substring/term
			// will get added into this array.
			var results = [];

			// Highlight wrappers: These will later be replaced and the
			// wrapped text highlight and bolded.
			var highlight_pre = "$<";
			var highlight_post = ">";

			// Run a non fuzzy search. When fuzzy search is turned off
			// we default back to an indexOf() search.
			if (no_fuzzy) {
				files.forEach(function(file) {
					if (-~file.indexOf(whereis)) {
						// Add the file path to the array.
						results.push(file);

						// Add the path to object.
						lookup[file] = file.replace(
							new RegExp(escape(whereis), "gi"),
							function(match) {
								return highlight_pre + match + highlight_post;
							}
						);
					}
				});
			} else {
				// Run a fuzzy search on the file paths.
				var fuzzy_results = fuzzy.filter(whereis, files, {
					pre: highlight_pre,
					post: highlight_post
				});

				// Turn into an array.
				fuzzy_results.forEach(function(result) {
					// Cache the original file path.
					var og_filepath = result.original;

					// Add the file path to the array.
					results.push(og_filepath);

					// Add the path containing the highlighting wrappers
					// to the object.
					lookup[og_filepath] = result.string;
				});
			}

			// Reset var to the newly filtered files.
			files = results;
		}

		// If the highlight flag is not provided simply run the debug
		// with default options. Else use the modifier option to
		// highlight the path. This was not done through gulpif because
		// gulpif was not playing nice with the debug plugin as the CLI
		// loader was messing up.
		var options =
			highlight && whereis
				? {
						// The modifier function will be used to highlight
						// the search term in the file path.
						modifier: function(data) {
							// Remove placeholders and apply highlight.
							var string = lookup[data.paths.relative].replace(
								/\$<(.*?)\>/g,
								function(match) {
									return chalk.bold.yellow(
										match.replace(/^\$<|\>$/g, "")
									);
								}
							);

							// Update the data object.
							data.file_path = string;
							data.output = `=> ${string} ${data.size} ${
								data.action
							}`;

							// Return the updated data object.
							return data;
						}
					}
				: {};

		// Log files.
		pump([gulp.src(files), $.sort(opts_sort), $.debug(options)], done);
	});
});

// -----------------------------------------------------------------------------
// dependency.js -- ./gulp/main/source/helpers/dependency.js
// -----------------------------------------------------------------------------

/**
 * Add/remove front-end dependencies.
 *
 * Notes
 *
 * • Dependencies are grabbed from ./node_modules/<name> and moved
 *   to its corresponding ./<type>/vendor/ folder.
 * • name, type, and action options are grouped. This means when one
 *   is used they must all be provided.
 *
 * Flags
 *
 * -n, --name
 *     <string>  The module name.
 *
 * -t, --type
 *     <string>  Dependency type (js/css).
 *
 * -a, --action
 *     <string>  Action to take (add/remove).
 *
 * -l, --list
 *     <boolean> Print all CSS/JS dependencies.
 *
 * Usage
 *
 * $ gulp dependency --name fastclick --type js --action add
 *     Copy fastclick to JS vendor directory.
 *
 * $ gulp dependency --name fastclick --type js --action remove
 *     Remove fastclick from JS vendor directory.
 *
 * $ gulp dependency --name font-awesome --type css --action add
 *     Add font-awesome to CSS vendor directory.
 *
 * $ gulp dependency --list
 *     Show all CSS/JS dependencies.
 */
gulp.task("dependency", function(done) {
	// Run yargs.
	var __flags = yargs
		.option("name", {
			alias: "n",
			type: "string"
		})
		.option("type", {
			alias: "t",
			choices: ["js", "css"],
			type: "string"
		})
		.option("action", {
			alias: "a",
			choices: ["add", "remove"],
			type: "string"
		})
		.group(
			["name", "type", "action"],
			"Options: Vendor dependency information (all required when any is provided)"
		)
		// Name, type, and action must all be provided when one is provided.
		.implies({
			name: "type",
			type: "action",
			action: "name"
		})
		.option("list", {
			alias: "l",
			type: "boolean"
		}).argv;
	// Get the command line arguments from yargs.
	var name = __flags.n || __flags.name;
	var type = __flags.t || __flags.type;
	var action = __flags.a || __flags.action;
	var list = __flags.l || __flags.list;

	// Get needed paths.
	var dest = type === "js" ? $paths.js_vendor : $paths.css_vendor;
	var delete_path = dest + name;
	var module_path = $paths.node_modules + name;

	// Print used vendor dependencies if flag provided.
	if (list) {
		// Get the vendor dependencies.
		var css_dependencies = BUNDLE_CSS.vendor.files;
		var js_dependencies = BUNDLE_JS.vendor.files;

		print.ln();
		print(chalk.underline("Dependencies"));

		// Printer function.
		var printer = function(dependency) {
			// Get the name of the folder.
			var name = dependency.match(/^(css|js)\/vendor\/(.*)\/.*$/);
			// When folder name is not present leave the name empty.
			name = name ? `(${name[2]})` : "";

			print(`    ${chalk.magenta(dependency)} ${name}`);
		};

		// Get the config path for the bundles file.
		var bundles_path = get_config_file($paths.config_$bundles);
		var header = `${bundles_path} > $.vendor.files[...]`;

		// Print the dependencies.
		print(" ", chalk.green(header.replace("$", "css")));
		css_dependencies.forEach(printer);
		print(" ", chalk.green(header.replace("$", "js")));
		js_dependencies.forEach(printer);

		print.ln();

		return done();
	}

	// Check that the module exists.
	if (action === "add" && !de.sync(module_path)) {
		print.gulp.warn(
			"The module",
			chalk.magenta(module_path),
			"does not exist."
		);
		print.gulp.info(
			`Install the dependency by running: $ yarn add ${name} --dev. Then try again.`
		);
		return done();
	} else if (action === "remove" && !de.sync(delete_path)) {
		print.gulp.warn(
			"The module",
			chalk.magenta(delete_path),
			"does not exist."
		);
		return done();
	}
	// Delete the old module folder.
	del([delete_path]).then(function() {
		var message =
			`Dependency (${name}) ` +
			(action === "add" ? "added" : "removed" + ".");
		if (action === "add") {
			// Copy module to location.
			pump(
				[
					gulp.src(name + $paths.delimiter + $paths.files_all, {
						dot: true,
						cwd: $paths.node_modules,
						base: $paths.dot
					}),
					$.rename(function(path) {
						// Remove the node_modules/ parent folder.
						// [https://stackoverflow.com/a/36347297]
						var regexp = new RegExp("^" + $paths.node_modules_name);
						path.dirname = path.dirname.replace(regexp, "");
					}),
					gulp.dest(dest),
					$.debug.edit()
				],
				function() {
					print.gulp.success(message);
					done();
				}
			);
		} else {
			// Remove.
			print.gulp.success(message);
			done();
		}
	});
});

// -----------------------------------------------------------------------------
// make.js -- ./gulp/main/source/helpers/make.js
// -----------------------------------------------------------------------------

/**
 * Build gulpfile from source files.
 *
 * Usage
 *
 * $ gulp make
 *     Re-build gulpfile.
 */
gulp.task("make", function(done) {
	// Get file names to use.
	var names = BUNDLE_GULP.source.names;
	var name_default = names.default;
	var name_main = names.main;

	pump(
		[
			gulp.src(BUNDLE_GULP.source.files, {
				cwd: $paths.gulp_source
			}),
			$.debug(),
			$.foreach(function(stream, file) {
				// The max length of characters for decoration line.
				var max_length = 80;
				var decor = "// " + "-".repeat(max_length - 3);

				var filename = path.basename(file.path);
				var filename_rel = path.relative($paths.cwd, file.path);

				var line_info = `${decor}\n// ${filename} -- ./${filename_rel}\n${decor}\n\n`;

				return stream.pipe($.insert.prepend(line_info));
			}),
			// If gulpfile.js exists use that name else fall back to
			// gulpfile-main.js.
			$.gulpif(
				fe.sync($paths.basedir + name_default),
				$.concat(name_default),
				$.concat(name_main)
			),
			$.prettier(PRETTIER),
			gulp.dest($paths.basedir),
			$.debug.edit()
		],
		done
	);
});

// -----------------------------------------------------------------------------
// lintjs.js -- ./gulp/main/source/helpers/lintjs.js
// -----------------------------------------------------------------------------

/**
 * Lint a JS file.
 *
 * Flags
 *
 * -f, --file
 *     <string>  The JS file to lint.
 *
 * Usage
 *
 * $ gulp lintjs --file ./gulpfile.js
 *     Lint gulpfile.js
 *
 */
gulp.task("lintjs", function(done) {
	// Run yargs.
	var __flags = yargs.option("file", {
		alias: "f",
		type: "string",
		demandOption: true
	}).argv;
	// Get the command line arguments from yargs.
	var file = __flags.f || __flags.file || "";

	// Don't search for a config file as a config object will be supplied
	// instead.
	$.jshint.lookup = false;

	pump(
		[
			gulp.src(file, {
				cwd: $paths.basedir
			}),
			$.debug(),
			$.jshint($configs.jshint),
			$.jshint.reporter("jshint-stylish")
		],
		done
	);
});

// -----------------------------------------------------------------------------
// lintcss.js -- ./gulp/main/source/helpers/lintcss.js
// -----------------------------------------------------------------------------

/**
 * Lint a CSS file.
 *
 * Flags
 *
 * -f, --file
 *     <string>  The CSS file to lint.
 *
 * Usage
 *
 * $ gulp lintcss --file ./css/bundles/vendor.css
 *     Lint ./css/bundles/vendor.css
 *
 */
gulp.task("lintcss", function(done) {
	// Run yargs.
	var __flags = yargs.option("file", {
		alias: "f",
		type: "string",
		demandOption: true
	}).argv;
	// Get the command line arguments from yargs.
	var file = __flags.f || __flags.file || "";

	// Get the stylish logger.
	var stylish = require("csslint-stylish");

	pump(
		[
			gulp.src(file, {
				cwd: $paths.basedir
			}),
			$.debug(),
			$.csslint($configs.csslint),
			$.csslint.formatter(stylish)
		],
		done
	);
});

// -----------------------------------------------------------------------------
// linthtml.js -- ./gulp/main/source/helpers/linthtml.js
// -----------------------------------------------------------------------------

/**
 * Lint a HTML file.
 *
 * Flags
 *
 * -f, --file
 *     <string>  The HTML file to lint.
 *
 * Usage
 *
 * $ gulp linthtml --file ./index.html
 *     Lint ./index.html
 *
 */
gulp.task("linthtml", function(done) {
	// Run yargs.
	var __flags = yargs.option("file", {
		alias: "f",
		type: "string",
		demandOption: true
	}).argv;
	// Get the command line arguments from yargs.
	var file = __flags.f || __flags.file || "";

	function reporter(filepath, issues) {
		if (issues.length) {
			filepath = path.relative($paths.cwd, filepath);
			issues.forEach(function(issue) {
				// Make sure the first letter is always capitalized.
				var first_letter = issue.msg[0];
				issue.msg = first_letter.toUpperCase() + issue.msg.slice(1);

				// Try to print in the style of other linters.
				print.ln();
				print(chalk.underline(filepath));
				print(
					" ",
					chalk.white(`line ${issue.line} char ${issue.column}`),
					chalk.blue(`(${issue.code})`),
					chalk.yellow(`${issue.msg}.`)
				);
				print.ln();
			});

			print(`    ${chalk.yellow("⚠")}  ${issues.length} warning(s)`);
			print.ln();

			process.exitCode = 1;
		}
	}

	pump(
		[
			gulp.src(file, {
				cwd: $paths.basedir
			}),
			$.debug({ loader: false }),
			$.htmllint({ rules: $configs.htmllint }, reporter)
		],
		done
	);
});

// -----------------------------------------------------------------------------
// settings.js -- ./gulp/main/source/helpers/settings.js
// -----------------------------------------------------------------------------

/**
 * Build ./configs/.__settings.json
 *
 * Flags
 *
 * --rebuild
 *     [boolean] Flag is used to rebuild the combined config file
 *     when it was deleted for example. The gulpfile needs this
 *     file and this will force its re-build when it gets deleted
 *     for whatever reason.
 *
 * Usage
 *
 * $ gulp settings # Re-build the settings file.
 *
 * $ gulp settings --rebuild # Force settings file re-build when
 *     the file gets deleted for whatever reason.
 */
gulp.task("settings", function(done) {
	// Pause the watcher to prevent infinite loops.
	$.watcher.pause("watcher:settings");

	pump(
		[
			gulp.src($paths.config_settings_json_files, {
				cwd: $paths.basedir
			}),
			$.debug(),
			$.strip_jsonc(), // Remove any json comments.
			$.jsoncombine($paths.config_settings_name, function(data) {
				return new Buffer(JSON.stringify(data, null, JINDENT));
			}),
			gulp.dest($paths.config_home),
			$.debug.edit()
		],
		function() {
			// Un-pause and re-start the watcher.
			$.watcher.start("watcher:settings");

			done();
		}
	);
});

// -----------------------------------------------------------------------------
// indent.js -- ./gulp/main/source/helpers/indent.js
// -----------------------------------------------------------------------------

/**
 * Indent all JS files with tabs or spaces.
 *
 * Notes
 *
 * • This task is currently experimental.
 * • Ignores ./node_modules/, ./git/ and vendor/ files.
 *
 * Flags
 *
 * --style
 *     [string] Indent using spaces or tabs. Defaults to tabs.
 *
 * --size
 *     [string] The amount of spaces to use. Defaults to 4.
 *
 * Usage
 *
 * $ gulp indent --style tabs
 *     Turn all 4 starting spaces into tabs.
 *
 * $ gulp indent --style spaces --size 2
 *     Expand all line starting tabs into 2 spaces.
 */
gulp.task("indent", function(done) {
	// Run yargs.
	var __flags = yargs
		.option("style", {
			type: "string"
		})
		.option("size", {
			type: "number"
		}).argv;

	// Get the command line arguments from yargs.
	var style = __flags.style || "tabs";
	var size = __flags.size || 4; // Spaces to use.

	// Print the indentation information.
	print.gulp.info(
		`Using: ${chalk.magenta(style)}. Size: ${chalk.green(size)}.`
	);

	pump(
		[
			gulp.src(
				[
					$paths.files_all.replace(/\*$/, "js"), // Only JS FILES.
					bangify(globall($paths.node_modules_name)),
					bangify(globall($paths.git)),
					$paths.not_vendor
				],
				{
					base: $paths.base_dot
				}
			),
			$.gulpif(
				// Convert tabs to spaces.
				style === "tabs",
				$.replace(/^( )+/gm, function(match) {
					// Split on the amount size provided.
					// [https://stackoverflow.com/a/6259543]
					var chunks = match.match(new RegExp(`.\{1,${size}\}`, "g"));

					// Modify the chunks.
					chunks = chunks.map(function(chunk) {
						return !(chunk.length % size) ? "\t" : chunk;
					});

					// Join and return new indentation.
					return chunks.join("");
				})
			),
			$.gulpif(
				// Convert spaces to tabs.
				style === "spaces",
				$.replace(/^([\t ])+/gm, function(match) {
					// Replace all tabs with spaces.
					match = match.replace(/\t/g, " ".repeat(size));
					return match;
				})
			),
			gulp.dest("./"),
			$.debug.edit()
		],
		done
	);
});

// -----------------------------------------------------------------------------
// help.js -- ./gulp/main/source/helpers/help.js
// -----------------------------------------------------------------------------

/**
 * Provides Gulp task documentation (this documentation).
 *
 * Notes
 *
 * • Help documentation will always show even when verbose flag
 *   is not provided.
 *
 * Flags
 *
 * --verbose
 *     [boolean] Shows all documentation.
 *
 * --internal
 *     [boolean] Shows all internal (yellow) tasks.
 *
 * --filter
 *     [string] Names of tasks to show documentation for.
 *
 * Usage
 *
 * $ gulp help
 *     Show a list of tasks and their short descriptions.
 *
 * $ gulp help --verbose
 *     Show full documentation (flags, usage, notes...).
 *
 * $ gulp help --filter "open default dependency"
 *     Show documentation for specific tasks.
 *
 * $ gulp help --internal
 *     Show documentation for internally used tasks.
 */
gulp.task("help", function(done) {
	// Run yargs.
	var __flags = yargs
		.option("verbose", {
			type: "boolean"
		})
		.option("filter", {
			type: "string"
		})
		.option("internal", {
			type: "boolean"
		}).argv;
	var verbose = __flags.v || __flags.verbose;
	var filter = __flags.f || __flags.filter;
	var internal = __flags.i || __flags.internal;

	// Get file names to use.
	var names = BUNDLE_GULP.source.names;
	var name_default = names.default;
	var name_main = names.main;

	// If gulpfile.js exists use that. Else fall back to gulpfile-main.js.
	var gulpfile = fe.sync($paths.basedir + name_default)
		? name_default
		: name_main;

	// Store file content in this variable.
	var content = "";

	pump(
		[
			gulp.src(gulpfile, {
				cwd: $paths.basedir
			}),
			$.fn(function(file) {
				// Store the file content.
				content = file.contents.toString();
			})
		],
		function() {
			var blocks = [];
			var lengths = [];
			var names = [];
			var string = content;
			var docblock_pattern = /^\/\*\*[\s\S]*?\*\/$/m;
			var task_name_pattern = /^gulp.task\(('|")([a-z:\-_]+)\1/;
			var match = string.match(docblock_pattern);

			// Loop over gulpfile content string and get all the docblocks.
			while (match) {
				var comment = match[0];
				// Get the match index.
				var index = match.index;
				// Get the match length.
				var length = comment.length;
				// Reset the string to exclude the match.
				string = string.substring(index + length, string.length).trim();

				// Now look for the task name. The name needs to be at the
				// front of the string to pertain to the current docblock
				// comment. Therefore, it must have an index of 0.
				var task_name_match = string.match(task_name_pattern);

				// If no task name match continue and skip. Or task name has
				// to be at the front of the string.
				if (!task_name_match || task_name_match.index !== 0) {
					// Reset the match pattern.
					match = string.match(docblock_pattern);
					continue;
				}

				// Check whether the task is internal.
				var is_internal = Boolean(-~comment.indexOf("@internal"));

				// Exclude internal tasks when the internal flag is not set.
				if (is_internal && !internal) {
					// Reset the match pattern.
					match = string.match(docblock_pattern);
					continue;
				}

				// Get the task name.
				var task_name = task_name_match[2];

				// Filter if flag present. Also grab the length of the tasks.
				if (filter) {
					if (-~filter.indexOf(task_name) || task_name === "help") {
						// Store the task name length.
						lengths.push(task_name.length);
					} else {
						// Reset the match pattern.
						match = string.match(docblock_pattern);
						continue;
					}
				} else {
					// When no flag present just add all to the array.
					lengths.push(task_name.length);
				}

				// Add the comment and task name to array:
				// [ task name , task docblock comment , is task internal? ]
				blocks.push([task_name, comment, is_internal]);
				// Reset the match pattern.
				match = string.match(docblock_pattern);
			}

			// Get the task max length.
			var max_length = Math.max.apply(null, lengths);

			var newline = "\n";
			var headers = ["Flags", "Usage", "Notes"];

			// Sort alphabetically fallback to a length.
			// [https://stackoverflow.com/a/9175783]
			var cmp = function(a, b) {
				if (a > b) {
					return +1;
				}
				if (a < b) {
					return -1;
				}
				return 0;
			};

			// Replacer function will bold all found flags in docblock.
			var replacer = function(match) {
				return chalk.bold(match);
			};

			// Remove all the docblock comment syntax.
			var remove_comment_syntax = function(string) {
				return string
					.replace(/(^\/\*\*)|( \*\/$)|( \* ?)/gm, "")
					.trim();
			};

			print.ln();
			print(chalk.bold("Tasks"));
			print.ln();

			var tasks = {};

			// Loop over every match get needed data.
			blocks.forEach(function(block) {
				// Get task name.
				var name = block[0];
				var internal = block[2];
				// Reset the block var to the actual comment block.
				block = block[1];

				// Skip if no name is found.
				if (!name) {
					return;
				}

				// Reset name.
				block = block.replace(
					new RegExp("task: " + name + "$", "m"),
					""
				);

				// Remove doc comment syntax.
				block = remove_comment_syntax(block);

				// *************************************************
				// For the time being this method of scraping for the
				// description is fine but it must be made better in a
				// future iteration. This way limits the description to
				// a single line and sometimes that is not enough to
				// describe its function.
				// *************************************************

				// Functions with only a description and nothing else,
				// will not have any new lines in its description.
				// Therefore, simply use its entire documentation as its
				// description.
				var newline_index = block.indexOf(`${newline}${newline}`);
				if (newline_index === -1) {
					newline_index = block.length;
				}

				// Get the description.
				var desc = block.substring(0, newline_index);

				tasks[name] = {
					text: block,
					desc: desc,
					internal: internal
				};
				if (name !== "help") {
					names.push(name);
				}
			});

			// Sort the array names.
			names.sort(function(a, b) {
				return cmp(a, b) || cmp(a.length, b.length);
			});

			// Add the help task to the front of the array.
			names.unshift("help");

			// Loop over to print this time.
			names.forEach(function(name) {
				// Get the block.
				var task = tasks[name];
				var block = task.text;
				var desc = task.desc;
				var internal = task.internal;

				// Task name color will change based on whether it's
				// an internal task.
				var color = !internal ? "bold" : "yellow";

				// Loop over lines.
				if (verbose || name === "help") {
					// Bold the tasks.
					block = block.replace(/\s\-\-?[a-z-]+/g, replacer);

					// Print the task name.
					print("   " + chalk[color](name));

					var lines = block.split(newline);
					lines.forEach(function(line) {
						if (-~headers.indexOf(line.trim())) {
							line = " ".repeat(6) + (line + ":");
						} else {
							line = "\t" + line;
						}
						print(line);
					});

					// Bottom padding.
					print.ln();
				} else {
					// Only show the name and its description.
					print(
						"   " +
							chalk[color](name) +
							" ".repeat(max_length - name.length + 3) +
							desc
					);
				}
			});

			if (!verbose) {
				// Bottom padding.
				print.ln();
			}

			done();
		}
	);
});

// -----------------------------------------------------------------------------
// favicon.js -- ./gulp/main/source/helpers/favicon.js
// -----------------------------------------------------------------------------

/**
 * Generate the favicon icons.
 *
 * Notes
 *
 * • This task takes a few seconds to complete. You should run it at
 *     least once to create the icons. Then, you should run it whenever
 *     RealFaviconGenerator updates its package
 *     (see the check-for-favicon-update task below).
 *
 * @internal - Used to prepare the favicon task.
 */
gulp.task("favicon:generate", function(done) {
	// Note: Most of the used plugins have their own dedicated config
	// file found in configs/. This plugin, however, does not and therefore
	// requires this file to be changed. Maybe in the future this might
	// change and a dedicated config file will be made.

	$.real_favicon.generateFavicon(
		{
			masterPicture: $paths.favicon_master_pic,
			dest: $paths.favicon_dest,
			iconsPath: $paths.favicon_dest,
			design: {
				ios: {
					pictureAspect: "backgroundAndMargin",
					backgroundColor: "#f6f5dd",
					margin: "53%",
					assets: {
						ios6AndPriorIcons: true,
						ios7AndLaterIcons: true,
						precomposedIcons: true,
						declareOnlyDefaultIcon: true
					}
				},
				desktopBrowser: {},
				windows: {
					pictureAspect: "whiteSilhouette",
					backgroundColor: "#00a300",
					onConflict: "override",
					assets: {
						windows80Ie10Tile: true,
						windows10Ie11EdgeTiles: {
							small: true,
							medium: true,
							big: true,
							rectangle: true
						}
					}
				},
				androidChrome: {
					pictureAspect: "backgroundAndMargin",
					margin: "42%",
					backgroundColor: "#f6f5dd",
					themeColor: "#f6f5dd",
					manifest: {
						display: "standalone",
						orientation: "notSet",
						onConflict: "override",
						declared: true
					},
					assets: {
						legacyIcon: false,
						lowResolutionIcons: false
					}
				},
				safariPinnedTab: {
					pictureAspect: "silhouette",
					themeColor: "#699935"
				}
			},
			settings: {
				scalingAlgorithm: "Mitchell",
				errorOnImageTooSmall: false
			},
			markupFile: get_config_file($paths.config_$favicondata)
		},
		function() {
			done();
		}
	);
});

/**
 * Update manifest.json.
 *
 * @internal - Used to prepare the favicon task.
 */
gulp.task("favicon:edit-manifest", function(done) {
	var manifest = json.read($paths.favicon_root_manifest);
	manifest.set("name", "wa-devkit");
	manifest.set("short_name", "WADK");
	manifest.write(
		function() {
			done();
		},
		null,
		JINDENT
	);
});

/**
 * Copy favicon.ico and apple-touch-icon.png to the root.
 *
 * @internal - Used to prepare the favicon task.
 */
gulp.task("favicon:root", function(done) {
	pump(
		[
			gulp.src([
				$paths.favicon_root_ico,
				$paths.favicon_root_png,
				$paths.favicon_root_config,
				$paths.favicon_root_manifest
			]),
			$.debug(),
			gulp.dest($paths.basedir),
			$.debug.edit(),
			bs.stream()
		],
		done
	);
});

/**
 * Copy delete unneeded files.
 *
 * @internal - Used to prepare the favicon task.
 */
gulp.task("favicon:delete", function(done) {
	pump(
		[
			gulp.src([
				$paths.favicon_root_config,
				$paths.favicon_root_manifest
			]),
			$.debug.clean(),
			$.clean()
		],
		done
	);
});

/**
 * Inject new favicon HTML.
 *
 * @internal - Used to prepare the favicon task.
 */
gulp.task("favicon:html", function(done) {
	pump(
		[
			gulp.src($paths.favicon_html),
			$.real_favicon.injectFaviconMarkups(
				JSON.parse(
					fs.readFileSync(get_config_file($paths.config_$favicondata))
				).favicon.html_code
			),
			gulp.dest($paths.favicon_html_dest),
			$.debug.edit(),
			bs.stream()
		],
		done
	);
});

/**
 * Re-build project favicons.
 *
 * Usage
 *
 * $ gulp favicon
 *     Re-build favicons.
 */
gulp.task("favicon", function(done) {
	// Cache task.
	var task = this;

	var tasks = [
		"favicon:generate",
		"favicon:edit-manifest",
		"favicon:root",
		"favicon:delete",
		"favicon:html",
		"html",
		"tohtml",
		"pretty"
	];
	tasks.push(function() {
		print.gulp.success("Favicons generated.");
		done();
	});
	return sequence.apply(task, tasks);
});

/**
 * Check for RealFaviconGenerator updates.
 *
 * Notes
 *
 * • Think: Apple has just released a new Touch icon along with the
 *     latest version of iOS. Run this task from time to time. Ideally,
 *     make it part of your continuous integration system. Check for
 *     RealFaviconGenerator updates.
 */
gulp.task("favicon-updates", function(done) {
	var currentVersion = JSON.parse(
		fs.readFileSync(get_config_file($paths.config_$favicondata))
	).version;
	$.real_favicon.checkForUpdates(currentVersion, function(err) {
		if (err) {
			throw err;
		} else {
			return done();
		}
	});
});