'use strict';

module.exports = function() {
	var async = require('async'),
		request = require('request'),
		debug = require('debug')('consumer'),
		results = [];
	
	var processUrl = function(url, term, callback) {
		request(url, function(error, response, body) {
			if(!error && response.statusCode === 200) {
				var regexp = new RegExp(term, 'ig'),
					stripped = body.replace(/(<([^>]+)>)/ig, ''),
					o = stripped.match(regexp),
					result = {
						url: url,
						size: body.length,
						textSize: stripped.length,
						occurrences: o ? o.length : 0
					};
				return callback(null, result);
			}
			else {
				console.error(error || response.statusCode);
				return callback(error);
			}
		});
	};
	
	this.start = function(jobsQueue, done) {
		var RacQ = require('../../lib/racq'),
			config = require('../testConfig'),
			queue = new RacQ(config),
			getNext = true;
		
		async.series([
			function authenticate(cb) {
				queue.authenticate(cb);
			},
			function process(cb) {
				var clientId = queue.getClientId();
				debug('starting consumption with client id %s', clientId);
				async.doWhilst(
					function claimMessage(callback) {
						var parameters = {
							limit: 1,
							ttl: 300,
							grace: 100
						};
						queue.claimMessages(jobsQueue, parameters, function(error, message) {
							if(error) {
								getNext = false;
								console.error(error);
								return callback(error);
							}
							else if(message) {
								message = message[0];
								// debug(message);
								debug('%s now processing %s', clientId, message.body.url);
								processUrl(message.body.url, message.body.term, function(error, result) {
									// debug(result);
									if(!error) {
										results.push(result);
										queue.deleteMessages(jobsQueue, message.id, message.claimId, function(error) {
											if(error) {
												console.error(error);
											}
											return callback(null);
										});
									}
								});
							}
							else {
								debug('no more messages');
								getNext = false;
								return callback(null);
							}
						});
					},
					function test() {
						return getNext;
					},
					function finished() {
						return cb(null);
					});
			}
		],
		function finished() {
			return done(null, results);
		});
	};
};