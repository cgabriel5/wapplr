// build app.js + minify + beautify
// @internal
gulp.task("js:app", function(done) {
    var task = this;
    pump([gulp.src(bundle_js.source.files, {
            cwd: __PATHS_JS_SOURCE
        }),
    	debug(),
        concat(bundle_js.source.name),
        beautify(opts_bt),
        gulp.dest(__PATHS_JS_BUNDLES),
    	debug(task.__wadevkit.debug),
        bs.stream()
    ], done);
});
// build libs.js + minify + beautify
// @internal
gulp.task("js:libs", function(done) {
    var task = this;
    // NOTE: absolute thirdparty library file paths should be used.
    // The paths should be supplied in gulp/assets/config/user.json
    // within the bundles.js.thirdparty.files array.
    pump([gulp.src(bundle_js.thirdparty.files),
    	debug(),
        concat(bundle_js.thirdparty.name),
        beautify(opts_bt),
        gulp.dest(__PATHS_JS_BUNDLES),
    	debug(task.__wadevkit.debug),
        bs.stream()
    ], done);
});
