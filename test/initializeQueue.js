'use strict';

/**
 * Initialize a queue, load config file, provide local token path, and authenticate
 * The function will return the authenticated queue, or an error
 * @param  {Function} callback
 */
module.exports = function(callback) {
	var RacQ = require('../lib/racq'),
		config = require('./testConfig'),
		tokenPath = __dirname + '/token.json',
		queue;
		
	config.persistedTokenPath = tokenPath;
	queue = new RacQ(config);
	queue.authenticate(function(error) {
		callback(error, queue);
	});
};