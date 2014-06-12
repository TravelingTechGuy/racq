'use strict';

/**
 * Initialize a queue, load config file, provide local token path, and authenticate
 * The function will return the authenticated queue, or an error
 * @param  {Function} callback
 */
exports.initializeQueue = function() {
	var RacQ = require('../lib/racq'),
		config = require('./testConfig'),
		tokenPath = __dirname + '/token.json',
		queue;
		
	config.persistedTokenPath = tokenPath;
	queue = new RacQ(config);
	return queue;
};

exports.getRandomQueueName = function() {
	return 'demoQueue' + Math.floor(Math.random() * 9000 + 1000);
};

exports.generateMessages = function(n, index, ttl) {
	var msgs = [];
	index = index || 1;
	ttl = ttl || 60;
	for(var i = 0; i < n; i++) {
		msgs.push({ttl: ttl, body: {number: index++}});
	}
	return msgs;
};