'use strict';

var RacQ = require('../lib/racq'),
	async = require('async'),
	debug = require('debug')('queues'),
	queueName,
	q;

async.series([
	function setup(callback) {
		//setup queue name, and queue parameters
		var config = require('./testConfig');
		q = new RacQ(config);
		callback(null);
	},
	function authenticate(callback) {
		//get auth token
		q.authenticate(callback);
	},
	function createQueue(callback) {
		//create a demo queue
		queueName = 'demoQueue' + Math.floor(Math.random() * 9000 + 1000);
		q.createQueue(queueName, callback);
	},
	function queueExists(callback) {
		//check if queue creation succeeded
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
		//delete the queue
		q.deleteQueue(queueName, callback);
	}
], function(error) {
	//check if all functions executed without error
	console.log(!error ? 'Ok' : 'Not Ok');
});