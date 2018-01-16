/**
 * Build app.css + autoprefix + minify.
 *
 * @internal - Ran via the "css" task.
 */
gulp.task("css:app", function(done) {
	var unprefix = require("postcss-unprefix");
	var autoprefixer = require("autoprefixer");
	var perfectionist = require("perfectionist");
	var shorthand = require("postcss-merge-longhand");

	pump(
		[
			gulp.src(bundle_css.source.files, {
				cwd: $paths.css_source
			}),
			$.debug(),
			$.concat(bundle_css.source.names.main),
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
		done
	);
});

/**
 * Build vendor bundle + minify + beautify.
 *
 * @internal - Ran via the "css" task.
 */
gulp.task("css:vendor", function(done) {
	var unprefix = require("postcss-unprefix");
	var autoprefixer = require("autoprefixer");
	var perfectionist = require("perfectionist");
	var shorthand = require("postcss-merge-longhand");

	// NOTE: absolute vendor library file paths should be used.
	// The paths should be supplied in ./configs/bundles.json
	// within the css.vendor.files array.

	pump(
		[
			gulp.src(bundle_css.vendor.files),
			$.debug(),
			$.concat(bundle_css.vendor.names.main),
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
		done
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
