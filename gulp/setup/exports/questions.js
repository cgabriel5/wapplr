"use strict";

module.exports = {
	ready: [
		{
			type: "confirm",
			name: "continue",
			message: function(answer) {
				console.log(
					`  The following questions will be used to scaffold your
  project. Setup questions are grouped into sections and
  entire setup should take around 1-2 minutes.
`
				);
				return "Start setup";
			}
		}
	],
	initial: [
		{
			type: "list",
			name: "apptype",
			message: "Setup a:",
			choices: ["webapp", "library"],
			default: "webapp"
		},
		{
			type: "input",
			name: "name",
			message: "Project name:",
			default: "my-app"
		},
		{
			type: "confirm",
			name: "same_name",
			message: "Use project name for repo name:"
		},
		{
			type: "input",
			name: "repo_name",
			message: "Repository name:",
			default: "my-app",
			when: function(answers) {
				// Only show this question when wanting to use
				// a different name than the project name.
				return !answers.same_name;
			}
		},
		{
			type: "input",
			name: "version",
			message: "Start version at:",
			default: "0.0.1"
		},
		{
			type: "input",
			name: "description",
			message: "Application description:",
			default: "The next big thing."
		},
		{
			type: "input",
			name: "entry_point",
			message: "Entry point:",
			default: "index.html"
		},
		{
			type: "confirm",
			name: "private",
			message: "Keep repo private:",
			default: true
		}
	],
	author: [
		{
			type: "input",
			name: "fullname",
			message: "Fullname:",
			default: "John Doe"
		},
		{
			type: "input",
			name: "email",
			message: "Email:",
			default: "johndoe@example.com"
		}
	],
	license: [
		{
			type: "list",
			name: "license",
			message: "Use:",
			choices: [
				"AGPL",
				"APACHE",
				"ARTISTIC",
				"BSD-3-CLAUSE",
				"BSD",
				"CC0",
				"ECLIPSE",
				"GPL-V2",
				"GPL-V3",
				"LGPL-V2.1",
				"LGPL-V3",
				"MIT",
				"MOZILLA",
				"NO-LICENSE",
				"UNLICENSE",
				"WTFPL"
			],
			default: "MIT",
			filter: function(license) {
				return license.toLowerCase();
			}
		},
		{
			type: "input",
			name: "year",
			message: "Year:",
			default: new Date().getFullYear()
		}
	],
	app: [
		{
			type: "input",
			name: "base",
			message: "Address:",
			default: "localhost/projects/"
		},
		{
			type: "confirm",
			name: "https",
			message: "Use https:",
			default: false
		},
		{
			type: "input",
			name: "port",
			message: "Port:",
			default: 80
		},
		{
			type: "list",
			name: "eol",
			message: "Line endings:",
			choices: ["Mac OS", "Windows/DOS", "Unix (OS X/Linux)"],
			default: "Unix (OS X/Linux)",
			filter: function(answer) {
				var options = {
					"Mac OS": ["cr", "\r"],
					"Unix (OS X/Linux)": ["lf", "\n"],
					"Windows/DOS": ["crlf", "\r\n"]
				};
				// Work the answer to remove all unneeded text.
				return options[answer];
			}
		}
	],
	github: [
		{
			type: "input",
			name: "git_id",
			message: "Username:",
			default: "johndoe23"
		},
		{
			type: "confirm",
			name: "git_remote",
			message: "Add origin remote?"
		},
		{
			type: "list",
			name: "git_repo_type",
			message: "Use:",
			choices: ["HTTPS", "SSH"],
			default: "SSH",
			when: function(answers) {
				// Only ask question when git_remote is true.
				return answers.git_remote;
			},
			filter: function(type) {
				return type.toLowerCase();
			}
		},
		{
			type: "confirm",
			name: "git_commit",
			message: "Make initial commit?",
			when: function(answers) {
				// Only ask question when git_remote is true.
				return answers.git_remote && answers.git_repo_type;
			}
		},
		{
			type: "confirm",
			name: "git_push",
			message: "Push repo?",
			when: function(answers) {
				// Only ask question when git_commit is true.
				return answers.git_commit;
			}
		}
	]
};
