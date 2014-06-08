'use strict';

var util = require('util'),
	Queue = require('../lib/queue'),
	should = require('should'),
	debug = require('debug')('messages');

describe('Messages operations', function() {
	var config = require('./testConfig'),
		tokenPath = __dirname + '/token.json',
		queueName = 'demoQueue' + Math.floor(Math.random() * 9000 + 1000),
		message = {
			ttl: 60,
			body: {myProperty: 'myValue'}
		},
		msgId = 'xxx';
	
	config.persistedTokenPath = tokenPath;
	var q = new Queue(config);	
	
	before(function(done) {
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
			if(!error && result.messages.length === 1 && result.messages[0].body.myProperty === message.body.myProperty) {
				msgId = result.messages[0].id;
				debug(msgId);
				done();
			}
		});
	});

	it('should get the message ' + msgId + ' from queue ' + queueName, function(done) {
		debug(msgId);
		q.getMessagesById(queueName, msgId, function(error, result) {
			debug(util.inspect(result, true, 3));
			if(!error && result.body.myProperty === message.body.myProperty) {
				done();
			}
		});
	});
	
	it('should delete message ' + msgId + ' from queue ' + queueName, function(done) {
		debug(msgId);
		q.deleteMessage(queueName, msgId, done);
	});

	after(function(done) {
		q.deleteQueue(queueName, done);
	});
});