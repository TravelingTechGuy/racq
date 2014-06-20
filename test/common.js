'use strict';

var debug = require('debug')('common');
/**
 * Initialize a queue, load config file, provide local token path, and authenticate
 * The function will return the authenticated queue, or an error
 * @param  {Function} callback
 */
exports.initializeQueue = function() {
	var RacQ = require('../lib/racq'),
		config = getConfig(),
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

var getConfig = function() {
	var fs = require('fs'),
		config = {};

	if(process.env.USERNAME && process.env.APIKEY) {
		config = {
			userName: process.env.USERNAME,
			apiKey: process.env.APIKEY
		};
		debug('setting config parameters from environment variables');
	}
	else if(fs.existsFileSync(__dirname + '/testConfig.json')) {
		config = require('./testConfig');
		debug('setting config parameters from testConfig.json');
	}
	else {
		debug('no config parameters specified');
	}
	config.tokenPath = __dirname + '/token.json';
	return config;
};

exports.getConfig = getConfig;