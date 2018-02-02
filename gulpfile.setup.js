// -----------------------------------------------------------------------------
// requires.js -- ./gulp/setup/source/requires.js
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
var pump = require("pump");
var chalk = require("chalk");
var cmd = require("node-cmd");
var json = require("json-file");
var git = require("simple-git")();
var inquirer = require("inquirer");
var jsonc = require("comment-json");
var sequence = require("run-sequence");
var license = require("create-license");
var alphabetize = require("alphabetize-object-keys");

// Project utils.
var utils = require("./gulp/assets/utils/utils.js");
var print = utils.print;
var notify = utils.notify;
var gulp = utils.gulp;
var format = utils.format;
var bangify = utils.bangify;
var globall = utils.globall;
var ext = utils.ext;
var expand_paths = utils.expand_paths;
var opts_sort = utils.opts_sort;

// -----------------------------------------------------------------------------
// paths.js -- ./gulp/setup/source/paths.js
// -----------------------------------------------------------------------------

// Get and fill in path placeholders.
var $paths = expand_paths(
	Object.assign(require("./gulp/setup/exports/paths.js"), {
		// Add in the following paths.

		dirname: __dirname,
		cwd: process.cwd(),

		// Store the project folder name.
		rootdir: path.basename(process.cwd()),
		filepath: __filename,

		// Get the filepath file name.
		filename: path.basename(__filename)
	})
);

// -----------------------------------------------------------------------------
// configs.js -- ./gulp/setup/source/configs.js
// -----------------------------------------------------------------------------

// Dynamic configuration files (load via json-file to modify later).
var $internal = require("./gulp/setup/exports/internal.json");
var $pkg = json.read($paths.config_pkg);

// Get individual plugin settings.
var $app = jsonc.parse(fs.readFileSync($paths.config_app).toString());
var $ap = require($paths.config_autoprefixer);
var $bundles = json.read($paths.config_bundles);
var $jsbeautify = require($paths.config_jsbeautify);
var $perfectionist = require($paths.config_perfectionist);
var $prettier = require($paths.config_prettier);

// Setup exports.
var $questions = require($paths.gulp_setup_questions);
var $templates = require($paths.gulp_setup_templates);
var $jsconfigs = require($paths.gulp_setup_jsconfigs);

// -----------------------------------------------------------------------------
// vars.js -- ./gulp/setup/source/vars.js
// -----------------------------------------------------------------------------

// Placeholder fillers.
var __data = {};

// App directory information.
var INDEX = $app.index;

// Line ending information.
var EOL = $app.eol;
var EOL_ENDING = EOL.ending;
// var EOL_STYLE = EOL.style;

// App JSON indentation.
var JINDENT = $app.eol;

// -----------------------------------------------------------------------------
// functions.js -- ./gulp/setup/source/functions.js
// -----------------------------------------------------------------------------

/**
 * node-cmd returns the output of the ran command. However, the returned
 *     string is only the bare string and has any previously applied
 *     highlighting removed. This function adds the removed highlighting.
 *
 * @param  {string} string - The string to highlight.
 * @return {string} - The highlighted string.
 */
function cli_highlight(string) {
	// Prepare the string.
	var output = string.trim().split("\n");

	// Remove unneeded lines.
	output = output.filter(function(line) {
		return !-~line.indexOf("] Using gulpfile");
	});

	// Turn back to string.
	output = output.join("\n");

	// Coloring starts here...

	// Color the gulp timestamps.
	output = output.replace(/\[([\d:]+)\]/g, "[" + chalk.gray("$1") + "]");

	// Color task names.
	output = output.replace(
		/(Finished|Starting) '(.+)'/g,
		"$1 '" + chalk.cyan("$2") + "'"
	);

	// Color task times.
	output = output.replace(/(after) (.+)/g, "$1 " + chalk.magenta("$2"));

	// Color file path lines.
	output = output.replace(
		/(─ )(\d+)(\s+=>\s+)([^\s]+)(\s)(\d+(.\d+)? \w+)/g,
		"$1" +
			chalk.green("$2") +
			"$3" +
			chalk.magenta("$4") +
			"$5" +
			chalk.blue("$6")
	);

	// Color final items count.
	output = output.replace(/(\d+ items?)/g, chalk.green("$1"));

	// Color symbols.
	output = output.replace(/(✎)/g, chalk.yellow("$1"));
	output = output.replace(/(🗑)/g, chalk.red("$1"));

	// Return the colored output.
	return output;
}

// -----------------------------------------------------------------------------
// init.js -- ./gulp/setup/source/tasks/init.js
// -----------------------------------------------------------------------------

/**
 * The default Gulp task. As this file is the Gulp setup file this task
 *     does nothing but tell the user to run the init task before running
 *     the default task. The init task will ask questions to setup the
 *     project.
 */
gulp.task("default", function(done) {
	// Show the user the init message.
	print.gulp('Run "$ gulp init" before running Gulp\'s default command.');
	done();
});

/**
 * Ask user questions and setup the project based on the replies. The
 *     initialization steps are shown down below.
 */
gulp.task("init", function(done) {
	// Cache task.
	var task = this;
	var answers_ = [{}];

	print.ln();

	/**
	 * Prints the message group name.
	 *
	 * @param  {string} message - The group message name.
	 * @return {undefined} - Nothing.
	 */
	function sep_message(message) {
		var messages = {
			initial: "[Project Questions]",
			author: "[Author Questions]",
			license: "[Generate License]",
			app: "[App Questions]"
		};

		// Overwrite the var.
		message = messages[message];

		print.ln();
		print.gulp(chalk.green(`${message}\n`));
	}

	// Not really the most ideal but to ask the setup questions in groups
	// this seems to be the way to go. Questions are asked and their replies
	// are stored in the answers_ variable for later use.

	inquirer.prompt($questions.ready).then(function(answers) {
		if (answers.continue) {
			sep_message("initial");

			// Ask the initial questions.
			inquirer.prompt($questions.initial).then(function(answers) {
				// Store the answer.
				answers_.push(answers);

				sep_message("author");

				// Ask the author questions.
				inquirer.prompt($questions.author).then(function(answers) {
					// Store the answer.
					answers_.push(answers);

					sep_message("license");

					// Ask the other.
					inquirer.prompt($questions.license).then(function(answers) {
						// Store the answer.
						answers_.push(answers);

						sep_message("app");

						// Ask the app questions.
						inquirer
							.prompt($questions.app)
							.then(function(answers) {
								// Store the answer.
								answers_.push(answers);
							})
							.then(function() {
								// Combine all answers.
								var answers = Object.assign.apply(
									null,
									answers_
								);

								// Get answers.
								__data = answers;
								var type = __data.apptype;

								// Set the path for js option.
								$paths.js_options_dynamic = `gulp/setup/${type}/**/*.*`;

								// Set the application type.
								$internal.apptype = type;
								// Pick js bundle based on provided project type + reset the
								// config js bundle.
								$bundles.data.js = $jsconfigs[type];

								// Remove distribution configuration if type is library
								// as the project is defaulted for a webapp project.
								if (type === "library") {
									// Remove the distribution configuration.
									delete $bundles.data.dist;
									// Add the library configuration.
									$bundles.data.lib = $jsconfigs.lib;
								} // Else leave as-is for webapp project.

								// Set package.json properties.
								$pkg.set("name", __data.name);
								$pkg.set("version", __data.version);
								$pkg.set("description", __data.description);
								$pkg.set(
									"author",
									format($templates.author, __data)
								);
								$pkg.set("repository", {
									type: "git",
									url: format(
										$templates["repository.url"],
										__data
									)
								});
								$pkg.set("bugs", {
									url: format($templates["bugs.url"], __data)
								});
								$pkg.set(
									"homepage",
									format($templates.homepage, __data)
								);
								$pkg.set("private", __data.private);

								// Sort keys.
								$bundles.data = alphabetize($bundles.data);
								$pkg.data = alphabetize($pkg.data);

								// Saves changes to files.
								$bundles.writeSync(null, JINDENT);
								$pkg.write(
									function() {
										// Run initialization steps.
										var tasks = [
											"init:app-settings",
											"init:settings-internal",
											"init:settings-main",
											"init:clean-docs",
											// !-- The following 2 tasks are only ran
											// for library type projects. They are
											// removed for webapp projects.
											"init:--lib-remove-webapp-files",
											"init:--lib-add-library-files",
											// --!
											"init:create-license",
											"init:fill-placeholders",
											"init:setup-readme",
											"init:rename-gulpfile",
											"init:remove-setup",
											"init:create-bundles",
											"init:pretty",
											"init:git"
										];

										// Remove steps that are only for library project setup
										// when the apptype is set to webapp.
										if (__data.apptype === "webapp") {
											tasks = tasks.filter(function(
												task
											) {
												return !-~task.indexOf("--lib");
											});
										}

										tasks.push(function() {
											var message = `Project initialized. (${type})`;
											notify(message);
											print.gulp("");
											print.gulp(
												chalk.green("✔"),
												message
											);
											print.gulp("");
											print.gulp(
												"Run",
												chalk.green("$ gulp"),
												"to start watching project for any file changes."
											);
											print.gulp("");

											done();
										});
										return sequence.apply(task, tasks);
									},
									null,
									JINDENT
								);
							});
					});
				});
			});
		} else {
			print.ln();
			return print.gulp(chalk.red("Project setup canceled."));
		}
	});
});

// -----------------------------------------------------------------------------
// steps.js -- ./gulp/setup/source/tasks/steps.js
// -----------------------------------------------------------------------------

/**
 * This initialization step updates the app config file with the user
 *     provided values.
 */
gulp.task("init:app-settings", function(done) {
	// Run gulp process.
	pump(
		[
			gulp.src($paths.config_app),
			$.debug(),
			$.modify({
				fileModifier: function(file, contents) {
					// Note: Since the app file has already been loaded we
					// don't use the modifier's contents variable. We modify
					// the app object and return the stringified text of the
					// object. Doing this will prevent the file from being
					// re-opened again via jsonc and will also log the
					// task in the terminal.

					// Update the app object.
					$app.index = __data.entry_point;
					$app.base = __data.base;
					$app.https = __data.https;
					$app.port = __data.port;
					$app.eol = {
						ending: __data.eol[1],
						style: __data.eol[0]
					};

					// Hacky-method: comment-json removes all empty lines so
					// the lines are added back to make the config file easier
					// to read.
					for (var key in $app) {
						if ($app.hasOwnProperty(key)) {
							// Only modify the comments.
							if (key.charAt(0) === "/") {
								// Prepend a placeholder for the new lines.
								$app[key][0].unshift("// $LINE");
							}
						}
					}

					// Stringify the answers object and remove the placeholders
					// with new lines.
					var content = jsonc
						.stringify($app, null, JINDENT)
						.replace(/\/\/ \$LINE/gm, "\n")
						.trim();

					return content;
				}
			}),
			$.debug.edit(),
			gulp.dest($paths.basedir)
		],
		done
	);
});

/**
 * This initialization step takes the internal JSON object export and saves
 *     it into the configs/ directory.
 *
 * Notes
 *
 * • This file (.__internal.json) is used internally and should not be
 *     modified.
 */
gulp.task("init:settings-internal", function(done) {
	// Get the internal filepath.
	var internal_filepath =
		$paths.config_home + $paths.gulp_setup_settings_internal_name;

	// Save the $internal JSON object.
	fs.writeFile(
		internal_filepath,
		JSON.stringify(alphabetize($internal), null, JINDENT),
		function() {
			// The following is only needed to log the file.
			pump(
				[
					gulp.src(internal_filepath, {
						cwd: $paths.basedir
					}),
					$.debug(),
					$.debug.edit()
				],
				done
			);
		}
	);
});

/**
 * This initialization step combines all the config files under configs/
 *     to generate the collective .__settings.js file.
 */
gulp.task("init:settings-main", function(done) {
	// Make the main settings file.
	pump(
		[
			gulp.src($paths.config_settings_json_files, {
				cwd: $paths.basedir
			}),
			$.debug(),
			$.strip_jsonc(), // Remove any JSON comments.
			$.jsoncombine($paths.config_settings_name, function(data) {
				return new Buffer(JSON.stringify(data, null, JINDENT));
			}),
			gulp.dest($paths.config_home),
			$.debug.edit()
		],
		done
	);
});

/**
 * This initialization step removes unneeded doc files depending on whether
 *     setting up a webapp or library.
 */
gulp.task("init:clean-docs", function(done) {
	// Get the correct file sub types to remove. This depends on the project
	// setup.
	var files =
		$paths[
			"gulp_setup_docs_" + (__data.apptype === "webapp" ? "lib" : "app")
		];

	// Remove files.
	pump(
		[
			gulp.src(files, {
				cwd: $paths.gulp_setup_docs_source
			}),
			$.debug(),
			$.debug.clean(),
			$.clean()
		],
		done
	);
});

/**
 * This initialization step is only ran when setting up a library project.
 *     It removes all webapp files as the project is defaulted to a webapp.
 */
gulp.task("init:--lib-remove-webapp-files", function(done) {
	// Note: When setting up a library project ./js/source/ will get
	// overwritten with the library setup folder files. This will in effect
	// combine the folders and add the needed files/folders for the library.
	// (i.e. ./js/vendor/__init__.js and ./js/bundles/)

	pump(
		[
			gulp.src($paths.js_source, {
				dot: true,
				cwd: $paths.basedir
			}),
			$.debug.clean(),
			$.clean()
		],
		done
	);
});

/**
 * This initialization step is only ran when setting up a library project.
 *     As the project is defaulted to a webapp it adds the needed library
 *     project files.
 */
gulp.task("init:--lib-add-library-files", function(done) {
	// This will copy the library project files from the setup directory
	// into the ./js/ directory. This will also overwrite needed files,
	// like the bundle files.

	pump(
		[
			gulp.src($paths.js_options_dynamic, {
				dot: true,
				cwd: $paths.dot
			}),
			$.debug(),
			gulp.dest($paths.js_home),
			$.debug.edit()
		],
		done
	);
});

/**
 * This initialization step creates the user selected license and inserts
 *     the provided data (year, name, etc.).
 */
gulp.task("init:create-license", function(done) {
	// Generate the license.
	license($paths.basedir, __data.license, {
		author: __data.fullname,
		year: __data.year,
		project: __data.name
	});

	// Remove the ext from the path.
	var license_no_ext = $paths.license.replace(".txt", "");

	// Rename the generated license.
	pump(
		[
			gulp.src(license_no_ext, {
				base: $paths.basedir
			}),
			$.rename($paths.license),
			gulp.dest($paths.basedir),
			$.debug.edit()
		],
		// Remove the old license file.
		function() {
			pump(
				[
					gulp.src(license_no_ext, {
						base: $paths.basedir
					}),
					$.debug.clean(),
					$.clean()
				],
				done
			);
		}
	);
});

/**
 * This initialization step inserts any placeholders with the provided
 *    data.
 */
gulp.task("init:fill-placeholders", function(done) {
	// Replace placeholder with real data.
	pump(
		[
			gulp.src(
				[
					$paths.gulp_setup_readme_template,
					$paths.html_headmeta,
					INDEX
				],
				{
					base: $paths.basedir
				}
			),
			$.injection({ replacements: __data }),
			gulp.dest($paths.basedir),
			$.debug.edit()
		],
		done
	);
});

/**
 * This initialization step moves the readme template export to its setup
 *     location to the root.
 */
gulp.task("init:setup-readme", function(done) {
	// Move templates to new locations.
	pump(
		[
			gulp.src([$paths.gulp_setup_readme_template]),
			$.debug(),
			gulp.dest($paths.basedir),
			$.debug.edit()
		],
		done
	);
});

/**
 * This initialization step renames the main gulpfile to the conventional
 *     Gulp file name.
 */
gulp.task("init:rename-gulpfile", function(done) {
	// Rename the gulpfile.main.js to gulpfile.js.
	pump(
		[
			gulp.src($paths.gulp_file_main, {
				base: $paths.basedir
			}),
			$.debug(),
			$.clean(), // Remove the file.
			$.rename($paths.gulp_file_name),
			gulp.dest($paths.basedir),
			$.debug.edit()
		],
		done
	);
});

/**
 * This initialization step removes all setup files as they are no longer
 *     needed in the further steps.
 */
gulp.task("init:remove-setup", function(done) {
	// Remove the setup files/folders/old .git folder.
	pump(
		[
			gulp.src([$paths.gulp_file_setup, $paths.gulp_setup, $paths.git], {
				dot: true,
				read: false,
				base: $paths.basedir
			}),
			$.debug.clean(),
			$.clean()
		],
		done
	);
});

/**
 * This initialization step runs gulpfile.js, formerly gulpfile.main.js,
 *     Gulp tasks. More specifically, it runs the tasks that generate the
 *     project CSS/JS bundles.
 */
gulp.task("init:create-bundles", function(done) {
	// Create the CSS/JS bundles before.
	cmd.get(`gulp js && gulp css`, function(err, data, test) {
		if (err) {
			throw err;
		}

		// Highlight data string.
		print(cli_highlight(data));

		// End the task.
		done();
	});
});

/**
 * This initialization step runs the gulpfile.js, formerly gulpfile.main.js,
 *     pretty task. This task runs through all the project files and pretty
 *     prints them.
 */
gulp.task("init:pretty", function(done) {
	// Create the CSS/JS bundles before.
	cmd.get(`gulp pretty`, function(err, data) {
		if (err) {
			throw err;
		}

		// Highlight data string.
		print(cli_highlight(data));

		// End the task.
		done();
	});
});

/**
 * This initialization step programmatically makes the first project Git
 *     commit and lightly configures Git with useful settings.
 */
gulp.task("init:git", function(done) {
	// Git init new project.
	git.init("", function() {
		// Set gitconfig values.
		cmd.get(
			`
		git config --local core.fileMode false
		git config --local core.autocrlf input
		git config --local user.email ${__data.email}
		git config --local user.name ${__data.git_id}`,
			function(err) {
				if (err) {
					throw err;
				}

				// Make the first commit.
				git
					.add("./*")
					.commit(
						"chore: Initial commit\n\nProject initialization.",
						function() {
							print.gulp("");
							print.gulp(
								"Make sure to set your editor of choice with Git if not already set."
							);
							print.gulp(
								"For example, for Sublime Text run:",
								chalk.green(
									'$ git config core.editor "subl -n w"'
								)
							);
							print.gulp("More information can be found here:");
							print.gulp(
								"https://git-scm.com/book/en/v2/Customizing-Git-Git-Configuration"
							);
							print.gulp("");
							print.gulp(
								chalk.green("✔"),
								`Git initialized and configured.`,
								"(" +
									chalk.green("$ git config --list --local") +
									")"
							);
							print.gulp("");

							done();
						}
					);
			}
		);
	});
});

// -----------------------------------------------------------------------------
// make.js -- ./gulp/setup/source/helpers/make.js
// -----------------------------------------------------------------------------

/**
 * Build gulpfile.setup.js from source.
 */
gulp.task("make", function(done) {
	var files = [
		"requires.js",
		"paths.js",
		"configs.js",
		"vars.js",
		"functions.js",
		"tasks/init.js",
		"tasks/steps.js",
		"helpers/make.js"
	];
	pump(
		[
			gulp.src(files, {
				cwd: $paths.gulp_setup_source
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
			$.concat($paths.gulp_file_setup),
			$.prettier($prettier),
			gulp.dest($paths.basedir),
			$.debug.edit()
		],
		done
	);
});
