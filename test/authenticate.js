'use strict';

var Queue = require('../lib/queue'),
	fs = require('fs'),
	should = require('should'),
	debug = require('debug'),
	config = require('../config'),
	tokenPath = __dirname + '/token.json';

describe('Queue', function() {
	//delete persisted token if exists
	if(fs.existsSync(tokenPath)) {
		fs.unlinkSync(tokenPath);
	}

	describe('Authentication', function() {
		it('should authenticate user with parameters', function(done) {
			var q = new Queue();
			q.authenticate(config.userName, config.apiKey, done);
		});

		it('should authenticate user with options', function(done) {
			var options = {
					userName: config.userName,
					apiKey: config.apiKey
				},
				q = new Queue(options);
			q.authenticate(done);
		});
		
		it('should authenticate user and persist token', function(done) {
			var options = {
					userName: config.userName,
					apiKey: config.apiKey,
					persistedTokenPath: tokenPath
				},
				q = new Queue(options);
			q.authenticate(config.userName, config.apiKey, function(error) {
				if(!error && fs.existsSync(tokenPath)) {
					done();
				}
			});
		});

		it('client id should be a GUID', function() {
			var q = new Queue();
			q.getClientId().should.match(/^(\{{0,1}([0-9a-fA-F]){8}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){12}\}{0,1})$/);
		});
	});
});