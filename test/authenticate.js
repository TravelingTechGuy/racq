'use strict';

var fs = require('fs'),
	should = require('should'),
	dbg = require('debug'),
	debug = dbg('authenticate'),
	statistics = dbg('authenticate:statistics'),
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
		//remove the token persistence
		config.persistedTokenPath = null;
	});

	it('client id should be a GUID', function() {
		var q = new RacQ();
		debug('client id: %s', q.getClientId());
		q.getClientId().should.match(/^(\{{0,1}([0-9a-fA-F]){8}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){12}\}{0,1})$/);
	});

	it('should authenticate user with parameters', function(done) {
		var q = new RacQ();
		q.authenticate(config.userName, config.apiKey, function(error) {
			var stats = q.getStatistics();
			stats.calls.should.eql(1);
			statistics('Statistics:', stats);
			done(error);
		});
	});

	it('should authenticate user with options (and persist token for next test)', function(done) {
		config.persistedTokenPath = tokenPath;	//put token path back into config
		var q = new RacQ(config);
		q.authenticate(function(error) {
			if(!error && fs.existsSync(tokenPath)) {
				var stats = q.getStatistics();
				stats.calls.should.eql(1);
				statistics('Statistics:', stats);
				done(error);
			}
		});
	});

	it('should authenticate from token', function(done) {
		var q = new RacQ(config);
		q.authenticate(function(error) {
			var stats = q.getStatistics();
			stats.calls.should.eql(0);
			statistics('Statistics:', stats);
			done(error);
		});
	});
});