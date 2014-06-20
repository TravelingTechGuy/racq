'use strict';

var fs = require('fs'),
	should = require('should'),
	debug = require('debug')('authenticate'),
	common = require('./common'),
	RacQ = require('../lib/racq'),
	config = common.getConfig(),
	tokenPath = config.tokenPath;

describe('Authentication', function() {
	before(function() {
		//delete persisted token if exists, to force actual authentication
		if(fs.existsSync(tokenPath)) {
			fs.unlinkSync(tokenPath);
		}
	});

	it('client id should be a GUID', function() {
		var q = new RacQ();
		q.getClientId().should.match(/^(\{{0,1}([0-9a-fA-F]){8}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){12}\}{0,1})$/);
	});

	it('should authenticate user with parameters', function(done) {
		var q = new RacQ();
		q.authenticate(config.userName, config.apiKey, done);
	});

	it('should authenticate user with options', function(done) {
		var q = new RacQ(config);
		q.authenticate(done);
	});
	
	it('should authenticate user and persist token', function(done) {
		config.persistedTokenPath = tokenPath;
		var q = new RacQ(config);
		q.authenticate(config.userName, config.apiKey, function(error) {
			if(!error && fs.existsSync(tokenPath)) {
				done();
			}
		});
	});
});