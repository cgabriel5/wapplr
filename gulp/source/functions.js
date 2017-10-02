/**
 * @description [Opens the provided file in the user's browser.]
 * @param  {String}   filepath  [The path of the file to open.]
 * @param  {Number}   port     	[The port to open on.]
 * @param  {Function} callback  [The Gulp task callback to run.]
 * @param  {Object} task  		[The Gulp task.]
 * @return {Undefined}          [Nothing is returned.]
 */
function open_file_in_browser(filepath, port, callback, task) {
    pump([gulp.src(filepath, {
            cwd: __PATHS_BASE,
            dot: true
        }),
        open({
            app: browser,
            uri: uri({
                "appdir": APPDIR,
                "filepath": filepath,
                "port": port,
                "https": config_user.https
            })
        }),
		debug(task.__wadevkit.debug)
    ], function() {
        notify("File opened!");
        callback();
    });
}
/**
 * @description [Returns a function that handles HTML $:pre/post{file-content/$variable}
 *               injection.]
 * @param {Object} [Replacements object.]
 * @return {Function} [Replacement function.]
 */
function html_replace_fn(replacements) {
    return function(match) {
        var injection_name = match.replace(/\$\:(pre|post)\{|\}$/g, "");
        // check whether doing a file or variable injection
        if (injection_name.charAt(0) !== "$") { // file content-injection
            injection_name = __PATHS_HTML_REGEXP_SOURCE + match.replace(/\$\:(pre|post)\{|\}$/g, "");
            var extentions = ".{text,txt}";
            var filename = glob.sync(injection_name + extentions)[0];
            // if glob does not return a match then the file does not exists.
            // therefore, just return undefined.
            if (!filename) return undefined;
            // check that file exists before opening/reading...
            // return undefined when file does not exist...else return its contents
            return (!fe.sync(filename)) ? undefined : fs.readFileSync(filename)
                .toString()
                .trim();
        } else { //variable injection
            injection_name = injection_name.replace(/^\$/, "");
            // lookup its replacement
            return replacements[injection_name] || undefined;
        }
    };
}
/**
 * @description [Print that an active Gulp instance exists.]
 * @return {Undefined} 			[Nothing is returned.]
 */
function gulp_check_warn() {
    log(chalk.red("Task cannot be performed while Gulp is running. Close Gulp then try again."));
}
/**
 * @description [Render output from tasks.]
 * @param {TaskList} tasks 			[The Gulp tasks.]
 * @param {Boolean}  verbose=false  [Flag indicating whether to show hide tasks with the verbose flag.]
 * @returns {String} [The text to print.]
 * @source [https://github.com/megahertz/gulp-task-doc/blob/master/lib/printer.js]
 */
function print_tasks(tasks, verbose, filter) {
    tasks = tasks.filterHidden(verbose)
        .sort();
    var results = ["", chalk.underline.bold(filter ? "Filtered" : "Tasks"), ""];
    var field_task_len = tasks.getLongestNameLength();
    tasks.forEach(function(task) {
        var comment = task.comment || {};
        var lines = comment.lines || [];
        results.push(format_column(task.name, field_task_len) + (lines[0] || ""));
        // if (!verbose) results.push("\n");
        // only print verbose documentation when flag is provided
        if (verbose) {
            for (var i = 1; i < lines.length; i++) {
                // if (i === 1) results.push("\n");
                results.push(format_column("", field_task_len) + "  " + lines[i]);
                if (verbose && i === lines.length - 1) results.push("\n");
            }
        }
    });
    if (!verbose) results.push("\n");
    return results.join("\n");
}
/**
 * @description [Return a text surrounded by space.]
 * @param {String} text
 * @param {Number} width	   [Width Column width without offsets.]
 * @param {Number} offset_left  [Space count before text.]
 * @param {Number} offset_right [Space count after text.]
 * @returns {String} [The formated text.]
 * @source [https://github.com/megahertz/gulp-task-doc/blob/master/lib/printer.js]
 */
function format_column(text, width, offset_left, offset_right) {
    offset_left = undefined !== offset_left ? offset_left : 3;
    offset_right = undefined !== offset_right ? offset_right : 3;
    return new Array(offset_left + 1)
        .join(" ") + chalk.magenta(text) + new Array(Math.max(width - text.length, 0) + 1)
        .join(" ") + new Array(offset_right + 1)
        .join(" ");
}
