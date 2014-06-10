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
	function post3Messages(callback) {
		//post 3 messages
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
		//read the second message (limit 1, marker 1)
		//echo would allow us to read messages we posted ourselves
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
				//preserve id for the next 2 functions
				msgId = result.messages[0].id;
				debug('message id: %s', msgId);
				debug('message body: %s', util.inspect(result.messages[0].body));
			}
			callback(error);
		});
	},
	function getMessagesById(callback) {
		//get the same message, this time using id
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
		//delete the message
		q.deleteMessages(queueName, msgId, callback);
	},
	function deleteQueue(callback) {
		//delete the queue
		q.deleteQueue(queueName, callback);
	}
], function(error) {
	//check if all functions executed without error
	console.log(!error ? 'Ok' : 'Not Ok');
});