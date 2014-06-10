'use strict';

var RacQ = require('../lib/racq'),
	async = require('async'),
	debug = require('debug')('messages'),
	util = require('util'),
	queueName,
	q,
	msgId;

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
	function post3Messages(callback) {
		var messages = [
			{
				ttl: 60,
				body: {property: 'value1'}
			},
			{
				ttl: 60,
				body: {property: 'value2'}
			},
			{
				ttl: 60,
				body: {property: 'value3'}
			}
		];
		q.postMessages(queueName, messages, callback);
	},
	function read2ndMessage(callback) {
		var options = {
			echo: true,
			limit: 1,
			marker: 1 	//skip first message
		};
		q.getMessages(queueName, options, function(error, result) {
			if(error) {
				debug(error);
			}
			else {
				msgId = result.messages[0].id;
				debug('message id: %s', msgId);
				debug('message body: %s', util.inspect(result.messages[0].body));
			}
			callback(error);
		});
	},
	function getMessagesById(callback) {
		q.getMessagesById(queueName, msgId, function(error, result) {
			if(error) {
				debug(error);
			}
			else {
				debug('message body: %s', util.inspect(result.body));
			}
			callback(error);
		});
	},
	function deleteMessage(callback) {
		q.deleteMessages(queueName, msgId, callback);
	},
	function deleteQueue(callback) {
		q.deleteQueue(queueName, callback);
	}
], function(error) {
	console.log(!error ? 'Ok' : 'Not Ok');
});