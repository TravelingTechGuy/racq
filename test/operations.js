'use strict';

var Queue = require('../lib/queue'),
	should = require('should'),
	debug = require('debug')('opertions'),
	config = require('./testConfig'),
	tokenPath = __dirname + '/token.json',
	queueName = 'demoQueue' + Math.floor(Math.random() * 9000 + 1000);

describe('Queue operations', function() {
	config.persistedTokenPath = tokenPath;
	var q = new Queue(config);	
	
	before(function(done) {
		q.authenticate(done);
	});

	it('should return list of available queues', function(done) {
		q.listQueues(function(error, queues) {
			if(!error) {
				debug('%s queues found', queues.length);
				done();
			}
		});
	});

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

	it('should get the stats of a queue named ' + queueName, function(done) {
		q.getQueueStats(queueName, function(error, stats) {
			if(!error && stats !== null) {
				done();
			}
		});
	});

	var metadata = {myProperty: 'myValue'};
	it('should set the metadata of queue ' + queueName, function(done) {
		q.setQueueMetadata(queueName, metadata, done);
	});

	it('should get metadata from queue ' + queueName, function(done) {
		q.getQueueMetadata(queueName, function(error, data) {
			if(!error && data.myProperty === metadata.myProperty) {
				done();
			}
		});
	});

	it('should delete the queue ' + queueName, function(done) {
		q.deleteQueue(queueName, done);
	});		
});