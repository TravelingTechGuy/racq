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
	debug = require('debug')('test'),
	Mocha = require('mocha'),
	mocha = new Mocha({
		reporter: 'spec',
		timeout: 10000,
		slow: 2000
	});

/**
 * Add test files to be run.
 * Files can either be supplied in command line, or will be taken from /test directory
 * Only .js files will be included.
 * File names to be skipped should be added to the skipFiles array (by default contains local file)
 */
var addFiles = function() {
	var cwd = process.cwd() + '/test/';
	if(process.argv.length > 2) {
		for(var i = 2; i < process.argv.length; i++) {
			var file = process.argv[i] + (process.argv[i].substr(-3) === '.js' ? '' : '.js');
			mocha.addFile(path.join(cwd, file));
		}
	}
	else {
		var skipFiles = ['common.js'];
		fs.readdirSync(cwd).filter(function(file) {
			return (file.substr(-3) === '.js') && (skipFiles.indexOf(file) === -1);
		}).forEach(function(file) {
			debug('%s added to tests', file);
			mocha.addFile(path.join(cwd, file));
		});
	}
};

(function() {
	debug('Adding test files');
	addFiles();
	debug('Running tests');
	mocha.run(function(failures) {
		process.on('exit', function() {
			process.exit(failures);
		});
	});
}());