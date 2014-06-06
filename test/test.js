'use strict';

/**
 * Test Runner
 * Allows running all tests in either the top, or the /test folder
 * Run all tests by executing `node test/test.js`
 * Run specific test/s by executing `node test/test.js <file1> <file2>...`
 *    (file1, file2 etc. must be under the /test folder, and be .js files) 
 */

var fs = require('fs'),
	path = require('path'),
	Mocha = require('mocha'),
	mocha = new Mocha({
		reporter: 'spec',
		timeout: 10000,
		slow: 2000
	});

var addFiles = function() {
	var cwd = process.cwd() + (process.cwd().split('/').pop() !== 'test' ? '/test' : '');
	if(process.argv.length > 2) {
		for(var i = 2; i < process.argv.length; i++) {
			var file = process.argv[i] + (process.argv[i].substr(-3) === '.js' ? '' : '.js');
			mocha.addFile(path.join(cwd, file));
		}
	}
	else {
		var currentFile = __filename.split('/').pop(),
			skipFiles = [currentFile];
		fs.readdirSync(cwd).filter(function(file) {
			return (file.substr(-3) === '.js') && (skipFiles.indexOf(file) === -1);
		}).forEach(function(file) {
			console.log(file);
			mocha.addFile(path.join(cwd, file));
		});
	}
};

var runTests = function() {
	mocha.run(function(failures) {
		process.on('exit', function() {
			process.exit(failures);
		});
	});
};

addFiles();
runTests();