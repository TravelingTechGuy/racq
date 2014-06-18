'use strict';

module.exports = function() {
	var debug = require('debug')('producer');
	
	var prepareMessages = function(sites, term, ttl) {
		var i = 0,
			result = [];
		while(i++ < 10 && sites.length > 0) {
			var site = sites.shift();
			result.push({ttl: ttl, body: {url: site, term: term}});
			debug('site %s added', site);
		}
		return result;
	};

	this.start = function(jobsQueue, term, done) {
		var	RacQ = require('../../lib/racq'),
			async = require('async'),
			config = require('../testConfig'),
			sites = require('./sites'),
			queue = new RacQ(config);

		async.series([
			function authentcate(cb) {
				queue.authenticate(cb);
			},
			function process(cb) {
				async.doWhilst(
					function postMessages(callback) {
						var msgs = prepareMessages(sites, term, 600);
						queue.postMessages(jobsQueue, msgs, callback);
					},
					function test() {
						return sites.length > 0;
					},
					function finished() {
						return cb(null);
					});
			}],
			function finished() {
				return done(null);
			});
	};
};