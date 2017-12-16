/**
 * Init HTML files + minify.
 */
gulp.task("html:main", function(done) {
	pump(
		[
			gulp.src(bundle_html.source.files, {
				cwd: $paths.html_source
			}),
			$.debug(),
			$.concat(bundle_html.source.names.main),
			$.injection.pre(html_injection),
			$.beautify($configs.jsbeautify),
			$.injection.post(html_injection),
			gulp.dest($paths.base),
			$.debug.edit(),
			bs.stream()
		],
		done
	);
});