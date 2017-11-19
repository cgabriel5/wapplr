/**
 * Opens the provided file in the user's browser.
 *
 * @param {string} filepath - The path of the file to open.
 * @param {number} port - The port to open on.
 * @param {function} callback - The Gulp task callback to run.
 * @param {object} task - The Gulp task.
 * @return {undefined} Nothing.
 */
function open_file_in_browser(filepath, port, callback, task) {
	pump(
		[
			gulp.src(filepath, {
				cwd: $paths.base,
				dot: true
			}),
			$.open({
				app: browser,
				uri: uri({
					appdir: APPDIR,
					filepath: filepath,
					port: port,
					https: $open.https
				})
			})
			// modify debug to take a flag to skip the use of the cli-spinner
			// $.debug()
		],
		function() {
			notify("File opened!");
			callback();
		}
	);
}

/**
 * Print that an active Gulp instance exists.
 *
 * @return {undefined} Nothing.
 */
function gulp_check_warn() {
	log(
		chalk.red(
			"Task cannot be performed while Gulp is running. Close Gulp then try again."
		)
	);
}
