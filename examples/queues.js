'use strict';

var RacQ = require('../lib/racq'),
	async = require('async'),
	debug = require('debug')('queues'),
	queueName,
	q;

async.series([
	function setup(callback) {
		var config = require('./testConfig');
		q = new RacQ(config);
		callback(null);
	},
	function authenticate(callback) {
		q.authenticate(callback);
	},
	function createQueue(callback) {
		queueName = 'demoQueue' + Math.floor(Math.random() * 9000 + 1000);
		q.createQueue(queueName, callback);
	},
	function queueExists(callback) {
		q.queueExists(queueName, function(error, exists) {
			if(exists) {
				debug('%s exists', queueName);
			}
			else {
				debug('%s doesn\'t exist', queueName);
			}
			callback(null);
		});
	},
	function deleteQueue(callback) {
		q.deleteQueue(queueName, callback);
	}
], function(error) {
	console.log(!error ? 'Ok' : 'Not Ok');
});