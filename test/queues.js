'use strict';

var should = require('should'),
	debug = require('debug')('opertions'),
	RacQ = require('../lib/racq');

describe('Queue operations', function() {
	var queueName = 'demoQueue' + Math.floor(Math.random() * 9000 + 1000),
		q;	
	
	before(function(done) {
		var config = require('./testConfig'),
			tokenPath = __dirname + '/token.json';

		config.persistedTokenPath = tokenPath;
		q = new RacQ(config);
		q.authenticate(done);
	});

	it('should return list of available queues', function(done) {
		q.listQueues(function(error, queues) {
			should.not.exist(error);
			debug('%s queues found', queues.length);
			done();
		});
	});

	it('should create a queue named ' + queueName, function(done) {
		q.createQueue(queueName, done);
	});

	it('should check the existence of a queue named ' + queueName, function(done) {
		q.queueExists(queueName, function(error, exists) {
			should.not.exist(error);
			should.exist(exists);
			done();
		});
	});

	it('should get the stats of a queue named ' + queueName, function(done) {
		q.getQueueStats(queueName, function(error, stats) {
			should.not.exist(error);
			should.exist(stats);
			debug(stats);
			done();
		});
	});

	var metadata = {myProperty: 'myValue'};
	it('should set the metadata of queue ' + queueName, function(done) {
		q.setQueueMetadata(queueName, metadata, done);
	});

	it('should get metadata from queue ' + queueName, function(done) {
		q.getQueueMetadata(queueName, function(error, data) {
			should.not.exist(error);
			should.exist(data);
			data.myProperty.should.eql(metadata.myProperty);
			done();
		});
	});

	it('should delete the queue ' + queueName, function(done) {
		q.deleteQueue(queueName, done);
	});		
});