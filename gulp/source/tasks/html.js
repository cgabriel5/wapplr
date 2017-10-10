// init HTML files + minify
// @internal
gulp.task("html:main", function(done) {
    var task = this;
    // RegExp used for $:pre/post{filename/$var} HTML file-content/$variable injection
    var r_pre = regexp_html.pre;
    var r_post = regexp_html.post;
    pump([gulp.src(bundle_html.source.files, {
            cwd: __PATHS_HTML_SOURCE
        }),
    	debug(),
		concat(bundle_html.source.names.main),
		replace(new RegExp(r_pre.p, r_pre.f), html_replace_fn(html_injection)),
		beautify(config_jsbeautify),
		replace(new RegExp(r_post.p, r_post.f), html_replace_fn(html_injection)),
		gulp.dest(__PATHS_BASE),
		debug(task.__wadevkit.debug),
		bs.stream()
    ], done);
});