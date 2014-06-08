'use strict';

var util = require('util'),
	should = require('should'),
	debug = require('debug')('messages'),
	Queue = require('../lib/queue');

describe('Messages operations', function() {
	var queueName = 'demoQueue' + Math.floor(Math.random() * 9000 + 1000),
		message = {
			ttl: 60,
			body: {myProperty: 'myValue'}
		},
		q,
		msgId;
	
	before(function(done) {
		var config = require('./testConfig'),
			tokenPath = __dirname + '/token.json';
		
		config.persistedTokenPath = tokenPath;
		q = new Queue(config);	
		q.authenticate(function(error) {
			if(!error) {
				q.createQueue(queueName, done);
			}
		});
	});

	it('should put message to queue ' + queueName, function(done) {
		q.putMessages(queueName, message, done);
	});

	it('should get messages from queue ' + queueName, function(done) {
		var options = {
			limit: 1,
			echo: true
		};
		q.getMessages(queueName, options, function(error, result) {
			debug(util.inspect(result, true, 3));
			should.not.exist(error);
			should.exist(result);
			result.messages[0].body.myProperty.should.eql(message.body.myProperty);
			msgId = result.messages[0].id;
			done();
		});
	});

	it('should get the message from queue ' + queueName, function(done) {
		debug(msgId);
		q.getMessagesById(queueName, msgId, function(error, result) {
			should.not.exist(error);
			should.exist(result);
			result.body.myProperty.should.eql(message.body.myProperty);
			done();
		});
	});
	
	it('should delete message from queue ' + queueName, function(done) {
		debug(msgId);
		q.deleteMessage(queueName, msgId, done);
	});

	after(function(done) {
		q.deleteQueue(queueName, done);
	});
});