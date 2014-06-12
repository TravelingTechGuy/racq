'use strict';

var util = require('util'),
	async = require('async'),
	should = require('should'),
	debug = require('debug')('claims'),
	common = require('./common');	

describe('Claim operations', function() {
	var queueName = common.getRandomQueueName(),
		claims,
		claimId,
		q1, q2;
		
	before(function(done) {
		async.series([
			function setup(callback) {
				q1 = common.initializeQueue();
				q2 = common.initializeQueue();
				debug('initialized 2 queue clients:\n\tq1=%s\n\tq2=%s', q1.getClientId(), q2.getClientId());
				callback(null);
			},
			function authenticateQueues(callback) {
				async.parallel([q1.authenticate, q2.authenticate], callback);
				
			},
			function createQueue(callback) {
				q1.createQueue(queueName, callback);
				debug('queue %s created', queueName);
			},
			function post10Messages(callback) {
				var messages = common.generateMessages(10, 1, 300);
				q1.postMessages(queueName, messages, callback);
				debug('posting %s messages using q1', messages.length);
			}
		], done);
	});

	it('should claim the first 5 messages using q2', function(done) {
		var parameters = {
			limit: 5,
			ttl: 200,
			grace: 60
		};
		q2.claimMessages(queueName, parameters, function(error, result) {
			debug(util.inspect(result, true, 2));
			should.not.exist(error);
			should.exist(result);
			result.length.should.eql(5);
			//save claims and claimId for future tests
			claims = result;
			//all 5 will have the same claimId
			claimId = claims[0].claimId;
			done();
		});
	});

	it('should verify the claim', function(done) {
		debug('querying claim %s', claimId);
		q2.queryClaims(queueName, claimId, function(error, result) {
			debug(util.inspect(result, true, 2));
			should.not.exist(error);
			should.exist(result);
			result.length.should.eql(5);
			result[2].body.number.should.eql(3);
			done();
		});
	});

	it('should delete the claimed message, leaving 4', function(done) {
		async.series([
			function deleteMessage(callback) {
				q2.deleteMessages(queueName, claims[2].id, claimId, callback);
			},
			function queryClaim(callback) {
				debug('message %s with claim id %s deleted', claims[2].id, claimId);
				q2.queryClaims(queueName, claims[2].claimId, function(error, result) {
					debug(util.inspect(result, true, 2));
					should.not.exist(error);
					should.exist(result);
					result.length.should.eql(4);
					callback(error);
				});
			}
		], done);
	});
	
	it('should update the claim of the messages from ttl 150 to 1234', function(done) {
		async.series([
			function updateClaim(callback) {
				var parameters = {
					limit: 5,
					ttl: 1000,
					grace: 60
				};
				q2.updateClaims(queueName, claims[0].claimId, parameters, callback);				
			},
			function queryClaim(callback) {
				q2.queryClaims(queueName, claimId, function(error, result) {
					debug(util.inspect(result, true, 3));
					should.not.exist(error);
					should.exist(result);
					// result[0].ttl.should.eql(1234);
					callback(error);
				});
			}
		], done);
	});

	it('should release the claim', function(done) {
		async.series([
			function releaseClaim(callback) {
				q2.releaseClaims(queueName, claimId, callback);		
			},
			function queryClaims(callback) {
				q2.queryClaims(queueName, claimId, function(error, result) {
					should.not.exist(result);
					should.exist(error);
					debug(util.inspect(error));
					error.toString().should.containEql('not found');
					callback(null);
				});
			}
		], done);
		
	});

	after(function(done) {
		q1.deleteQueue(queueName, done);
		debug('queue %s deleted', queueName);
	});
});