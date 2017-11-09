// /**
//  * Purge potentially unused CSS style definitions.
//  *
//  * Options
//  *
//  * (no options)  ---------  Creates pure.css which contains only used styles.
//  * -r, --remove  [boolean]  Deletes pure.css and removes unused CSS.
//  * -D, --delete  [boolean]  Deletes pure.css.
//  *
//  * Usage
//  *
//  * $ gulp purify # Creates pure.css which contains only used styles.
//  * $ gulp purify --remove # Deletes pure.css and removes unused CSS.
//  * $ gulp purify --delete # Deletes pure.css.
//  */
// gulp.task("purify", function(done) {
// 	var task = this;
// 	// run yargs
// 	var _args = yargs
// 		.option("remove", {
// 			alias: "r",
// 			default: false,
// 			describe: "Removes pure.css.",
// 			type: "boolean"
// 		})
// 		.option("delete", {
// 			alias: "D",
// 			default: false,
// 			describe: "Removes pure.css and removed unused CSS.",
// 			type: "boolean"
// 		}).argv;
// 	// get the command line arguments from yargs
// 	var remove = _args.r || _args.remove;
// 	var delete_file = _args.D || _args.delete;
// 	// remove pure.css
// 	if (remove || delete_file) del([__PATHS_PURE_FILE]);
// 	// don't run gulp just delete the file.
// 	if (delete_file) return done();
// 	pump(
// 		[
// 			gulp.src(__PATHS_USERS_CSS_FILE, {
// 				cwd: __PATHS_CSS_SOURCE
// 			}),
// 			// modify debug to take a flag to skip the use of the cli-spinner
// 			// $.debug(),
// 			$.purify([__PATHS_PURIFY_JS_SOURCE_FILES, INDEX], {
// 				info: true,
// 				rejected: true
// 			}),
// 			$.gulpif(!remove, $.rename(__PATHS_PURE_FILE_NAME)),
// 			// clean file here?
// 			gulp.dest(__PATHS_PURE_CSS + (remove ? __PATHS_PURE_SOURCE : ""))
// 			// $.debug.edit()
// 		],
// 		done
// 	);
// });
