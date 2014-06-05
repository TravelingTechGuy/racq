'use strict';

var Queue = require('../lib/queue'),
	fs = require('fs'),
	should = require('should'),
	debug = require('debug'),
	config = require('../config'),
	tokenPath = __dirname + '/token.json';

describe('Queue', function() {
	describe('Operations', function() {
		var options = {
				userName: config.userName,
				apiKey: config.apiKey,
				persistedTokenPath: tokenPath
			},
			q = new Queue(options);
		
		it('should return list of available queues', function(done) {
			q.authenticate(function(err) {
				if(!err) {
					q.listQueues(function(error, queues) {
						if(!error) {
							debug('%s queues found', queues.length);
							done();
						}
					});
				}
			});
		});

		var queueName = 'demoQueue' + Math.floor(Math.random() * 9000 + 1000);
		it('should create a queue named ' + queueName, function(done) {
			q.createQueue(queueName, done);
		});

		it('should check the existence of a queue named ' + queueName, function(done) {
			q.queueExists(queueName, function(error, exists) {
				if(!error && exists) {
					done();
				}
			});
		});

		// it('should delete the queue ' + queueName, function(done) {
		// 	q.deleteQueue(queueName, done);
		// });		
	});
});