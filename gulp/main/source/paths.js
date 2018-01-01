// get and fill in path placeholders
var $paths = expand_paths(
	Object.assign(
		jsonc.parse(
			fs.readFileSync(`./configs/paths.cm.json`).toString(),
			null,
			true
		),
		{
			// add in the following paths
			dirname: __dirname,
			cwd: process.cwd(),
			// store the project folder name
			rootdir: path.basename(process.cwd()),
			filepath: __filename,
			// get the filepath file name
			filename: path.basename(__filename)
		}
	)
);
