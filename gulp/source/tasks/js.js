/**
 * Build app.js + minify + beautify.
 */
gulp.task("js:app", function(done) {
	pump(
		[
			gulp.src(bundle_js.source.files, {
				cwd: $paths.js_source
			}),
			$.debug(),
			$.concat(bundle_js.source.names.main),
			$.prettier($configs.prettier),
			gulp.dest($paths.js_bundles),
			$.debug.edit(),
			bs.stream()
		],
		done
	);
});

/**
 * Build vendor bundle + minify + beautify.
 */
gulp.task("js:vendor", function(done) {
	// NOTE: absolute vendor library file paths should be used.
	// The paths should be supplied in ./configs/bundles.json
	// within the js.vendor.files array.

	pump(
		[
			gulp.src(bundle_js.vendor.files),
			$.debug(),
			$.concat(bundle_js.vendor.names.main),
			$.prettier($configs.prettier),
			gulp.dest($paths.js_bundles),
			$.debug.edit(),
			bs.stream()
		],
		done
	);
});
